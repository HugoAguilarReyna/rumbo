import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def get_token():
    print("Logging in...")
    try:
        # Assuming standard OAuth2 login form or JSON login
        # Based on create_demo_user.py, likely username/password
        # Trying JSON login first, common in FastAPI
        print(f"Attempting login to {BASE_URL}/auth/token with username='demo' password='demo123'")
        resp = requests.post(f"{BASE_URL}/auth/token", data={"username": "demo", "password": "demo123"})
        print(f"Login Response: {resp.status_code}")

        if resp.status_code == 200:
            print("Login successful (token endpoint)!")
            return resp.json()["access_token"]
            
        print(f"Login failed on /token: {resp.status_code}")

        # Try Form Data on /login (Correct one likely)
        print(f"Attempting login to {BASE_URL}/auth/login with FORM DATA")
        resp = requests.post(f"{BASE_URL}/auth/login", data={"username": "demo", "password": "demo123"})
        if resp.status_code == 200:
            print("Login successful (/login endpoint)!")
            return resp.json()["access_token"]
            
        print(f"Login failed: {resp.status_code} - {resp.text}")
        return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def test_endpoint(method, endpoint, data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    print(f"\nTesting {method} {url}...")
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers)
        
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("Response:", json.dumps(response.json(), indent=2)[:500] + "...")
            return True
        else:
            print("Error Response:", response.text)
            return False
    except Exception as e:
        print(f"Request Failed: {e}")
        return False

def main():
    # 0. System Status
    test_endpoint("GET", "/system/status")

    # 1. Login
    token = get_token()
    if not token:
        print("Skipping authenticated tests.")
        # Try ping anyway
        test_endpoint("GET", "/audit/ping")
        return

    # 1b. Ping with token (just in case)
    test_endpoint("GET", "/audit/ping", token=token)

    # 2. Predict Effort
    payload = {
        "title": "Implementar OAuth2 con Google",
        "description": "Backend integration for secure login using multiple providers",
        "seniority": "Mid"
    }
    test_endpoint("POST", "/audit/predict-effort", payload, token=token)

    # 3. Health Score
    test_endpoint("GET", "/audit/health-score", token=token)

    # 4. GET Projects
    print("\nTesting Projects endpoint...")
    test_endpoint("GET", "/projects", token=token)

    # 5. GET Tasks
    print("\nTesting Tasks endpoint...")
    test_endpoint("GET", "/tasks", token=token)


if __name__ == "__main__":
    main()
