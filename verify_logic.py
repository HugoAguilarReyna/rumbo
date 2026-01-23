
import asyncio
from app.services.csv_processor import process_tasks_csv
from app.models.task import TaskInDB
from datetime import datetime

# Mock User
class MockUser:
    id = "user123"

current_user = MockUser()

async def simulate_upload():
    print("Reading CSV content...")
    csv_content = """
"Title,Description,Status,Priority,Assigned To,Estimated Hours,Start Date,Due Date,Tags"
"Test Task,Desc,PENDING,MEDIUM,Me,10,2024-01-01,2024-02-01,tag"
""".strip().encode('utf-8')

    print("Processing CSV...")
    result = process_tasks_csv(csv_content)
    print(f"Processed: {len(result.get('tasks', []))} tasks")
    
    if "error" in result:
        print("CSV Error:", result["error"])
        return

    print("Validating Pydantic Models...")
    valid_tasks = []
    try:
        for i, task_data in enumerate(result["tasks"]):
            print(f"Task {i} Data:", task_data)
            task_in_db = TaskInDB(
                **task_data,
                owner_id=str(current_user.id)
            )
            print("Model Created.")
            dump = task_in_db.model_dump(by_alias=True)
            print("Model Dumped.")
            valid_tasks.append(dump)
    except Exception as e:
        print(f"CRASH during model validation: {e}")
        import traceback
        traceback.print_exc()

    print(f"Ready to insert {len(valid_tasks)} tasks.")

if __name__ == "__main__":
    asyncio.run(simulate_upload())
