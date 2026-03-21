import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timedelta

# Use same password context as the server
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

MONGO_URL = "mongodb+srv://aguilarhugo55_db_user:c5mfG11QT68ib4my@clusteract1.kpdhd5e.mongodb.net/?retryWrites=true&w=majority&appName=ClusterAct1"
DB_NAME = "PM_BD1"

async def recreate_demo_user():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Delete existing demo user if exists
        result = await db.users.delete_one({"username": "demo"})
        if result.deleted_count > 0:
            print("🗑️  Deleted existing demo user")
        
        # Create demo user with correct hash format (pbkdf2_sha256)
        user_data = {
            "username": "demo",
            "email": "demo@test.com",
            "full_name": "Demo User",
            "role": "admin",
            "hashed_password": pwd_context.hash("demo123"),  # Using correct hashing
            "email_verified": True,
            "disabled": False,
            "verification_token": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        user_result = await db.users.insert_one(user_data)
        user_id = str(user_result.inserted_id)
        print(f"✅ Demo user created with pbkdf2_sha256 hash!")
        print(f"   User ID: {user_id}")
        
        # Verify the hash works
        if pwd_context.verify("demo123", user_data["hashed_password"]):
            print("✅ Password verification test passed!")
        else:
            print("❌ Password verification test failed!")
            
        # Create Sample Project
        # First delete existing projects for this user to avoid clutter
        await db.projects.delete_many({"owner_id": user_id})
        
        project_data = {
            "name": "Proyecto Alpha",
            "description": "Proyecto de demostración para el Dashboard AI",
            "owner_id": user_id,
            "status": "active",
            "budget": 50000,
            "start_date": datetime.utcnow() - timedelta(days=10),
            "end_date": datetime.utcnow() + timedelta(days=30),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        project_result = await db.projects.insert_one(project_data)
        project_id = str(project_result.inserted_id)
        print(f"✅ Created demo project: {project_id}")
        
        # Create sample tasks
        # We need enough tasks to populate charts
        tasks = [
            {
                "owner_id": user_id,
                "title": "Implementar Sistema de Login",
                "description": "Desarrollar autenticación JWT con refresh tokens",
                "status": "COMPLETED",
                "priority": "HIGH",
                "project_id": project_id,
                "project_name": "Proyecto Alpha",
                "assigned_to": "demo",
                "estimated_hours": 8,
                "logged_hours": 7.5,
                "start_date": datetime.utcnow() - timedelta(days=5),
                "due_date": datetime.utcnow() - timedelta(days=2),
                "completed_at": datetime.utcnow() - timedelta(days=2),
                "created_at": datetime.utcnow() - timedelta(days=7),
                "updated_at": datetime.utcnow()
            },
            {
                "owner_id": user_id,
                "title": "Dashboard de Métricas",
                "description": "Crear visualizaciones de KPIs y gráficos con Chart.js",
                "status": "IN_PROGRESS",
                "priority": "HIGH",
                "project_id": project_id,
                "project_name": "Proyecto Alpha",
                "assigned_to": "demo",
                "estimated_hours": 12,
                "logged_hours": 6,
                "start_date": datetime.utcnow() - timedelta(days=2),
                "due_date": datetime.utcnow() + timedelta(days=5),
                "created_at": datetime.utcnow() - timedelta(days=3),
                "updated_at": datetime.utcnow()
            },
            {
                "owner_id": user_id,
                "title": "Documentación API",
                "description": "Documentar endpoints REST con Swagger/OpenAPI",
                "status": "PENDING",
                "priority": "MEDIUM",
                "project_id": project_id,
                "project_name": "Proyecto Alpha",
                "assigned_to": "demo",
                "estimated_hours": 6,
                "logged_hours": 0,
                "start_date": datetime.utcnow() + timedelta(days=1),
                "due_date": datetime.utcnow() + timedelta(days=3),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "owner_id": user_id,
                "title": "Pruebas de Integración",
                "description": "Escribir tests para endpoints críticos",
                "status": "BLOCKED",
                "priority": "HIGH",
                "project_id": project_id,
                "project_name": "Proyecto Alpha",
                "assigned_to": "demo",
                "estimated_hours": 4,
                "logged_hours": 1,
                "start_date": datetime.utcnow() - timedelta(days=1),
                "due_date": datetime.utcnow() + timedelta(days=2),
                "created_at": datetime.utcnow() - timedelta(days=1),
                "updated_at": datetime.utcnow()
            }
        ]
        
        # Clear existing tasks for this user
        await db.tasks.delete_many({"owner_id": user_id})
        
        # Insert tasks
        result = await db.tasks.insert_many(tasks)
        print(f"✅ Created {len(tasks)} sample tasks")
        
        print("\n📋 Credentials:")
        print("   Username: demo")
        print("   Password: demo123")
        print("   Email: demo@test.com")
        
        print("\n🚀 You can now login at: http://localhost:8000/static/pages/login.html")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(recreate_demo_user())
