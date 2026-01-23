from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List
from app.models.note import NoteCreate, NoteUpdate, NoteResponse
from app.utils.dependencies import get_current_user
from app.core.database import get_database
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/api/tasks/{task_id}/notes", tags=["notes"])

@router.post("/", response_model=NoteResponse)
async def create_note(
    task_id: str,
    note: NoteCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a note/comment to a task."""
    db = get_database()
    
    # Verify task exists and user has access
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "owner_id": str(current_user.id)
    })
    
    if not task:
        raise HTTPException(404, "Task not found")
    
    note_dict = {
        "task_id": task_id,
        "author_id": str(current_user.id),
        "author_name": current_user.username,
        "content": note.content,
        "category": note.category,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "edited": False
    }
    result = await db.notes.insert_one(note_dict)
    note_dict["_id"] = str(result.inserted_id)

    return note_dict

@router.get("/", response_model=List[NoteResponse]) 
async def get_task_notes(
    task_id: str,
    current_user: dict = Depends(get_current_user)
): 
    """Get all notes for a task."""
    db = get_database()
    notes = await db.notes.find(
        {"task_id": task_id}
    ).sort("created_at", -1).to_list(length=100)

    return notes

@router.patch("/{note_id}") 
async def update_note(
    task_id: str, 
    note_id: str, 
    update: NoteUpdate, 
    current_user: dict = Depends(get_current_user)
): 
    """Edit a note (only by author)."""
    db = get_database()
    result = await db.notes.update_one(
        {
            "_id": ObjectId(note_id),
            "task_id": task_id,
            "author_id": str(current_user.id)
        },
        {
            "$set": {
                "content": update.content,
                "updated_at": datetime.utcnow(),
                "edited": True
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(404, "Note not found or you're not the author")

    return {"success": True}

@router.delete("/{note_id}") 
async def delete_note(
    task_id: str, 
    note_id: str, 
    current_user: dict = Depends(get_current_user)
): 
    """Delete a note (only by author or admin)."""
    db = get_database()
    result = await db.notes.delete_one({
        "_id": ObjectId(note_id),
        "task_id": task_id,
        "author_id": str(current_user.id)
    })

    if result.deleted_count == 0:
        raise HTTPException(404, "Note not found or you're not the author")

    return {"success": True}
