from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from app.core import security, config
from app.core.database import get_database
from app.models.user import UserCreate, UserInDB
from app.services.email import send_email
from app.models.task import TaskInDB
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

class TokenRequest(BaseModel):
    refresh_token: str

class EmailRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class VerifyEmailRequest(BaseModel):
    token: str

@router.post("/register")
async def register(user: UserCreate, background_tasks: BackgroundTasks):
    db = get_database()
    existing_user = await db.users.find_one({"$or": [{"email": user.email}, {"username": user.username}]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    user_dict = user.model_dump()
    password = user_dict.pop("password")
    hashed_password = security.get_password_hash(password)
    verification_token = security.generate_verification_token()
    
    new_user = UserInDB(
        **user_dict,
        hashed_password=hashed_password,
        verification_token=verification_token
    )
    
    result = await db.users.insert_one(new_user.model_dump(by_alias=True))
    user_id = str(result.inserted_id)

    # Auto onboarding tasks
    tasks = [
        TaskInDB(
            owner_id=user_id,
            title="Welcome! This is your first task",
            status="COMPLETED",
            priority="HIGH",
            completed_at=datetime.utcnow()
        ),
        TaskInDB(
            owner_id=user_id,
            title="Create your first project plan",
            status="IN_PROGRESS",
            priority="MEDIUM",
            due_date=datetime.utcnow() + timedelta(days=7)
        ),
        TaskInDB(
            owner_id=user_id,
            title="Invite team members",
            status="PENDING",
            priority="LOW",
            due_date=datetime.utcnow() + timedelta(days=14)
        )
    ]
    await db.tasks.insert_many([t.model_dump(by_alias=True) for t in tasks])

    # Send verification email
    verify_url = f"{config.settings.FRONTEND_URL}/pages/verify-email.html?token={verification_token}"
    background_tasks.add_task(
        send_email,
        "Verify your account",
        [user.email],
        f"Click here to verify: {verify_url}"
    )

    return {"message": "Registration successful. Please check your email.", "user_id": user_id}

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_database()
    user = await db.users.find_one({"username": form_data.username})
    if not user:
        # Check email login
        user = await db.users.find_one({"email": form_data.username})
    
    if not user or not security.verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
        
    if user.get("disabled"):
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = security.create_access_token(data={"sub": user["username"]})
    refresh_token = security.create_refresh_token(data={"sub": user["username"]})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "email_verified": user.get("email_verified", False)
        }
    }

@router.post("/refresh")
async def refresh_token(request: TokenRequest):
    payload = security.verify_token(request.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    username = payload.get("sub")
    access_token = security.create_access_token(data={"sub": username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/verify-email")
async def verify_email(request: VerifyEmailRequest):
    db = get_database()
    user = await db.users.find_one({"verification_token": request.token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")
        
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"email_verified": True, "verification_token": None}}
    )
    return {"message": "Email verified successfully"}

@router.post("/request-password-reset")
async def request_password_reset(request: EmailRequest):
    db = get_database()
    user = await db.users.find_one({"email": request.email})
    if user:
        token = security.generate_verification_token()
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "reset_token": token,
                "reset_token_expires": datetime.utcnow() + timedelta(hours=1)
            }}
        )
        reset_url = f"{config.settings.FRONTEND_URL}/pages/reset-password.html?token={token}"
        await send_email(
            "Password Reset Request",
            [request.email],
            f"Click here to reset your password: {reset_url}"
        )
    return {"message": "If the email exists, a reset link has been sent"}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    db = get_database()
    user = await db.users.find_one({
        "reset_token": request.token,
        "reset_token_expires": {"$gt": datetime.utcnow()}
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
        
    hashed_password = security.get_password_hash(request.new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "hashed_password": hashed_password,
            "reset_token": None,
            "reset_token_expires": None
        }}
    )
    return {"message": "Password reset successfully"}
