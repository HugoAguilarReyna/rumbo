from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, BeforeValidator
from typing import Annotated

from app.utils.dependencies import get_current_user
from app.core.database import get_database
from app.models.user import UserResponse

router = APIRouter(prefix="/projects", tags=["projects"])

# --------------------------------------------------------------------------------
# SCHEMAS (Defined in router as requested)
# --------------------------------------------------------------------------------

PyObjectId = Annotated[str, BeforeValidator(str)]

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: PyObjectId = Field(alias="_id")
    owner_id: str
    created_at: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

# --------------------------------------------------------------------------------
# ENDPOINTS
# --------------------------------------------------------------------------------

@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    query = {"owner_id": str(current_user.id)}
    cursor = db.projects.find(query).sort("created_at", -1)
    projects = await cursor.to_list(length=100)
    # Convert _id to string for Pydantic if necessary (though Response handles it via alias)
    return projects

@router.post("/", response_model=ProjectResponse)
async def create_project(
    project: ProjectCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    
    # Check if project name exists for this user
    existing = await db.projects.find_one({
        "owner_id": str(current_user.id),
        "name": project.name
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Project with this name already exists")
    
    project_dict = project.model_dump()
    project_dict.update({
        "owner_id": str(current_user.id),
        "created_at": datetime.utcnow()
    })
    
    result = await db.projects.insert_one(project_dict)
    created_project = await db.projects.find_one({"_id": result.inserted_id})
    return created_project

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    try:
        project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": str(current_user.id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid Project ID")
        
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project_full(
    project_id: str,
    project_update: ProjectUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    existing = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": str(current_user.id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")
        
    update_data = project_update.model_dump(exclude_unset=True)
    if not update_data:
        return existing
        
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": update_data}
    )
    
    updated_project = await db.projects.find_one({"_id": ObjectId(project_id)})
    return updated_project

@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    cascade: bool = Query(False, description="Whether to delete all associated tasks"),
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    
    # Verify ownership
    project = await db.projects.find_one({"_id": ObjectId(project_id), "owner_id": str(current_user.id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Delete project
    await db.projects.delete_one({"_id": ObjectId(project_id)})
    
    # Handle associated tasks
    if cascade:
        # Delete tasks
        result = await db.tasks.delete_many({"project_id": project_id})
        action = f"deleted {result.deleted_count} tasks"
    else:
        # Unlink tasks
        await db.tasks.update_many(
            {"project_id": project_id},
            {"$set": {"project_id": None}}
        )
        action = "unlinked tasks"
    
    return {"status": "success", "message": f"Project deleted and {action}"}

@router.get("/{project_id}/tasks")
async def get_project_tasks(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    # No response_model here to avoid circular imports or redefining Task schemas
    # We'll just return the raw docs (with mapping if needed)
    cursor = db.tasks.find({"project_id": project_id, "owner_id": str(current_user.id)})
    tasks = await cursor.to_list(length=1000)
    
    # Basic mapping title -> task_name for consistency
    result = []
    for t in tasks:
        t["id"] = str(t["_id"])
        if "title" in t:
            t["task_name"] = t.pop("title")
        del t["_id"]
        result.append(t)
        
    return result

@router.get("/stats/overview")
async def get_projects_stats_overview(
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    owner_id = str(current_user.id)
    
    # Count projects
    total_projects = await db.projects.count_documents({"owner_id": owner_id})
    
    # Count tasks by status across all user's projects
    pipeline = [
        {"$match": {"owner_id": owner_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    cursor = db.tasks.aggregate(pipeline)
    task_stats = await cursor.to_list(length=100)
    
    return {
        "total_projects": total_projects,
        "task_distribution": {r["_id"]: r["count"] for r in task_stats}
    }
