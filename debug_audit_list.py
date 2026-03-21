import asyncio
import httpx
from app.core.security import create_access_token
from datetime import timedelta

async def test_audit_endpoint():
    # 1. Generate Token
    token = create_access_token(data={"sub": "demo"}, expires_delta=timedelta(minutes=5))
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Call Endpoint
    url = "http://localhost:8000/api/audit/valdes-souto-tasks"
    print(f"Testing URL: {url}")
    
    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            response = await client.get(url, headers=headers)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                print("Tasks:", response.json().get("tasks", [])[:3], "...")
            else:
                print("Error:", response.text)
        except Exception as e:
            print(f"Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test_audit_endpoint())
