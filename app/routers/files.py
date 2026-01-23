from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import uuid
import shutil
from app.utils.dependencies import get_current_user
from app.core.database import get_database
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/api/tasks/{task_id}/files", tags=["files"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.txt', '.csv', '.zip'
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

@router.post("/upload")
async def upload_file(
    task_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload file and attach to task."""
    db = get_database()
    
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type {file_ext} not allowed")
    
    # Validate file size
    # Note: UploadFile is a SpooledTemporaryFile. Seeking might work depending on backend.
    # To correspond with user request logic:
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large (max 10MB)")
    
    # Verify task ownership
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "owner_id": str(current_user.id)
    })
    
    if not task:
        raise HTTPException(404, "Task not found")
    
    # Create task-specific directory
    task_dir = UPLOAD_DIR / task_id
    task_dir.mkdir(exist_ok=True)
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}{file_ext}"
    file_path = task_dir / safe_filename
    
    # Save file
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Create attachment record
    attachment = {
        "id": file_id,
        "filename": file.filename,
        "file_path": str(file_path),
        "file_size": file_size,
        "mime_type": file.content_type,
        "uploaded_by": str(current_user.id),
        "uploaded_at": datetime.utcnow()
    }
    
    # Update task
    await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$push": {"attachments": attachment}}
    )
    
    return {
        "success": True,
        "attachment": attachment
    }

@router.get("/{file_id}")
async def download_file(
    task_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download a file attachment."""
    db = get_database()
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "owner_id": str(current_user.id)
    })
    
    if not task:
        raise HTTPException(404, "Task not found")
    
    # Find attachment
    attachment = next(
        (a for a in task.get("attachments", []) if a["id"] == file_id),
        None
    )
    
    if not attachment:
        raise HTTPException(404, "File not found")
    
    file_path = Path(attachment["file_path"])
    
    if not file_path.exists():
        raise HTTPException(404, "File no longer exists")
    
    return FileResponse(
        path=file_path,
        filename=attachment["filename"],
        media_type=attachment["mime_type"]
    )

@router.delete("/{file_id}")
async def delete_file(
    task_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a file attachment."""
    db = get_database()
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "owner_id": str(current_user.id)
    })
    
    if not task:
        raise HTTPException(404, "Task not found")
    
    attachment = next(
        (a for a in task.get("attachments", []) if a["id"] == file_id),
        None
    )
    
    if not attachment:
        raise HTTPException(404, "File not found")
    
    # Delete physical file
    file_path = Path(attachment["file_path"])
    if file_path.exists():
        try:
            file_path.unlink()
        except:
            pass # Ignore deletion errors
    
    # Remove from database
    await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$pull": {"attachments": {"id": file_id}}}
    )
    
    return {"success": True}
