
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Load env vars manually or just assume/hardcode for debug
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "pm_dashboard")

async def check_talents():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"Connected to {DB_NAME}")
    
    count = await db.talents.count_documents({})
    print(f"Talents count: {count}")
    
    async for t in db.talents.find():
        print(f" - {t.get('name')} ({t.get('email')})")

    client.close()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(check_talents())
