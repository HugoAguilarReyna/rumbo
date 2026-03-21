
import asyncio
import sys
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Ensure we can import 'app' module by adding current directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def debug_db():
    load_dotenv()
    print("Connecting to DB...")
    # Fix: Use MONGO_URL which is what is in .env
    mongo_url = os.getenv("MONGO_URL", os.getenv("MONGODB_URL", "mongodb://localhost:27017"))
    print(f"Using MONGO_URL: {mongo_url[:20]}...") 
    print(f"Using MONGO_URL: {mongo_url[:20]}...") 
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.getenv("DB_NAME", "PM_BD1")
    print(f"Using DB_NAME: {db_name}")
    db = client[db_name]
    
    # List Users
    users = await db.users.find().to_list(length=100)
    print(f"Total Users: {len(users)}")
    for u in users:
        print(f"User: {u.get('username')} (ID: {u.get('_id')})")

    # List Tasks
    tasks = await db.tasks.find().to_list(length=1000)
    print(f"Total Tasks: {len(tasks)}")
    
    active_tasks = [t for t in tasks if t.get("status") != "completed"]
    print(f"Active Tasks: {len(active_tasks)}")

    for t in active_tasks[:5]:
        print(f"Task: {t.get('title')}, Owner: {t.get('owner_id')}, Status: {t.get('status')}, Audit: {t.get('ai_audit') is not None}")

if __name__ == "__main__":
    asyncio.run(debug_db())
