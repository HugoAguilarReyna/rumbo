
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "pm_dashboard"

# Captured ID from debug
USER_ID = "demo"
USERNAME = "demo" 
EMAIL = "demo@example.com"

async def create_user():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"Connected to {DB_NAME}")

    user_data = {
        "username": USERNAME,  # This matches the 'sub' in the token usually
        "email": EMAIL,
        "full_name": "Demo User",
        "disabled": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    # Upsert user
    result = await db.users.update_one(
        {"username": USERNAME},
        {"$set": user_data},
        upsert=True
    )
    
    print(f"User upserted. Matched: {result.matched_count}, Modified: {result.modified_count}, Upserted: {result.upserted_id}")
    
    # Verify
    user = await db.users.find_one({"username": USERNAME})
    print(f"User in DB: {user['_id']} - {user['username']}")
    
    # Update talents to ensure they match ANY user if we were wrong about the specific ID?
    # No, let's stick to the plan. If this doesn't work, we'll debug the token.
    
    # Update talents to match this user's _id (which is an ObjectId in Mongo, but dependencies.py converts it to string)
    # Wait, dependencies.py says: user["_id"] = str(user["_id"])
    # And router says: cursor = db.talents.find({"owner_id": str(current_user.id)})
    
    # So if the user document has an ObjectId as _id, the talents owner_id must be that ObjectId string.
    # The seed_talents.py set owner_id to the STR "google-oauth2|..." 
    # BUT dependencies.py returns the USER document. 
    # The user document _id represents the user ID.
    
    # If I insert the user, it gets a random ObjectId.
    # So str(current_user.id) will be "65c3..."
    # But seed_talents.py used "google-oauth2..."
    
    # I should Force the _id to be the string "google-oauth2..." OR update talents to match the new ObjectId.
    # Mongo _id CAN be a string. Let's force it to be the string if possible, or just update talents.
    
    # Updating talents to match the User's _id is safer.
    
    talents_result = await db.talents.update_many(
        {}, # update all for now since it's a dev env
        {"$set": {"owner_id": str(user["_id"])}}
    )
    print(f"Updated {talents_result.modified_count} talents to owner_id: {str(user['_id'])}")

    client.close()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(create_user())
