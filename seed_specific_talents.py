
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "pm_dashboard"

TARGET_NAMES = [
    "John Doe",
    "David Kim",
    "Michael Rodriguez",
    "Sarah Chen",
    "Lisa Anderson",
    "Emily Watson",
    "demo"
]

async def seed_user_talents():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"Connected to {DB_NAME}")

    # Find the 'demo' user to get the ID
    user = await db.users.find_one({"username": "demo"})
    if not user:
        print("User 'demo' not found! Cannot seed.")
        return

    owner_id = str(user["_id"])
    print(f"Seeding for Owner ID: {owner_id}")

    # Clear existing talents for this owner to match the request exactly?
    # Or just upsert. The user said "should show these names".
    # I'll delete others to be clean and match the screenshot expectation.
    await db.talents.delete_many({"owner_id": owner_id})
    print("Cleared existing talents.")

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

    count = await db.talents.count_documents({"owner_id": owner_id})
    print(f"Total Talents for {owner_id}: {count}")
    client.close()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(seed_user_talents())
