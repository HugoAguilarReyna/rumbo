import asyncio
from app.core.database import get_database
from app.models.task import TaskResponse
from pydantic import ValidationError

async def debug_tasks():
    try:
        db = get_database()
        tasks = await db.tasks.find({}).to_list(length=1000)
        print(f"Found {len(tasks)} tasks.")
        for t in tasks:
            try:
                TaskResponse.model_validate(t)
            except ValidationError as e:
                print(f"VALIDATION ERROR ID {t.get('_id')}: {e}")
                # print(t) # Optional: print the task to see data
    except Exception as e:
        print(f"General Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_tasks())
