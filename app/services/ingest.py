import io
import csv
from datetime import datetime
from app.core.database import get_database
from app.models.task import TaskInDB
from app.models.project import ProjectInDB

async def ingest_csv(file_content: bytes, owner_id: str):
    db = get_database()
    
    # 1. Parse CSV Content
    content_str = ""
    try:
        content_str = file_content.decode('utf-8-sig') # Handle BOM automatically
    except UnicodeDecodeError:
        try:
            content_str = file_content.decode('latin-1') # Fallback for Windows Excel
        except Exception as e:
            return {"error": f"Encoding Error: Failed to decode CSV. Please save as UTF-8. ({str(e)})"}
            
    try:
        # Pre-process lines to handle potential quote wrapping issues if needed
            
        # Pre-process lines to handle potential quote wrapping issues if needed
        # (Simplified for now, assuming standard CSV or using previous logic if robust)
        # Using standard csv reader for now as it's cleaner
        
        reader = csv.DictReader(io.StringIO(content_str))
        
        # Normalize headers
        if reader.fieldnames:
            reader.fieldnames = [name.lower().strip() for name in reader.fieldnames]
        else:
            return {"inserted": 0, "failed": 0, "errors": ["Empty CSV"]}

    except Exception as e:
        return {"error": f"Failed to read CSV: {str(e)}"}

    tasks_to_insert = []
    errors = []
    
    # Cache projects to avoid DB spam
    # key: project_name (lower), value: project_id
    project_cache = {}

    # Pre-load existing projects for this user
    existing_projects = await db.projects.find({"owner_id": owner_id}).to_list(length=1000)
    for p in existing_projects:
        project_cache[p["name"].lower().strip()] = str(p["_id"])

    VALID_STATUSES = {"PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "CANCELLED", "ON_HOLD"}
    VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

    def parse_date(date_str):
        if not date_str: return None
        date_str = date_str.strip()
        formats = ["%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d"]
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt # Return datetime object directly for Mongo
            except ValueError:
                continue
        return None

    for index, row in enumerate(reader):
        try:
            # 2. Extract Project & Find/Create
            project_name = row.get("project", "").strip()
            project_id = None
            
            if project_name:
                p_key = project_name.lower()
                if p_key in project_cache:
                    project_id = project_cache[p_key]
                else:
                    # Create new project
                    new_project = {
                        "name": project_name,
                        "owner_id": owner_id,
                        "created_at": datetime.utcnow()
                    }
                    result = await db.projects.insert_one(new_project)
                    project_id = str(result.inserted_id)
                    project_cache[p_key] = project_id

            # 3. Extract Task Data
            title = row.get("title") or row.get("name")
            if not title: continue 

            raw_status = row.get("status", "PENDING").upper().strip()
            status = raw_status if raw_status in VALID_STATUSES else "PENDING"
            
            raw_priority = row.get("priority", "MEDIUM").upper().strip()
            priority = raw_priority if raw_priority in VALID_PRIORITIES else "MEDIUM"

            try:
                est_str = row.get("estimated hours") or row.get("estimated_hours") or "0"
                estimated_hours = float(est_str)
            except:
                estimated_hours = 0.0

            tags = [t.strip() for t in (row.get("tags") or "").split(",") if t.strip()]

            task_doc = {
                "owner_id": owner_id,
                "project_id": project_id,
                "title": title,
                "description": row.get("description", ""),
                "status": status,
                "priority": priority,
                "assigned_to": row.get("assigned to") or row.get("assigned_to"),
                "estimated_hours": estimated_hours,
                "tags": tags,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            # Dates
            start_date = parse_date(row.get("start date") or row.get("start_date"))
            if start_date: task_doc["start_date"] = start_date
            
            due_date = parse_date(row.get("due date") or row.get("due_date"))
            if due_date: task_doc["due_date"] = due_date

            tasks_to_insert.append(task_doc)

        except Exception as e:
            errors.append(f"Row {index}: {str(e)}")

    # 4. Bulk Insert Tasks
    inserted_count = 0
    if tasks_to_insert:
        try:
            res = await db.tasks.insert_many(tasks_to_insert)
            inserted_count = len(res.inserted_ids)
        except Exception as e:
            return {"error": f"Bulk Insert Failed: {str(e)}", "errors": errors}

    return {
        "inserted": inserted_count,
        "failed": len(errors),
        "errors": errors,
        "projects_created": len(project_cache) - len(existing_projects)
    }
