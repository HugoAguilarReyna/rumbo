import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv

# Load env vars
load_dotenv()
MONGO_URI = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "project_management")

async def verify_audit_logic():
    print(f"Connecting to {MONGO_URI} / {DB_NAME}...")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    # 1. Clean up old dummy tasks
    await db.tasks.delete_many({"is_dummy": True})
    
    # 2. Insert Dummy Tasks
    dummy_tasks = [
        {
            "title": "Configurar Firewall",
            "estimated_hours": 8.0,
            "status": "PENDING",
            "is_dummy": True,
            "seniority": "Senior"
        },
        {
            "title": "Diseñar Login UI",
            "estimated_hours": 12.0,
            "status": "IN_PROGRESS",
            "is_dummy": True,
            "seniority": "Junior"
        },
        {
            "title": "Optimizar Base de Datos",
            "estimated_hours": 4.0,
            "status": "PENDING",
            "is_dummy": True,
            "seniority": "Lead"
        }
    ]
    result = await db.tasks.insert_many(dummy_tasks)
    print(f"Inserted {len(result.inserted_ids)} dummy tasks.")
    
    # 3. Simulate Audit Loop (Logic from audit.py)
    print("Starting Audit Simulation...")
    cursor = db.tasks.find({"is_dummy": True})
    tasks = await cursor.to_list(length=None)
    
    from app.services.audit_service import audit_service
    
    for task in tasks:
        print(f"Auditing: {task.get('title')}")
        
        # Prepare data (Simulating the fix in audit.py)
        task_data = task.copy()
        task_data["task_name"] = task.get("title", "Sin nombre")
        
        # Call Service
        audit_result = audit_service.audit_task(task_data)
        print(f"  -> Risk: {audit_result['risk_level']}")
        print(f"  -> Benchmark: {audit_result['benchmark_hours']}h (vs {task['estimated_hours']}h)")
        
        # Update DB (Async)
        await db.tasks.update_one(
            {"_id": task["_id"]},
            {
                "$set": {
                    "ai_audit": audit_result,
                    "last_audit": datetime.utcnow()
                }
            }
        )
        
    print("Audit Simulation Completed.")
    
    # 4. Verify Updates
    updated_tasks = await db.tasks.find({"is_dummy": True, "ai_audit": {"$exists": True}}).to_list(length=None)
    print(f"Verified {len(updated_tasks)} tasks have 'ai_audit' field.")
    
    # 5. Cleanup
    # await db.tasks.delete_many({"is_dummy": True})
    # print("Cleaned up dummy tasks.")

if __name__ == "__main__":
    asyncio.run(verify_audit_logic())
