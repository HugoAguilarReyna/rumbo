import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

MONGO_URL = "mongodb+srv://aguilarhugo55_db_user:c5mfG11QT68ib4my@clusteract1.kpdhd5e.mongodb.net/?retryWrites=true&w=majority&appName=ClusterAct1"
DB_NAME = "PM_BD1"

async def initialize_database():
    """Initialize database with proper structure and indexes"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔧 Initializing database...")
    
    # Create collections if they don't exist
    collections = await db.list_collection_names()
    
    required_collections = ["users", "tasks", "notes", "notifications"]
    
    for coll in required_collections:
        if coll not in collections:
            await db.create_collection(coll)
            print(f"✅ Created collection: {coll}")
        else:
            print(f"ℹ️  Collection exists: {coll}")
    
    # Create indexes
    print("\n🔧 Creating indexes...")
    
    # Users indexes
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email", unique=True)
    print("✅ User indexes created")
    
    # Tasks indexes
    await db.tasks.create_index("owner_id")
    await db.tasks.create_index([("owner_id", 1), ("status", 1)])
    await db.tasks.create_index([("owner_id", 1), ("due_date", 1)])
    await db.tasks.create_index([("owner_id", 1), ("project_name", 1)])
    print("✅ Task indexes created")
    
    # Update existing tasks with missing fields
    print("\n🔧 Migrating existing data...")
    
    result = await db.tasks.update_many(
        {},
        {
            "$set": {
                "logged_hours": 0.0,
                "capacity_validated": True,
                "capacity_warnings": [],
                "checklists": [],
                "checklist_progress": {"total": 0, "completed": 0, "percentage": 0},
                "attachments": []
            }
        }
    )
    
    print(f"✅ Updated {result.modified_count} tasks with new fields")
    
    # Ensure all tasks have project_name
    tasks_without_project = await db.tasks.count_documents({"project_name": {"$exists": False}})
    if tasks_without_project > 0:
        await db.tasks.update_many(
            {"project_name": {"$exists": False}},
            {"$set": {"project_name": "Default Project"}}
        )
        print(f"✅ Added default project to {tasks_without_project} tasks")
    
    print("\n✅ Database initialization complete!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(initialize_database())
