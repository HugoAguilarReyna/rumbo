import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def list_all():
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    
    print(f"Connected to DB: {settings.DB_NAME}")
    
    count = await db.talents.count_documents({})
    print(f"Total Talents in DB: {count}")
    
    cursor = db.talents.find({})
    async for t in cursor:
        print(f"Talent: {t.get('name')}, Owner: {t.get('owner_id')}, ID: {t.get('_id')}")

if __name__ == "__main__":
    asyncio.run(list_all())
