from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Body, Path
from typing import List, Optional, Any
from datetime import datetime, timedelta
from bson import ObjectId
from pydantic import BaseModel, Field, BeforeValidator
from typing import Annotated

from app.utils.dependencies import get_current_user
from app.core.database import get_database
from app.models.user import UserResponse
# Note: Keeping app.models.task for reference but defining schemas here as requested

router = APIRouter(prefix="/tasks", tags=["tasks"])

# --------------------------------------------------------------------------------
# SCHEMAS (Defined in router for GAG_PM_DASH architecture)
# --------------------------------------------------------------------------------

PyObjectId = Annotated[str, BeforeValidator(str)]

class TaskBase(BaseModel):
    title: str
    task_name: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[str] = None
    status: str = "PENDING"
    priority: str = "MEDIUM"
    assigned_to: Optional[str] = None
    estimated_hours: float = 0.0
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    tags: List[str] = []
    seniority: str = "Mid"
    progress: float = 0.0

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    task_name: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    estimated_hours: Optional[float] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    tags: Optional[List[str]] = None
    seniority: Optional[str] = None
    logged_hours: Optional[float] = None
    progress: Optional[float] = None

class TaskResponse(TaskBase):
    id: PyObjectId = Field(alias="_id")
    owner_id: str
    created_at: datetime
    updated_at: datetime
    capacity_validated: bool = True
    capacity_warnings: List[str] = []
    logged_hours: float = 0.0
    completed_at: Optional[datetime] = None
    
    # Checklists (Enterprise Feature)
    checklists: List[dict] = []
    checklist_progress: dict = {"total": 0, "completed": 0, "percentage": 0}

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

# --------------------------------------------------------------------------------
# HELPERS
# --------------------------------------------------------------------------------

def map_task_to_db(task_dict: dict) -> dict:
    """Map task_name (API) to title (DB)"""
    if "task_name" in task_dict:
        task_dict["title"] = task_dict.pop("task_name")
    return task_dict

def map_task_from_db(task_doc: dict) -> dict:
    """Map title (DB) to task_name (API) - Keep title for Pydantic"""
    # 1. Backward Compatibility: Ensure 'title' exists if only 'task_name' is present
    if task_doc.get("task_name") and not task_doc.get("title"):
        task_doc["title"] = task_doc["task_name"]

    # 2. Forward Compatibility: Populate 'task_name' from 'title' for legacy clients
    if task_doc and "title" in task_doc:
        task_doc["task_name"] = task_doc["title"] 

    if task_doc and "_id" in task_doc:
        task_doc["_id"] = str(task_doc["_id"])
    return task_doc

# --------------------------------------------------------------------------------
# ENDPOINTS
# --------------------------------------------------------------------------------

@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    status: Optional[str] = None,
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    query = {"owner_id": str(current_user.id)}
    if status:
        query["status"] = status
    if project_id and project_id != "ALL":
        query["project_id"] = project_id
        
    cursor = db.tasks.find(query).sort("due_date", 1)
    tasks = await cursor.to_list(length=1000)
    return [map_task_from_db(t) for t in tasks]

@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    
    # Module 1: Capacity Validation (Enterprise Feature)
    capacity_warnings = []
    capacity_valid = True
    try:
        from app.services.capacity import CapacityService
        if task.assigned_to and task.start_date and task.due_date and task.estimated_hours:
            service = CapacityService(db)
            result = await service.check_capacity(
                user_id=task.assigned_to,
                start_date=task.start_date.replace(tzinfo=None) if task.start_date else None,
                due_date=task.due_date.replace(tzinfo=None) if task.due_date else None,
                estimated_hours=task.estimated_hours
            )
            capacity_valid = result["valid"]
            capacity_warnings = result["warnings"]
    except Exception as e:
        print(f"Capacity Check Failed: {e}")
    
    # Prepare Dict
    task_dict = task.model_dump()
    task_dict = map_task_to_db(task_dict)
    
    task_dict.update({
        "owner_id": str(current_user.id),
        "capacity_validated": capacity_valid,
        "capacity_warnings": capacity_warnings,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "logged_hours": 0.0,
        "checklists": [],
        "checklist_progress": {"total": 0, "completed": 0, "percentage": 0}
    })
    
    # Insert Task
    result = await db.tasks.insert_one(task_dict)
    created_task = await db.tasks.find_one({"_id": result.inserted_id})
    
    # Notification (Enterprise Feature)
    try:
        if task.assigned_to:
            assigned_user = await db.users.find_one({"username": task.assigned_to})
            if assigned_user:
                from app.services.notifications import NotificationService
                notifier = NotificationService(db)
                await notifier.notify_task_assignment(created_task, str(assigned_user["_id"]))
    except Exception as e:
        print(f"Notification Error: {e}")

    return map_task_from_db(created_task)

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    try:
        task = await db.tasks.find_one({"_id": ObjectId(task_id), "owner_id": str(current_user.id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid Task ID")
        
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return map_task_from_db(task)

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task_full(
    task_id: str,
    task_update: TaskUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    task = await db.tasks.find_one({"_id": ObjectId(task_id), "owner_id": str(current_user.id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task_update.model_dump(exclude_unset=True)
    update_data = map_task_to_db(update_data)
    
    if update_data.get("status") == "COMPLETED" and task.get("status") != "COMPLETED":
        update_data["completed_at"] = datetime.utcnow()
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data}
    )
    
    updated_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return map_task_from_db(updated_task)

@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: str,
    status: str = Body(..., embed=True),
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    update_data = {
        "status": status,
        "updated_at": datetime.utcnow()
    }
    if status == "COMPLETED":
        update_data["completed_at"] = datetime.utcnow()
    
    result = await db.tasks.update_one(
        {"_id": ObjectId(task_id), "owner_id": str(current_user.id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"status": "success", "new_status": status}

@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    result = await db.tasks.delete_one({"_id": ObjectId(task_id), "owner_id": str(current_user.id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "success", "message": "Task deleted"}

# --- SPECIAL ENDPOINTS ---

@router.get("/overdue/list")
async def list_overdue_tasks(
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    now = datetime.utcnow()
    query = {
        "owner_id": str(current_user.id),
        "due_date": {"$lt": now},
        "status": {"$nin": ["COMPLETED", "CANCELLED"]}
    }
    cursor = db.tasks.find(query).sort("due_date", 1)
    tasks = await cursor.to_list(length=100)
    return [map_task_from_db(t) for t in tasks]

@router.get("/stats/by-status")
async def get_tasks_stats_by_status(
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    pipeline = [
        {"$match": {"owner_id": str(current_user.id)}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    cursor = db.tasks.aggregate(pipeline)
    results = await cursor.to_list(length=100)
    return {r["_id"]: r["count"] for r in results}

# --- LEGACY / ENTERPRISE ENDPOINTS (Preserved) ---

@router.post("/upload-csv")
async def upload_tasks_csv(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format.")
    
    try:
        content = await file.read()
        from app.services.ingest import ingest_csv
        result = await ingest_csv(content, str(current_user.id))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/gantt")
async def get_gantt_tasks(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    query = {"owner_id": str(current_user.id)}
    if project_id and project_id != "ALL":
        query["project_id"] = project_id
        
    cursor = db.tasks.find({
        **query,
        "title": {"$exists": True, "$ne": ""},
        "start_date": {"$exists": True},
        "due_date": {"$exists": True}
    })
    tasks = await cursor.to_list(length=1000)
    
    projects = await db.projects.find({"owner_id": str(current_user.id)}).to_list(length=100)
    project_map = {str(p["_id"]): p["name"] for p in projects}
    
    gantt_tasks = []
    for task in tasks:
        start = task.get("start_date")
        end = task.get("due_date")
        if not start or not end: continue
        
        gantt_tasks.append({
            "id": str(task["_id"]),
            "name": task["title"],
            "start": start.strftime("%Y-%m-%d"),
            "end": end.strftime("%Y-%m-%d"),
            "progress": 100 if task["status"] == "COMPLETED" else (50 if task["status"] == "IN_PROGRESS" else 0),
            "custom_class": f"bar-{task.get('status', 'PENDING').lower()}",
            "project_name": project_map.get(task.get("project_id"), "Uncategorized")
        })
    return gantt_tasks

# --- CHECKLISTS (ENTERPRISE) ---

@router.post("/{task_id}/checklist")
async def add_checklist_item(
    task_id: str,
    text: str = Body(..., embed=True),
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    item_id = str(ObjectId())
    item = {"id": item_id, "text": text, "completed": False, "created_at": datetime.utcnow()}
    
    await db.tasks.update_one(
        {"_id": ObjectId(task_id), "owner_id": str(current_user.id)},
        {"$push": {"checklists": item}}
    )
    return item

# --- TIME TRACKING (ENTERPRISE) ---

@router.post("/{task_id}/log-time")
async def log_time(
    task_id: str,
    hours: float = Body(..., embed=True),
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    await db.tasks.update_one(
        {"_id": ObjectId(task_id), "owner_id": str(current_user.id)},
        {"$inc": {"logged_hours": hours}}
    )
    return {"status": "success"}

# (Other specialized analytics endpoints can be added or kept as needed)
