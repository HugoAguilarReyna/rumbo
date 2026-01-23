from fastapi import APIRouter, Depends
from app.utils.dependencies import get_current_user
from app.models.user import UserResponse

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user

from typing import List
from app.core.database import get_database

@router.get("/", response_model=List[UserResponse])
async def list_users(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    users = await db.users.find().to_list(1000)
    return users
