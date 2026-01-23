import io
import csv

# We disable Pandas usage for CSV to ensure maximum stability and avoid dependency issues on host
PANDAS_AVAILABLE = False 

def process_tasks_csv(file_content: bytes):
    try:
        # Decode content
        content_str = file_content.decode('utf-8')
        
        # Pre-process lines to handle "Quoted Lines" format (e.g. "Title,Desc,..." wrapped in quotes)
        lines = content_str.splitlines()
        cleaned_lines = []
        for line in lines:
            line = line.strip()
            # If line is wrapped in quotes and contains commas (likely a CSV line wrapped in quotes)
            if len(line) > 2 and line.startswith('"') and line.endswith('"') and ',' in line:
                # Check if it looks like a single field or a wrapped line. 
                # A heuristic: if it has multiple commas inside, we strip the outer quotes.
                # However, valid CSV fields can be "Field, with, comma". 
                # But typically a whole line wrapped in quotes like "A,B,C" is non-standard.
                # We'll strip ONLY if it seems to map to the structure we expect (multiple fields).
                cleaned_lines.append(line[1:-1])
            else:
                cleaned_lines.append(line)
        
        final_content = "\n".join(cleaned_lines)
        
        if final_content.startswith('\ufeff'):
            final_content = final_content[1:]

        # Use standard CSV DictReader
        reader = csv.DictReader(io.StringIO(final_content))
        
        # Normalize headers
        if reader.fieldnames:
            reader.fieldnames = [name.lower().strip() for name in reader.fieldnames]
        else:
            return {"error": "CSV file is empty or missing headers"}

        tasks = []
        errors = []
        
        VALID_STATUSES = {"PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "CANCELLED", "ON_HOLD"}
        VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

        from datetime import datetime

        def parse_date(date_str):
            if not date_str: return None
            date_str = date_str.strip()
            formats = ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"]
            for fmt in formats:
                try:
                    return datetime.strptime(date_str, fmt).isoformat()
                except ValueError:
                    continue
            return None

        for index, row in enumerate(reader):
            try:
                # Safe Extraction with validation
                raw_status = row.get("status", "PENDING")
                status = raw_status.upper().strip() if raw_status else "PENDING"
                if status not in VALID_STATUSES: status = "PENDING"

                raw_priority = row.get("priority", "MEDIUM")
                priority = raw_priority.upper().strip() if raw_priority else "MEDIUM"
                if priority not in VALID_PRIORITIES: priority = "MEDIUM"

                # Aliases for Title
                title = row.get("title") or row.get("name") or row.get("task") or row.get("activity")
                if not title: continue # Skip empty titles

                estimated_hours = 0.0
                try:
                    estimated_hours = float(row.get("estimated hours", 0) or row.get("hours", 0) or row.get("estimate", 0) or 0)
                except ValueError:
                    estimated_hours = 0.0

                task_data = {
                    "title": title,
                    "description": row.get("description", ""),
                    "status": status,
                    "priority": priority,
                    "assigned_to": row.get("assigned to") or row.get("assigned_to") or row.get("assignee"),
                    "estimated_hours": estimated_hours,
                    "tags": [t.strip() for t in row.get("tags", "").split(",") if t.strip()]
                }
                
                # Handling Date fields
                start_date = row.get("start date") or row.get("start_date")
                due_date = row.get("due date") or row.get("due_date")
                
                if start_date: 
                    parsed = parse_date(start_date)
                    if parsed: task_data["start_date"] = parsed
                
                if due_date: 
                    parsed = parse_date(due_date)
                    if parsed: task_data["due_date"] = parsed

                tasks.append(task_data)
            except Exception as e:
                errors.append(f"Row {index}: {str(e)}")
                
        return {"tasks": tasks, "errors": errors}

    except Exception as e:
        return {"error": f"Failed to read CSV: {str(e)}"}
