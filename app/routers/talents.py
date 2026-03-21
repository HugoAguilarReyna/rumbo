from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, EmailStr, BeforeValidator
from typing import Annotated

from app.utils.dependencies import get_current_user
from app.core.database import get_database
from app.models.user import UserResponse

router = APIRouter(prefix="/talents", tags=["talents"])

# --------------------------------------------------------------------------------
# SCHEMAS (Defined in router as requested)
# --------------------------------------------------------------------------------

PyObjectId = Annotated[str, BeforeValidator(str)]

class TalentBase(BaseModel):
    name: str
    email: EmailStr
    specialty: str
    seniority: str = "Mid"
    hourly_rate: Optional[float] = None
    status: str = "ACTIVE"

class TalentCreate(TalentBase):
    pass

class TalentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    specialty: Optional[str] = None
    seniority: Optional[str] = None
    hourly_rate: Optional[float] = None
    status: Optional[str] = None

class TalentResponse(TalentBase):
    id: PyObjectId = Field(alias="_id")
    owner_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

# --------------------------------------------------------------------------------
# ENDPOINTS
# --------------------------------------------------------------------------------

@router.get("/", response_model=List[TalentResponse])
async def list_talents(
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    owner_query = str(current_user.id)
    cursor = db.talents.find({"owner_id": owner_query})
    talents = await cursor.to_list(length=100)
    return talents

@router.post("/", response_model=TalentResponse)
async def create_talent(
    talent: TalentCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    
    # Check email uniqueness for this owner
    existing = await db.talents.find_one({
        "owner_id": str(current_user.id),
        "email": talent.email
    })
    if existing:
        raise HTTPException(status_code=400, detail="Talent with this email already exists")
    
    talent_dict = talent.model_dump()
    talent_dict.update({
        "owner_id": str(current_user.id),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    result = await db.talents.insert_one(talent_dict)
    created = await db.talents.find_one({"_id": result.inserted_id})
    return created

@router.get("/{talent_id}", response_model=TalentResponse)
async def get_talent(
    talent_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    talent = await db.talents.find_one({"_id": ObjectId(talent_id), "owner_id": str(current_user.id)})
    if not talent:
        raise HTTPException(status_code=404, detail="Talent not found")
    return talent

@router.put("/{talent_id}", response_model=TalentResponse)
async def update_talent(
    talent_id: str,
    talent_update: TalentUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    existing = await db.talents.find_one({"_id": ObjectId(talent_id), "owner_id": str(current_user.id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Talent not found")
    
    update_data = talent_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    await db.talents.update_one({"_id": ObjectId(talent_id)}, {"$set": update_data})
    return await db.talents.find_one({"_id": ObjectId(talent_id)})

@router.delete("/{talent_id}")
async def delete_talent(
    talent_id: str,
    reassign_to: Optional[str] = Query(None, description="Talent username to reassign tasks to"),
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    talent = await db.talents.find_one({"_id": ObjectId(talent_id), "owner_id": str(current_user.id)})
    if not talent:
        raise HTTPException(status_code=404, detail="Talent not found")
    
    talent_name = talent["name"]
    
    # Reassign tasks if requested
    if reassign_to:
        await db.tasks.update_many(
            {"assigned_to": talent_name, "owner_id": str(current_user.id)},
            {"$set": {"assigned_to": reassign_to}}
        )
    else:
        # Just unassign
        await db.tasks.update_many(
            {"assigned_to": talent_name, "owner_id": str(current_user.id)},
            {"$set": {"assigned_to": None}}
        )
        
    await db.talents.delete_one({"_id": ObjectId(talent_id)})
    return {"status": "success", "message": f"Talent {talent_name} deleted"}

@router.get("/stats/workload")
async def get_talents_workload(
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    owner_id = str(current_user.id)
    
    pipeline = [
        {"$match": {"owner_id": owner_id, "status": {"$ne": "COMPLETED"}}},
        {"$group": {
            "_id": "$assigned_to",
            "task_count": {"$sum": 1},
            "total_estimated_hours": {"$sum": "$estimated_hours"}
        }}
    ]
    cursor = db.tasks.aggregate(pipeline)
    workload = await cursor.to_list(length=100)
    
    # Filter out None assigned_to if any
    return [w for w in workload if w["_id"] is not None]

@router.get("/available/list")
async def list_available_talent(
    min_hours: float = Query(0.0),
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    # For now, just return all active talents of the user
    # A real implementation would check capacity vs allocated hours in a period
    cursor = db.talents.find({"owner_id": str(current_user.id), "status": "ACTIVE"})
    return await cursor.to_list(length=100)
