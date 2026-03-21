import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "PM_BD1")

async def sync_talents():
    print(f"Connecting to {MONGO_URL}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get all users to process their tasks
    users = await db.users.find().to_list(length=1000)
    
    total_added = 0
    
    for user in users:
        user_id = str(user["_id"])
        username = user.get("username", "Unknown")
        print(f"Processing user: {username}")
        
        # distinct assigned_to strings for this user's tasks
        # MongoDB distinct is easiest, but let's do aggregation to be safe with async driver
        pipeline = [
            {"$match": {"owner_id": user_id, "assigned_to": {"$ne": None}}},
            {"$group": {"_id": "$assigned_to"}},
        ]
        cursor = db.tasks.aggregate(pipeline)
        assigned_names_docs = await cursor.to_list(length=1000)
        assigned_names = [d["_id"] for d in assigned_names_docs if d["_id"]]
        
        print(f"  Found {len(assigned_names)} unique assignees in tasks: {assigned_names}")
        
        for name in assigned_names:
            # Check if talent exists
            existing = await db.talents.find_one({"owner_id": user_id, "name": name})
            if not existing:
                print(f"  Creating missing talent record for: {name}")
                
                # Generate dummy data
                safe_name = name.lower().replace(" ", ".")
                dummy_email = f"{safe_name}@example.com"
                
                new_talent = {
                    "name": name,
                    "email": dummy_email,
                    "specialty": "Imported Resource",
                    "seniority": "Mid",
                    "hourly_rate": 0.0,
                    "status": "ACTIVE",
                    "owner_id": user_id,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                await db.talents.insert_one(new_talent)
                total_added += 1
            else:
                print(f"  Talent {name} already exists.")
                
    print(f"Done. Added {total_added} new talents from existing tasks.")

if __name__ == "__main__":
    asyncio.run(sync_talents())
