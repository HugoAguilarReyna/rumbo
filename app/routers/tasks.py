from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from app.utils.dependencies import get_current_user
from app.core.database import get_database
from app.models.user import UserResponse
from app.models.task import TaskCreate, TaskUpdate, TaskResponse, TaskInDB
from app.services.csv_processor import process_tasks_csv

router = APIRouter(prefix="/tasks", tags=["tasks"])

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
    return tasks

@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    
    # Module 1: Capacity Validation
    capacity_warnings = []
    capacity_valid = True
    
    try:
        from app.services.capacity import CapacityService
        if task.assigned_to and task.start_date and task.due_date and task.estimated_hours:
            service = CapacityService(db)
            result = await service.check_capacity(
                user_id=task.assigned_to, # Currently passing username as user_id based on service logic FIXME
                start_date=task.start_date.replace(tzinfo=None) if task.start_date else None,
                due_date=task.due_date.replace(tzinfo=None) if task.due_date else None,
                estimated_hours=task.estimated_hours
            )
            capacity_valid = result["valid"]
            capacity_warnings = result["warnings"]
    except Exception as e:
        print(f"Capacity Check Failed: {e}")
        # Default to valid if check fails to avoid blocking creation
    
    # Prepare Dict
    task_dict = task.model_dump()
    new_task = TaskInDB(
        **task_dict,
        owner_id=str(current_user.id),
        capacity_validated=capacity_valid,
        capacity_warnings=capacity_warnings,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    # Insert Task
    result = await db.tasks.insert_one(new_task.model_dump(by_alias=True))
    created_task = await db.tasks.find_one({"_id": result.inserted_id})
    
    # Notification: Task Assignment
    try:
        if task.assigned_to:
            # Resolve username to user_id
            assigned_user = await db.users.find_one({"username": task.assigned_to})
            if assigned_user:
                from app.services.notifications import NotificationService
                notifier = NotificationService(db)
                await notifier.notify_task_assignment(created_task, str(assigned_user["_id"]))
    except Exception as e:
        print(f"Notification Error: {e}")

    return TaskResponse.model_validate(created_task)


@router.post("/upload-csv")
async def upload_tasks_csv(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    print("DEBUG: Entered upload_tasks_csv (with ingest service)")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")
    
    try:
        content = await file.read()
        from app.services.ingest import ingest_csv
        result = await ingest_csv(content, str(current_user.id))
        
        if "error" in result:
             raise HTTPException(status_code=400, detail=result["error"])
             
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: CRASH: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server Crash: {str(e)}")

@router.get("/gantt")
async def get_gantt_tasks(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    print(f"🔒 Gantt Auth Check: User {current_user.username} accessed Gantt route")
    db = get_database()
    query = {"owner_id": str(current_user.id)}
    if project_id and project_id != "ALL":
        query["project_id"] = project_id
        
    # Fetch tasks with basic validation query to reduce data transfer
    # We still do robust checking in python for complex logic
    cursor = db.tasks.find({
        **query,
        "title": {"$exists": True, "$ne": ""},
        "start_date": {"$exists": True},
        "due_date": {"$exists": True}
    })
    tasks = await cursor.to_list(length=1000)
    
    # Fetch projects for mapping
    projects = await db.projects.find({"owner_id": str(current_user.id)}).to_list(length=100)
    project_map = {str(p["_id"]): p["name"] for p in projects}
    
    gantt_tasks = []
    
    def ensure_date(d):
        if isinstance(d, datetime):
            return d
        if isinstance(d, str):
            try:
                return datetime.fromisoformat(d.replace('Z', '+00:00'))
            except:
                pass
        return None

    for task in tasks:
        # Validate critical fields
        start = ensure_date(task.get("start_date") or task.get("created_at"))
        end = ensure_date(task.get("due_date"))
        
        if not start or not end:
            continue
            
        # Ensure end >= start
        if end < start: end = start + timedelta(hours=1)

        status_class = f"bar-{task.get('status', 'PENDING').lower()}"
        
        # Get Project Name
        pid = task.get("project_id")
        pname = project_map.get(pid, "Uncategorized") if pid else "Uncategorized"

        entry = {
            "id": str(task["_id"]),
            "name": task["title"],
            "start": start.strftime("%Y-%m-%d"),
            "end": end.strftime("%Y-%m-%d"),
            "progress": 100 if task["status"] == "COMPLETED" else (50 if task["status"] == "IN_PROGRESS" else 0),
            "custom_class": status_class,
            "status": task.get("status"),           
            "assigned_to": task.get("assigned_to"),
            "project_id": pid,
            "project_name": pname
        }
        gantt_tasks.append(entry)
        
    return gantt_tasks

@router.get("/overdue")
async def get_overdue_tasks(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    now = datetime.utcnow()
    query = {
        "owner_id": str(current_user.id),
        "due_date": {"$lt": now},
        "status": {"$nin": ["COMPLETED", "CANCELLED"]}
    }
    if project_id and project_id != "ALL":
        query["project_id"] = project_id

    cursor = db.tasks.find(query)
    tasks = await cursor.to_list(length=100)
    
    result = []
    for t in tasks:
        days_overdue = (now - t["due_date"]).days
        t["days_overdue"] = days_overdue
        t["id"] = str(t["_id"])
        del t["_id"] # clean up
        result.append(t)
        
    return {"count": len(result), "tasks": result}

@router.get("/upcoming")
async def get_upcoming_tasks(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    now = datetime.utcnow()
    week_later = now + timedelta(days=7)
    
    query = {
        "owner_id": str(current_user.id),
        "due_date": {"$gte": now, "$lte": week_later},
        "status": {"$ne": "COMPLETED"}
    }
    if project_id and project_id != "ALL":
        query["project_id"] = project_id
        
    cursor = db.tasks.find(query)
    tasks = await cursor.to_list(length=100)
    
    # Clean ObjectId
    for t in tasks:
        t["id"] = str(t["_id"])
        del t["_id"]
        
    return tasks

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
    
    return task

@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    task = await db.tasks.find_one({"_id": ObjectId(task_id), "owner_id": str(current_user.id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task_update.model_dump(exclude_unset=True)
    if update_data.get("status") == "COMPLETED" and task.get("status") != "COMPLETED":
        update_data["completed_at"] = datetime.utcnow()
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data}
    )
    
    updated_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return updated_task

@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    result = await db.tasks.delete_one({"_id": ObjectId(task_id), "owner_id": str(current_user.id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")


# --------------------------------------------------------------------------------
# MODULE 1: CAPACITY REPORT
# --------------------------------------------------------------------------------
@router.get("/analytics/capacity-report")
async def get_capacity_report(
    start_date: str,
    end_date: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Generate capacity utilization report for all team members."""
    db = get_database()
    try:
        from app.services.capacity import CapacityService
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        
        service = CapacityService(db)
        return await service.get_capacity_report(start, end)
            

    except Exception as e:
        print(f"Capacity Report Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --------------------------------------------------------------------------------
# MODULE 2: CHECKLISTS
# --------------------------------------------------------------------------------
from app.models.checklist import ChecklistCreate, ChecklistUpdate, ChecklistItem

@router.post("/{task_id}/checklist")
async def add_checklist_item(
    task_id: str,
    item: ChecklistCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    task = await db.tasks.find_one({"_id": ObjectId(task_id), "owner_id": str(current_user.id)})
    if not task:
        raise HTTPException(404, "Task not found")
    
    checklist_item = ChecklistItem(
        text=item.text,
        order=len(task.get("checklists", []))
    ).model_dump()
    
    await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$push": {"checklists": checklist_item},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Recalculate progress
    await update_checklist_progress(task_id, db)
    return {"success": True, "item": checklist_item}

@router.patch("/{task_id}/checklist/{item_id}")
async def update_checklist_item(
    task_id: str,
    item_id: str,
    update: ChecklistUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    update_data = {"checklists.$.completed": update.completed}
    if update.completed:
        update_data["checklists.$.completed_at"] = datetime.utcnow()
    else:
        update_data["checklists.$.completed_at"] = None
    
    result = await db.tasks.update_one(
        {
            "_id": ObjectId(task_id),
            "owner_id": str(current_user.id),
            "checklists.id": item_id
        },
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(404, "Checklist item not found")
    
    await update_checklist_progress(task_id, db)
    return {"success": True}

@router.delete("/{task_id}/checklist/{item_id}")
async def delete_checklist_item(
    task_id: str,
    item_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    await db.tasks.update_one(
        {"_id": ObjectId(task_id), "owner_id": str(current_user.id)},
        {"$pull": {"checklists": {"id": item_id}}}
    )
    await update_checklist_progress(task_id, db)
    return {"success": True}

async def update_checklist_progress(task_id: str, db):
    task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not task: return
    checklists = task.get("checklists", [])
    total = len(checklists)
    completed = sum(1 for item in checklists if item.get("completed"))
    percentage = (completed / total * 100) if total > 0 else 0
    
    await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$set": {
                "checklist_progress": {
                    "total": total,
                    "completed": completed,
                    "percentage": round(percentage, 2)
                }
            }
        }
    )

# --------------------------------------------------------------------------------
# MODULE 3: TIME TRACKING
# --------------------------------------------------------------------------------
from fastapi import Body
@router.post("/{task_id}/log-time")
async def log_time(
    task_id: str,
    hours: float = Body(..., ge=0.1, le=24),
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    result = await db.tasks.update_one(
        {"_id": ObjectId(task_id), "owner_id": str(current_user.id)},
        {
            "$inc": {"logged_hours": hours},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Task not found")
    
    task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return {
        "success": True,
        "logged_hours": task.get("logged_hours", 0),
        "estimated_hours": task.get("estimated_hours", 0),
        "variance": task.get("logged_hours", 0) - task.get("estimated_hours", 0)
    }

@router.get("/analytics/estimation-accuracy")
async def get_estimation_accuracy(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    
    match_query = {
        "owner_id": str(current_user.id),
        "status": "COMPLETED",
        "estimated_hours": {"$gt": 0}
    }
    if project_id and project_id != "ALL":
        match_query["project_id"] = project_id
        
    pipeline = [
        {
            "$match": match_query
        },
        {
            "$project": {
                "title": 1,
                "estimated_hours": 1,
                "logged_hours": 1,
                "variance": {"$subtract": ["$logged_hours", "$estimated_hours"]},
                "variance_percent": {
                    "$multiply": [
                        {
                            "$divide": [
                                {"$subtract": ["$logged_hours", "$estimated_hours"]},
                                "$estimated_hours"
                            ]
                        },
                        100
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "total_tasks": {"$sum": 1},
                "avg_variance_percent": {"$avg": "$variance_percent"},
                "total_estimated": {"$sum": "$estimated_hours"},
                "total_logged": {"$sum": "$logged_hours"},
                "tasks": {"$push": "$$ROOT"}
            }
        }
    ]
    
    result = await db.tasks.aggregate(pipeline).to_list(length=1)
    
    if not result:
        return {
            "total_tasks": 0,
            "avg_variance_percent": 0,
            "accuracy_rating": "No data",
            "tasks": []
        }
    
    data = result[0]
    variance = data["avg_variance_percent"]
    
    accuracy_rating = (
        "Excellent" if abs(variance) < 10 else
        "Good" if abs(variance) < 25 else
        "Fair" if abs(variance) < 50 else
        "Poor"
    )
    
    return {
        "total_tasks": data["total_tasks"],
        "total_estimated_hours": round(data["total_estimated"], 2),
        "total_logged_hours": round(data["total_logged"], 2),
        "avg_variance_percent": round(variance, 2),
        "accuracy_rating": accuracy_rating,
        "most_underestimated": sorted(data["tasks"], key=lambda x: x["variance_percent"], reverse=True)[:5],
        "most_overestimated": sorted(data["tasks"], key=lambda x: x["variance_percent"])[:5]
    }
