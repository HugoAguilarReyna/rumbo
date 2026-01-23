from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class ChecklistItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str = Field(..., min_length=1, max_length=200)
    completed: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    order: int = 0

class ChecklistCreate(BaseModel):
    text: str

class ChecklistUpdate(BaseModel):
    completed: bool
