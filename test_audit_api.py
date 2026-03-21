
import requests
import sys

BASE_URL = "http://localhost:8000/api"

def login(username, password):
    try:
        data = {"username": username, "password": password}
        # Assuming OAuth2 form data
        response = requests.post(f"{BASE_URL}/auth/token", data=data) 
        if response.status_code == 200:
            return response.json().get("access_token")
        else:
            print(f"Login failed: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print(f"Connection failed: {e}")
        return None

def test_audit_flow(token):
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n1. Testing /audit/batch...")
    r = requests.post(f"{BASE_URL}/audit/batch", headers=headers)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text[:200]}...") # Print first 200 items
    
    if r.status_code == 200:
        data = r.json()
        print(f"Tasks Audited: {data.get('tasks_audited')}")
    
    print("\n2. Testing /audit/health-score...")
    r = requests.get(f"{BASE_URL}/audit/health-score", headers=headers)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text}")

    print("\n3. Testing /audit/tasks-with-audit...")
    r = requests.get(f"{BASE_URL}/audit/tasks-with-audit", headers=headers)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text[:200]}...")

if __name__ == "__main__":
    print("Testing with 'admin' user...")
    token = login("admin", "admin123")
    if token:
        test_audit_flow(token)
    else:
        print("Skipping tests due to login failure.")
