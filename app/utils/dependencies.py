from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.core import security
from app.core.config import settings
from app.core.database import get_database
from app.models.user import UserResponse
from bson import ObjectId

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = security.verify_token(token)
    if payload is None:
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
        
    db = get_database()
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
        
    if user.get("disabled"):
        raise HTTPException(status_code=400, detail="Inactive user")
        
    try:
        # Convert ObjectId to string for Pydantic
        user["_id"] = str(user["_id"])
        return UserResponse(**user)
    except Exception as e:
        print(f"User Validation Error: {e}")
        raise HTTPException(status_code=500, detail=f"Auth Error: {e}")
