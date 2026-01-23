
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
import sys

# Constants
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "PM_BD1"

import requests

async def verify_ingestion():
    print("--> Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    # 0. Ingest Data
    print("\n[0] Ingesting Data via API...")
    API_URL = "http://localhost:8080/api"
    
    # Register/Login first
    username = "ingest_test"
    password = "password123"
    try:
        requests.post(f"{API_URL}/auth/register", json={
            "email": "ingest_test@example.com",
            "username": username,
            "password": password,
            "full_name": "Ingestion Verify User"
        })
    except:
        pass
        
    login_res = requests.post(f"{API_URL}/auth/login", data={"username": username, "password": password})
    if login_res.status_code != 200:
        print(f"    [FAIL] Login failed: {login_res.text}")
        return
        
    token = login_res.json()["access_token"]
    headers = {'Authorization': f'Bearer {token}'}
    
    # Read CSV
    try:
        with open('data/project_tasks_sample.csv', 'rb') as f:
            files = {'file': ('project_tasks_sample.csv', f, 'text/csv')}
            res = requests.post(f"{API_URL}/tasks/upload-csv", files=files, headers=headers)
            print(f"    Upload Status: {res.status_code}")
            if res.status_code == 200:
                print(f"    [SUCCESS] Ingestion Response: {res.json()}")
            else:
                print(f"    [FAIL] Ingestion Failed: {res.text}")
    except FileNotFoundError:
        print("    [ERROR] CSV file not found at data/project_tasks_sample.csv")
        return
    
    # 1. Verify Project Creation
    print("\n[1] Verifying Project Creation...")
    projects_count = await db.projects.count_documents({})
    print(f"    Total Projects found: {projects_count}")
    
    # Check for "Project-1" (This depends on what's in the CSV, assuming 'Project Name' column exists)
    # We will just list them
    async for p in db.projects.find({}):
        print(f"    - Project Found: {p.get('name')} (ID: {p.get('_id')})")
        
    if projects_count == 0:
        print("    [ERROR] No projects found. Ingestion might have failed.")
    
    # 2. Verify Linking
    print("\n[2] Verifying Task Linking...")
    tasks_count = await db.tasks.count_documents({})
    print(f"    Total Tasks found: {tasks_count}")
    
    linked_tasks = await db.tasks.count_documents({"project_id": {"$exists": True, "$ne": None}})
    print(f"    Tasks with project_id: {linked_tasks}")
    
    if linked_tasks < tasks_count:
        print(f"    [WARNING] {tasks_count - linked_tasks} tasks are missing project_id linking.")
    else:
        print("    [PASS] All tasks appear to have project linkage.")

    # 3. Verify Data Mapping
    print("\n[3] Verifying Data Mapping...")
    sample_task = await db.tasks.find_one({})
    if sample_task:
        print(f"    Sample Task: {sample_task.get('title')}")
        
        # Date check
        due_date = sample_task.get('due_date')
        print(f"    - Due Date: {due_date} (Type: {type(due_date)})")
        if not hasattr(due_date, 'year'):
             print("    [FAIL] Date is not a datetime object.")
        else:
             print("    [PASS] Date is a datetime object.")
             
        # Status check
        status = sample_task.get('status')
        print(f"    - Status: {status}")
        
        # Owner check
        owner = sample_task.get('owner_id')
        print(f"    - Owner ID: {owner}")
    else:
        print("    [ERROR] No tasks to verify mapping.")

    print("\nResult Summary:")
    print(f"Projects: {projects_count}")
    print(f"Tasks: {tasks_count}")
    
    client.close()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_ingestion())
