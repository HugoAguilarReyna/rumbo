import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "PM_BD1")

async def populate_talents():
    print(f"Connecting to {MONGO_URL}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    users = await db.users.find().to_list(length=100)
    print(f"Found {len(users)} users.")
    
    default_talents = [
        {
            "name": "Ana García",
            "email": "ana.garcia@example.com",
            "specialty": "Frontend Developer",
            "seniority": "Senior",
            "hourly_rate": 45.0,
            "status": "ACTIVE"
        },
        {
            "name": "Carlos López",
            "email": "carlos.lopez@example.com",
            "specialty": "Backend Developer",
            "seniority": "Mid",
            "hourly_rate": 35.0,
            "status": "ACTIVE"
        },
        {
            "name": "María Rodríguez",
            "email": "maria.rodriguez@example.com",
            "specialty": "UX/UI Designer",
            "seniority": "Senior",
            "hourly_rate": 50.0,
            "status": "ACTIVE"
        },
        {
            "name": "Juan Pérez",
            "email": "juan.perez@example.com",
            "specialty": "QA Engineer",
            "seniority": "Junior",
            "hourly_rate": 25.0,
            "status": "ACTIVE"
        }
    ]
    
    for user in users:
        user_id = str(user["_id"])
        username = user.get("username", "Unknown")
        
        # Check if user already has talents
        count = await db.talents.count_documents({"owner_id": user_id})
        if count > 0:
            print(f"User {username} already has {count} talents. Skipping.")
            continue
            
        print(f"Adding default talents for user {username} ({user_id})...")
        
        new_talents = []
        for t in default_talents:
            talent = t.copy()
            talent["owner_id"] = user_id
            talent["created_at"] = datetime.utcnow()
            talent["updated_at"] = datetime.utcnow()
            # Ensure unique email per owner by appending user_id prefix if needed, 
            # but for demo simplicity, we'll just append random chars or use the base.
            # actually, schema enforces uniqueness per owner.
            # Let's simple append the user's id to email to make it unique broadly if needed,
            # but logic says per owner.
            
            new_talents.append(talent)
            
        if new_talents:
            await db.talents.insert_many(new_talents)
            print(f"  Added {len(new_talents)} talents.")
            
    print("Done.")

if __name__ == "__main__":
    asyncio.run(populate_talents())
