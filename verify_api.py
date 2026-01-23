
import requests
import io

API_URL = "http://localhost:8000/api"

# 0. Register (just in case)
try:
    print("Registering user...")
    reg_res = requests.post(f"{API_URL}/auth/register", json={
        "email": "testuser_debug@example.com",
        "username": "testuser_debug",
        "password": "password123",
        "full_name": "Debug User"
    })
    print(f"Registration: {reg_res.status_code}")
except:
    pass

# 1. Login to get token
try:
    print(f"Logging in to {API_URL}...")
    login_res = requests.post(f"{API_URL}/auth/login", data={"username": "testuser_debug", "password": "password123"})
    print(f"Login Status: {login_res.status_code}")
    if login_res.status_code != 200:
        print("Login failed:", login_res.text)
        exit(1)
    
    token = login_res.json()["access_token"]
    print("Login successful.")
except Exception as e:
    print(f"FAILED to connect to API: {e}")
    exit(1)

# 2. Upload CSV
csv_content = """
"Title,Description,Status,Priority,Assigned To,Estimated Hours,Start Date,Due Date,Tags"
"Test Task From Script,Description here,PENDING,MEDIUM,Me,10,2024-01-01,2024-02-01,tag1"
""".strip()

files = {'file': ('test.csv', csv_content, 'text/csv')}
headers = {'Authorization': f'Bearer {token}'}

print("\nUploading CSV...")
try:
    res = requests.post(f"{API_URL}/tasks/upload-csv", files=files, headers=headers)
    print(f"Upload Status: {res.status_code}")
    print(f"Upload Response: {res.text}")
except Exception as e:
    print(f"Upload Request FAILED: {e}")
