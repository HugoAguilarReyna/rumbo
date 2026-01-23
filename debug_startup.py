import asyncio
from app.core import database, security
from app.models.user import UserCreate

async def test_db():
    print("Testing MongoDB Connection...")
    try:
        db = database.get_database()
        # access current_op to check connection
        await db.command("ping")
        print("✅ MongoDB Connection Successful")
    except Exception as e:
        print(f"❌ MongoDB Connection Failed: {e}")

def test_hashing():
    print("Testing Password Hashing...")
    try:
        pw = "Test@1234"
        hashed = security.get_password_hash(pw)
        print(f"✅ Hashing Successful: {hashed[:10]}...")
        assert security.verify_password(pw, hashed)
        print("✅ Verify Successful")
    except Exception as e:
        print(f"❌ Hashing Failed: {e}")

async def main():
    test_hashing()
    await test_db()

if __name__ == "__main__":
    asyncio.run(main())
