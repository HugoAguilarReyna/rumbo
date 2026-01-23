from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core import config, database
from app.routers import auth, users, tasks, analytics
from datetime import datetime
import traceback
from app.core.database import get_database



app = FastAPI(title="Antigravity PM Dashboard", version="1.0.0")

# CORS
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Global Exception: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server Crash: {str(exc)}", "trace": traceback.format_exc()},
    )

# Startup
@app.on_event("startup")
async def startup_db_client():
    await database.create_indexes()
    
    # DB Migration for Enterprise Features
    db = database.get_database()
    
    # 1. Update existing tasks with new fields if missing
    await db.tasks.update_many(
        {"logged_hours": {"$exists": False}}, 
        {"$set": {
            "logged_hours": 0.0,
            "capacity_validated": True,
            "capacity_warnings": [],
            "checklists": [],
            "checklist_progress": {"total": 0, "completed": 0, "percentage": 0},
            "attachments": []
        }}
    )

    # 1.5 Update existing users with new fields if missing
    await db.users.update_many(
        {"role": {"$exists": False}}, 
        {"$set": {
            "role": "user",
            "email_verified": False,
            "created_at": datetime.utcnow(),
            "daily_capacity": 8.0,
            "weekly_capacity": 40.0
        }}
    )
    
    # 2. Ensure collections exist
    try:
        await db.create_collection("notes")
    except:
        pass
        
    try:
        await db.create_collection("notifications")
    except:
        pass

@app.on_event("shutdown")
async def shutdown_db_client():
    database.client.close()

# Include Routers
# Note: Import at top handled via string if lazy, but here we need imports.
# We need to import them first.
from app.routers import notes, files, notifications

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")

# New Routers
app.include_router(notes.router) # Prefix defined in router
app.include_router(files.router) # Prefix defined in router
app.include_router(notifications.router, prefix="/api")

# Static Files (for local testing without Nginx, though Nginx is preferred)
# In production content, Nginx handles / but for debugging we can mount it too
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/api/system/status")
async def system_status():
    return {"status": "online", "version": "1.0.0"}

@app.get("/api/debug/health")
async def health_check():
    try:
        db = get_database()
        # Test MongoDB connection
        await db.command("ping")
        
        # Count collections
        collections = await db.list_collection_names()
        
        # Sample data from each collection - lightweight count
        stats = {}
        for coll_name in collections:
            count = await db[coll_name].count_documents({})
            stats[coll_name] = count
        
        return {
            "status": "healthy",
            "database": "connected",
            "collections": stats,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Health Check Failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

