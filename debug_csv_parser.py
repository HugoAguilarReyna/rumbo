
import io
import csv
import pandas as pd
from app.services.csv_processor import process_tasks_csv

# User provided content case 1 (Literal quotes in file)
quoted_content = """
"Title,Description,Status,Priority,Assigned To,Estimated Hours,Start Date,Due Date,Tags"
"Setup MongoDB Atlas,Configure cloud database connection and create initial collections,COMPLETED,HIGH,John Doe,8.5,2024-01-10,2024-01-15,backend database infrastructure"
"Design Landing Page,Create wireframes and mockups for main landing page with hero section,IN_PROGRESS,MEDIUM,Sarah Chen,12,2024-01-12,2024-01-25,frontend design ui/ux"
""".strip()

# User provided content case 2 (Standard CSV, quotes just for chat)
standard_content = """
Title,Description,Status,Priority,Assigned To,Estimated Hours,Start Date,Due Date,Tags
Setup MongoDB Atlas,Configure cloud database connection and create initial collections,COMPLETED,HIGH,John Doe,8.5,2024-01-10,2024-01-15,backend database infrastructure
Design Landing Page,Create wireframes and mockups for main landing page with hero section,IN_PROGRESS,MEDIUM,Sarah Chen,12,2024-01-12,2024-01-25,frontend design ui/ux
""".strip()


print("\n--- Testing Quoted Content with New Logic ---")
content_str = quoted_content
try:
    # We call the real function which we just patched via code, 
    # but since this script imports it, we hope the import works or we simulate it.
    # Actually, we should just import process_tasks_csv again if it wasn't reloaded.
    # But for a script run via run_command, it re-runs fresh.
    res = process_tasks_csv(quoted_content.encode('utf-8'))
    print(f"Quoted Result: {len(res.get('tasks', []))} tasks, {len(res.get('errors', []))} errors")
    if res.get('tasks'):
        print("First task:", res.get('tasks')[0])
    if res.get('errors'):
        print(res.get('errors'))
except Exception as e:
    print(f"Quoted Crash: {e}")
