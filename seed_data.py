
import asyncio
import sys
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# Ensure we can import 'app' module by adding current directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_db():
    load_dotenv()
    print("Connecting to DB...")
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017"))
    db = client.project_management
    
    # Check if user exists
    existing_user = await db.users.find_one({"username": "admin"})
    if not existing_user:
        print("Creating admin user...")
        user_data = {
            "username": "admin",
            "email": "admin@example.com",
            "full_name": "Admin User",
            "hashed_password": pwd_context.hash("admin123"),
            "role": "admin",
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        result = await db.users.insert_one(user_data)
        user_id = str(result.inserted_id)
        print(f"User created with ID: {user_id}")
    else:
        user_id = str(existing_user["_id"])
        print(f"User already exists: {user_id}")

    # Check if tasks exist
    task_count = await db.tasks.count_documents({})
    if task_count == 0:
        print("Creating sample tasks...")
        tasks = [
            {
                "title": "Implementar Autenticación OAuth2",
                "description": "Configurar login con Google y GitHub",
                "status": "pending",
                "priority": "HIGH",
                "estimated_hours": 16,
                "owner_id": user_id,
                "project_id": "PROJECT-001",
                "created_at": datetime.utcnow()
            },
            {
                "title": "Diseñar Dashboard Principal",
                "description": "Crear vista de resumen con gráficos KPI",
                "status": "in_progress",
                "priority": "CRITICAL",
                "estimated_hours": 24,
                "owner_id": user_id,
                "project_id": "PROJECT-001",
                "created_at": datetime.utcnow()
            },
            {
                "title": "Optimizar Consultas MongoDB",
                "description": "Crear índices para mejorar performance de búsqueda",
                "status": "pending",
                "priority": "MEDIUM",
                "estimated_hours": 8,
                "owner_id": user_id,
                "project_id": "PROJECT-001",
                "created_at": datetime.utcnow()
            },
             {
                "title": "Escribir Documentación API",
                "description": "Documentar endpoints con Swagger/OpenAPI",
                "status": "completed",
                "priority": "LOW",
                "estimated_hours": 4,
                "owner_id": user_id,
                "project_id": "PROJECT-001",
                "created_at": datetime.utcnow()
            }
        ]
        await db.tasks.insert_many(tasks)
        print(f"Created {len(tasks)} sample tasks.")
    else:
        print(f"Tasks already exist: {task_count}")

if __name__ == "__main__":
    asyncio.run(seed_db())
