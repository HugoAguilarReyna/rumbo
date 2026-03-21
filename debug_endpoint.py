import asyncio
import httpx
from app.core.security import create_access_token
from app.core.config import settings
from datetime import timedelta

async def test_endpoint():
    # 1. Generate Token
    access_token_expires = timedelta(minutes=30)
    token = create_access_token(
        data={"sub": "demo"}, expires_delta=access_token_expires
    )
    print(f"Generated Token: {token[:20]}...")

    # 2. Call Endpoint
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            response = await client.get("http://localhost:8000/api/talents/", headers=headers) # Added slash explicitly too
            print(f"Status Code: {response.status_code}")
            print(f"Response JSON: {response.json()}")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_endpoint())
