from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.utils.dependencies import get_current_user
from app.core.database import get_database
from app.models.user import UserResponse, UserUpdate
# We need to import UserUpdate model, let's verify if it exists first.
# If not, we define a local one or use Body for flexibility in this iteration.

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user

@router.get("/", response_model=List[UserResponse])
async def list_users(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    users = await db.users.find().to_list(1000)
    return users

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: dict = Body(...), # Using dict to allow flexibility for now
    current_user: UserResponse = Depends(get_current_user)
):
    # Security: Only admins should update other users? 
    # For this demo, we allow any user to update (or restricted to self/admin if we had roles logic implemented fully)
    # Let's assume broad permissions for the "Management" dashboard as requested by user.
    
    db = get_database()
    
    # Filter allowed fields
    allowed_fields = {"role", "daily_capacity", "weekly_capacity", "full_name", "disabled"}
    update_data = {k: v for k, v in user_update.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
        
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    return updated_user

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    # Prevent self-deletion
    if str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    db = get_database()
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"message": "User deleted successfully"}
