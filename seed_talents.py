
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "pm_dashboard"

SAMPLE_TALENTS = [
    {
        "name": "Ana García",
        "email": "ana.garcia@example.com",
        "specialty": "Frontend Developer",
        "seniority": "Senior",
        "hourly_rate": 45.0,
        "status": "ACTIVE",
        "owner_id": "google-oauth2|101262078638426002759"  # Matches current user from previous context or generic
    },
    {
        "name": "Carlos Ruiz",
        "email": "carlos.ruiz@example.com",
        "specialty": "Backend Developer",
        "seniority": "Mid",
        "hourly_rate": 35.0,
        "status": "ACTIVE",
        "owner_id": "google-oauth2|101262078638426002759"
    },
    {
        "name": "Elena Torres",
        "email": "elena.torres@example.com",
        "specialty": "UX/UI Designer",
        "seniority": "Senior",
        "hourly_rate": 50.0,
        "status": "ACTIVE",
        "owner_id": "google-oauth2|101262078638426002759"
    },
    {
        "name": "David Kim",
        "email": "david.kim@example.com",
        "specialty": "DevOps Engineer",
        "seniority": "mid",
        "hourly_rate": 40.0,
        "status": "ACTIVE",
        "owner_id": "google-oauth2|101262078638426002759"
    }
]

async def seed_talents():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"Connected to {DB_NAME}")

    # Check for existing user to attach talents to, or use the hardcoded one
    # ideally we find the first user
    user = await db.users.find_one({})
    owner_id = str(user["_id"]) if user else "google-oauth2|101262078638426002759"
    print(f"Using Owner ID: {owner_id}")

    for talent in SAMPLE_TALENTS:
        talent["owner_id"] = owner_id
        talent["created_at"] = datetime.utcnow()
        talent["updated_at"] = datetime.utcnow()
        
        # Upsert by email per owner
        await db.talents.update_one(
            {"email": talent["email"], "owner_id": owner_id},
            {"$set": talent},
            upsert=True
        )
        print(f"Seeded: {talent['name']}")

    count = await db.talents.count_documents({})
    print(f"Total Talents: {count}")
    client.close()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(seed_talents())
