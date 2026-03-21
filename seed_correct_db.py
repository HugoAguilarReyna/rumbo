import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from datetime import datetime

TARGET_NAMES = [
    "John Doe",
    "David Kim",
    "Michael Rodriguez",
    "Sarah Chen",
    "Lisa Anderson",
    "Emily Watson",
    "demo"
]

async def seed_correct():
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    print(f"Connected to Correct DB: {settings.DB_NAME}")
    
    # 1. Get correct owner_id for 'demo'
    user = await db.users.find_one({"username": "demo"})
    if not user:
        print("User 'demo' not found in PM_BD1! Creating it...")
        # Create demo user if missing in this DB
        user_res = await db.users.insert_one({
            "username": "demo",
            "email": "demo@example.com",
            "hashed_password": "fake_hash_for_dev",
            "role": "admin",
            "disabled": False
        })
        owner_id = str(user_res.inserted_id)
    else:
        owner_id = str(user["_id"])
        
    print(f"Target Owner ID: {owner_id}")
    
    # 2. Clear existing talents for this owner to avoid duplicates
    await db.talents.delete_many({"owner_id": owner_id})
    print("Cleared existing talents for this owner.")
    
    # 3. Insert Talents
    for name in TARGET_NAMES:
        talent = {
            "name": name,
            "email": f"{name.lower().replace(' ', '.')}@example.com",
            "specialty": "General",
            "seniority": "Mid",
            "hourly_rate": 50.0,
            "status": "ACTIVE",
            "owner_id": owner_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db.talents.insert_one(talent)
        print(f"Inserted: {name}")
        
    # 4. Verify
    count = await db.talents.count_documents({"owner_id": owner_id})
    print(f"Total Talents in {settings.DB_NAME} for {owner_id}: {count}")

if __name__ == "__main__":
    asyncio.run(seed_correct())
