from datetime import datetime, timedelta
from typing import List, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.task import TaskInDB
from app.models.user import UserInDB

class CapacityService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def check_capacity(self, user_id: str, start_date: datetime, due_date: datetime, estimated_hours: float) -> Dict:
        """
        Checks if the user has enough capacity for the new task.
        Returns a dict with 'valid' (bool) and 'warnings' (list of strings).
        """
        if not user_id or not start_date or not due_date or estimated_hours <= 0:
            return {"valid": True, "warnings": []}

        # 1. Get User Capacity
        user = await self.db.users.find_one({"_id": user_id})
        if not user:
            return {"valid": False, "warnings": ["User not found"]}
        
        daily_limit = user.get("daily_capacity", 8.0)
        
        # 2. Calculate Daily Load for New Task
        duration_days = (due_date - start_date).days + 1
        if duration_days <= 0:
            return {"valid": False, "warnings": ["Invalid date range"]}
            
        daily_load_new = estimated_hours / duration_days

        # 3. Get Existing Tasks in Range
        # Find tasks that overlap with the new task's range
        pipeline = [
            {
                "$match": {
                    "assigned_to": user["username"], # Task stores username, ideally should be ID but sticking to current schema
                    "status": {"$nin": ["COMPLETED", "CANCELLED"]},
                    "$or": [
                        {"start_date": {"$lte": due_date}, "due_date": {"$gte": start_date}}
                    ]
                }
            }
        ]
        
        existing_tasks = await self.db.tasks.aggregate(pipeline).to_list(length=None)
        
        # 4. Simulate Load Day by Day
        warnings = []
        current_date = start_date
        overload_days = 0
        
        while current_date <= due_date:
            daily_total = daily_load_new
            
            for task in existing_tasks:
                if not task.get("start_date") or not task.get("due_date"):
                    continue
                    
                t_start = task["start_date"]
                t_end = task["due_date"]
                
                # Check if this task is active on current_date
                if t_start <= current_date <= t_end:
                    # Calculate its daily load
                    t_days = (t_end - t_start).days + 1
                    t_hours = task.get("estimated_hours", 0)
                    if t_days > 0:
                        daily_total += (t_hours / t_days)
            
            if daily_total > daily_limit:
                overload_days += 1
                
            current_date += timedelta(days=1)

        if overload_days > 0:
            warnings.append(f"User is overloaded on {overload_days} days during this period (Limit: {daily_limit}h/day).")
            return {"valid": False, "warnings": warnings}

        return {"valid": True, "warnings": []}

    def _count_working_days(self, start_date: datetime, end_date: datetime) -> int:
        days = 0
        current = start_date
        while current <= end_date:
            if current.weekday() < 5: # Mon-Fri
                days += 1
            current += timedelta(days=1)
        return days

    async def get_capacity_report(self, start_date: datetime, end_date: datetime, owner_id: str = None) -> Dict:
        """
        Generates capacity report for the given date range.
        """
        # Get all users
        users = await self.db.users.find({}).to_list(length=None)
        
        capacity_data = []
        working_days = self._count_working_days(start_date, end_date)
        if working_days == 0: working_days = 1 # Avoid div by zero
        
        for user in users:
            username = user.get("username")
            if not username: continue
            
            daily_limit = user.get("daily_capacity", 8.0)
            max_capacity = daily_limit * working_days
            
            # Find tasks for this user in range
            pipeline = [
                {
                    "$match": {
                        "assigned_to": username,
                        "status": {"$nin": ["COMPLETED", "CANCELLED"]},
                        "$or": [
                            {"start_date": {"$lte": end_date}, "due_date": {"$gte": start_date}}
                        ]
                    }
                }
            ]
            tasks = await self.db.tasks.aggregate(pipeline).to_list(length=None)
            
            total_estimated = 0.0
            for task in tasks:
                 t_start = task.get("start_date")
                 t_end = task.get("due_date")
                 if not t_start or not t_end: continue
                 
                 # Calculate overlap
                 overlap_start = max(start_date, t_start)
                 overlap_end = min(end_date, t_end)
                 
                 if overlap_start <= overlap_end:
                     # Working days in overlap
                     overlap_working_days = self._count_working_days(overlap_start, overlap_end)
                     
                     # Task Daily Load
                     t_duration_days = (t_end - t_start).days + 1
                     if t_duration_days > 0:
                         daily_load = task.get("estimated_hours", 0) / t_duration_days
                         total_estimated += (daily_load * overlap_working_days) # Assume load is on working days? Or simple spread? 
                         # Simple spread approach might be safer if we don't know if task is weekends only etc.
                         # But let's stick to simple total hours in window for now.
                         # Actually, let's use the straightforward overlap ratio
                         # overlap_days = (overlap_end - overlap_start).days + 1
                         # total_estimated += (daily_load * overlap_days)

            utilization = (total_estimated / max_capacity * 100) if max_capacity > 0 else 0
            
            capacity_data.append({
                "user": username,
                "total_hours_assigned": round(total_estimated, 2),
                "max_capacity_hours": round(max_capacity, 2),
                "utilization_percent": round(utilization, 2),
                "status": "overloaded" if utilization > 100 else "optimal" if utilization > 70 else "underutilized",
                "active_tasks": len(tasks)
            })
            
        return {
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "team_capacity": sorted(capacity_data, key=lambda x: x['utilization_percent'], reverse=True),
            "total_team_utilization": round(
                sum(d["utilization_percent"] for d in capacity_data) / len(capacity_data), 2
            ) if capacity_data else 0
        }
