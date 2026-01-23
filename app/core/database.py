from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]

def get_database():
    return db

async def create_indexes():
    # Users collection
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email", unique=True)
    
    # Tasks collection
    await db.tasks.create_index("owner_id")
    await db.tasks.create_index([("owner_id", 1), ("status", 1)])
    await db.tasks.create_index([("owner_id", 1), ("due_date", 1)])
