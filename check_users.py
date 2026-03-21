
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "pm_dashboard"

async def check_users():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"Connected to {DB_NAME}")
    
    count = await db.users.count_documents({})
    print(f"Total Users: {count}")
    
    async for user in db.users.find():
        print(f"User: {user.get('username')}, ID: {user.get('_id')}, Type: {type(user.get('_id'))}")

    client.close()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(check_users())
