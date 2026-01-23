import requests
import time

API_URL = "http://localhost:8080/api"

# 1. Register/Login
username = "testuser_encoding"
password = "password123"

try:
    requests.post(f"{API_URL}/auth/register", json={
        "email": "testuser_encoding@example.com",
        "username": username,
        "password": password,
        "full_name": "Encoding Test User"
    })
except:
    pass

login_res = requests.post(f"{API_URL}/auth/login", data={"username": username, "password": password})
if login_res.status_code != 200:
    print(f"Login failed: {login_res.text}")
    exit(1)

token = login_res.json()["access_token"]
headers = {'Authorization': f'Bearer {token}'}

# 2. Create Latin-1 content
# Using special char 'ñ' which behaves differently in utf-8 vs latin-1
# In Latin-1, ñ is \xf1. In UTF-8, it is \xc3\xb1.
content = "Title,Description,Status\nTarea con Ñ,Description with special char,PENDING"
latin1_bytes = content.encode('latin-1')

files = {'file': ('test_latin1.csv', latin1_bytes, 'text/csv')}

print("Uploading Latin-1 CSV...")
res = requests.post(f"{API_URL}/tasks/upload-csv", files=files, headers=headers)

if res.status_code == 200:
    print("SUCCESS: Upload accepted.")
    print(res.json())
else:
    print(f"FAILURE: {res.status_code}")
    print(res.text)
