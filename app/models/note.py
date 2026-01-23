from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from bson import ObjectId

class NoteCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    category: Literal["INFO", "RISK", "BLOCKER", "QUESTION"] = "INFO"

class NoteUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class NoteResponse(BaseModel):
    id: str = Field(alias="_id")
    task_id: str
    author_id: str
    author_name: str
    content: str
    category: str
    created_at: datetime
    updated_at: datetime
    edited: bool
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
