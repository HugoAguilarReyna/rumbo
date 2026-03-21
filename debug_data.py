
import asyncio
import httpx
from app.core.database import get_database, close_mongo_connection
from app.main import app

# We need to bypass auth or simulate a logged in user for the API call if it requires it.
# However, for direct DB check we can just use the database connection.

async def verify_data():
    db = get_database()
    
    print("--- CHECKING MONGODB TALENTS ---")
    talents_count = await db.talents.count_documents({})
    print(f"Total Talents in DB: {talents_count}")
    
    cursor = db.talents.find({})
    async for talent in cursor:
        print(f"Talent: {talent.get('name')}, Owner: {talent.get('owner_id')}")

    print("\n--- CHECKING API ENDPOINTS (Simulated) ---")
    # We will simulate a request to the local running server if possible, 
    # but since we are inside the env, we can just trust the DB check for talents 
    # and the code check for the static list in audit.py.
    
    # Check Valdes-Souto endpoint logic directly by importing if needed, 
    # or just trust the previous file view which showed the hardcoded list.
    from app.routers.audit import get_valdes_souto_tasks
    vs_tasks = await get_valdes_souto_tasks()
    print(f"Valdes-Souto Tasks response: {vs_tasks}")

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(verify_data())
