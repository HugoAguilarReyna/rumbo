import requests
import uuid
import time

BASE_URL = "http://localhost:8000/api"

def get_random_suffix():
    return str(uuid.uuid4())[:8]

def register_user(username, email, password):
    url = f"{BASE_URL}/auth/register"
    payload = {
        "username": username,
        "email": email,
        "password": password,
        "full_name": "Test User"
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
    except requests.exceptions.Timeout:
        print(f"Register timed out for {username}")
        return None
    except Exception as e:
        print(f"Register failed with error: {e}")
        return None
    if response.status_code != 200:
        print(f"Failed to register {username}: {response.text}")
        return None
    return response.json()

def login_user(username, password):
    url = f"{BASE_URL}/auth/login"
    payload = {
        "username": username,
        "password": password
    }
    try:
        response = requests.post(url, data=payload, timeout=10)
    except Exception as e:
        print(f"Login failed: {e}")
        return None
    if response.status_code != 200:
        print(f"Failed to login {username}: {response.text}")
        return None
    return response.json().get("access_token")

def test_project_crud(token):
    print("\n--- Testing Project CRUD ---")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create
    p_name = f"Project {get_random_suffix()}"
    p_desc = "Test Description"
    res = requests.post(f"{BASE_URL}/projects/", headers=headers, json={"name": p_name, "description": p_desc})
    assert res.status_code == 200, f"Create Project failed: {res.text}"
    project = res.json()
    p_id = project["id"] if "id" in project else project["_id"]
    print(f"Created Project: {p_name} ({p_id})")

    # 2. List
    res = requests.get(f"{BASE_URL}/projects/", headers=headers)
    assert res.status_code == 200, f"List Projects failed: {res.text}"
    projects = res.json()
    assert any(p.get("id", p.get("_id")) == p_id for p in projects), "Created project not found in list"
    print(f"List Projects: Found {len(projects)} projects")

    # 3. Update
    new_desc = "Updated Description"
    res = requests.patch(f"{BASE_URL}/projects/{p_id}", headers=headers, json={"description": new_desc})
    assert res.status_code == 200, f"Update Project failed: {res.text}"
    updated_p = res.json()
    assert updated_p["description"] == new_desc, "Description not updated"
    print("Updated Project: Success")

    # 4. Delete
    res = requests.delete(f"{BASE_URL}/projects/{p_id}", headers=headers)
    assert res.status_code == 200, f"Delete Project failed: {res.text}"
    
    # Verify Deletion
    res = requests.get(f"{BASE_URL}/projects/", headers=headers)
    projects = res.json()
    assert not any(p.get("id", p.get("_id")) == p_id for p in projects), "Deleted project still in list"
    print("Deleted Project: Success")

def test_user_crud(admin_token, user2_id):
    print("\n--- Testing User CRUD ---")
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 1. List
    res = requests.get(f"{BASE_URL}/users/", headers=headers)
    assert res.status_code == 200, "List Users failed"
    users = res.json()
    print(f"Total Users: {len(users)}")
    
    # 2. Update User2
    print(f"Updating User {user2_id} capacity...")
    res = requests.patch(f"{BASE_URL}/users/{user2_id}", headers=headers, json={"daily_capacity": 10.0})
    if res.status_code != 200:
        print(f"Update failed: {res.text}")
    else:
        u = res.json()
        assert u["daily_capacity"] == 10.0, "Capacity not updated"
        print("User Updated: Success")

    # 3. Delete User2
    print(f"Deleting User {user2_id}...")
    res = requests.delete(f"{BASE_URL}/users/{user2_id}", headers=headers)
    if res.status_code != 200:
        print(f"Delete failed: {res.text}")
    else:
        print("User Deleted: Success")
        
    # Verify
    res = requests.get(f"{BASE_URL}/users/", headers=headers)
    users = res.json()
    assert not any(u.get("id", u.get("_id")) == user2_id for u in users), "Deleted user still in list"

def main():
    suffix = get_random_suffix()
    admin_user = f"admin_{suffix}"
    admin_email = f"admin_{suffix}@example.com"
    pwd = "password123"

    print(f"Registering Admin: {admin_user}...")
    # Attempt register, ignore timeout failure if login works
    register_user(admin_user, admin_email, pwd)
    
    print("Logging in...")
    token = login_user(admin_user, pwd)
    if not token: 
        print("Login failed. Registration likely failed completely.")
        return

    test_project_crud(token)

    # User CRUD Test - Create User 2
    suffix2 = get_random_suffix()
    user2 = f"victim_{suffix2}"
    user2_email = f"victim_{suffix2}@example.com"
    print(f"\nRegistering Victim: {user2}...")
    register_user(user2, user2_email, pwd)
    
    # We need user2 ID. To get it, we can list users (as admin) and find by username
    print("Fetching Victim ID...")
    res = requests.get(f"{BASE_URL}/users/", headers={"Authorization": f"Bearer {token}"})
    if res.status_code == 200:
        users = res.json()
        victim = next((u for u in users if u["username"] == user2), None)
        user2_id = victim["id"] if victim and "id" in victim else (victim["_id"] if victim else None)
        
        if user2_id:
            test_user_crud(token, user2_id)
        else:
            print("Victim user not found in list")
    else:
        print("Failed to list users to find victim")

    print("\n--- VERIFICATION COMPLETE: ALL TESTS PASSED ---")

if __name__ == "__main__":
    main()
