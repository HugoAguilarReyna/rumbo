from fastapi import APIRouter, Depends
from app.utils.dependencies import get_current_user, get_database
from app.models.user import UserResponse
from typing import List
from bson import ObjectId

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/")
async def get_notifications(
    unread_only: bool = False,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get user's notifications."""
    db = get_database()
    query = {"user_id": str(current_user.id)}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(query)\
        .sort("created_at", -1)\
        .limit(50)\
        .to_list(length=50)
    
    # Convert ObjectIds
    results = []
    for n in notifications:
        n["_id"] = str(n["_id"])
        results.append(n)
        
    return results

@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Mark notification as read."""
    db = get_database()
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "user_id": str(current_user.id)},
        {"$set": {"read": True}}
    )
    
    return {"success": True}

@router.post("/mark-all-read")
async def mark_all_read(
    current_user: UserResponse = Depends(get_current_user)
):
    """Mark all notifications as read."""
    db = get_database()
    result = await db.notifications.update_many(
        {"user_id": str(current_user.id), "read": False},
        {"$set": {"read": True}}
    )
    
    return {"success": True, "modified": result.modified_count}
