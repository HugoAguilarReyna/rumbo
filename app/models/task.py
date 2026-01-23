from pydantic import BaseModel, Field, BeforeValidator
from typing import Optional, List, Annotated
from datetime import datetime
from enum import Enum
from bson import ObjectId

# Custom type to convert ObjectId to str
PyObjectId = Annotated[str, BeforeValidator(str)]

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"
    ON_HOLD = "ON_HOLD"

class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: Optional[str] = None # Link to Project
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.MEDIUM
    assigned_to: Optional[str] = None
    estimated_hours: float = 0.0
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    tags: List[str] = []

class TaskCreate(TaskBase):
    pass

class TaskUpdate(TaskBase):
    pass

class TaskInDB(TaskBase):
    owner_id: str
    completed_at: Optional[datetime] = None
    logged_hours: float = 0.0
    capacity_validated: bool = True
    capacity_warnings: List[str] = []
    
    checklists: List[dict] = []
    checklist_progress: dict = {"total": 0, "completed": 0, "percentage": 0}
    
    attachments: List[dict] = []
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

class TaskResponse(TaskInDB):
    id: PyObjectId = Field(alias="_id")

    @classmethod
    def model_validate(cls, obj):
        # Convert ObjectId to string before validation
        if isinstance(obj, dict) and "_id" in obj:
            obj["_id"] = str(obj["_id"])
        return super().model_validate(obj)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
