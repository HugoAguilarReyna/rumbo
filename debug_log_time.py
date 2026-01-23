
import requests

API_URL = "http://localhost:8080/api"

def debug_500():
    # 1. Login
    username = "debug_user_new"
    password = "password123"
    
    # Register just in case
    try:
        requests.post(f"{API_URL}/auth/register", json={
            "email": "test@test.com",
            "username": username,
            "password": password,
            "full_name": "Test User"
        })
    except: pass

    login_res = requests.post(f"{API_URL}/auth/login", data={"username": username, "password": password})
    if login_res.status_code != 200:
        print(f"Login Failed: {login_res.text}")
        return
    
    token = login_res.json()["access_token"]
    headers = {'Authorization': f'Bearer {token}'}
    print(f"Logged in. Token: {token[:10]}...")

    # 2. Create Task
    task_res = requests.post(f"{API_URL}/tasks/", json={
        "title": "Debug Task",
        "description": "Testing log time",
        "estimated_hours": 5.0,
        "due_date": "2025-01-01T00:00:00"
    }, headers=headers)
    
    if task_res.status_code != 200:
        print(f"Create Task Failed: {task_res.text}")
        with open("debug_error.log", "w") as f:
            f.write(task_res.text)
        return
        
    task_json = task_res.json()
    task_id = task_json.get("id") or task_json.get("_id")
    print(f"Created Task: {task_id}")
    print(f"Full response: {task_json}")

    # 3. Log Time
    print(f"Attempting to log time for {task_id}...")
    # FastAPI Body(...) expects raw value
    res = requests.post(f"{API_URL}/tasks/{task_id}/log-time", 
                       json=1.5,  # Send as raw number
                       headers=headers)
    
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")

if __name__ == "__main__":
    debug_500()
