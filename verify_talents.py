
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "pm_dashboard"

async def verify_ownership():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # We expect owner_id to be the ObjectId of the user 'demo'
    user = await db.users.find_one({"username": "demo"})
    expected_owner_id = str(user["_id"])
    print(f"Target Owner ID: {expected_owner_id}")
    
    async for t in db.talents.find():
        print(f"Talent: {t['name']}, Owner: {t.get('owner_id')} (Match: {t.get('owner_id') == expected_owner_id})")

    client.close()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(verify_ownership())
