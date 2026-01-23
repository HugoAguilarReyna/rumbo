from datetime import datetime, timedelta
from typing import List, Tuple

class CapacityValidator:
    """Validates if a user has available capacity for new task assignments."""
    
    def __init__(self, db):
        self.db = db
    
    async def check_user_capacity(
        self, 
        user_id: str, 
        start_date: datetime, 
        end_date: datetime,
        estimated_hours: float
    ) -> Tuple[bool, List[str]]:
        """
        Validates if user has capacity for a task.
        
        Returns:
            (is_valid, warnings_list)
        """
        warnings = []
        
        # Get user's daily capacity
        # Note: user_id is passed as string, but DB might have ObjectId or String. 
        # Check standard user lookup.
        from bson import ObjectId
        query = {"$or": [{"_id": user_id}, {"username": user_id}]}
        try:
            if ObjectId.is_valid(user_id):
                query = {"_id": ObjectId(user_id)}
        except:
            pass
            
        user = await self.db.users.find_one(query)
        if not user:
            return True, [] # User not found, skip check
            
        daily_capacity = user.get("daily_capacity", 8.0)
        
        # Get all active tasks for this user in the date range
        existing_tasks = await self.db.tasks.find({
            "assigned_to": user.get("username"), # Assuming assigned_to stores username
            "status": {"$in": ["PENDING", "IN_PROGRESS"]},
            "$or": [
                {
                    "start_date": {"$lte": end_date},
                    "due_date": {"$gte": start_date}
                }
            ]
        }).to_list(length=None)
        
        # Calculate daily workload
        workload_by_day = {}
        
        for task in existing_tasks:
            task_start = task.get("start_date", start_date)
            task_end = task.get("due_date", end_date)
            task_hours = task.get("estimated_hours", 0)
            
            # Distribute hours across working days
            working_days = self._count_working_days(task_start, task_end)
            if working_days > 0:
                hours_per_day = task_hours / working_days
                
                current_date = task_start
                while current_date <= task_end:
                    if current_date.weekday() < 5:  # Monday-Friday
                        date_key = current_date.strftime("%Y-%m-%d")
                        workload_by_day[date_key] = workload_by_day.get(date_key, 0) + hours_per_day
                    current_date += timedelta(days=1)
        
        # Check for overload
        overloaded_days = []
        working_days_new_task = self._count_working_days(start_date, end_date)
        
        if working_days_new_task > 0:
            new_task_hours_per_day = estimated_hours / working_days_new_task
            
            current_date = start_date
            while current_date <= end_date:
                if current_date.weekday() < 5:
                    date_key = current_date.strftime("%Y-%m-%d")
                    projected_load = workload_by_day.get(date_key, 0) + new_task_hours_per_day
                    
                    if projected_load > daily_capacity:
                        overloaded_days.append({
                            "date": date_key,
                            "current_load": round(workload_by_day.get(date_key, 0), 2),
                            "projected_load": round(projected_load, 2),
                            "capacity": daily_capacity,
                            "overflow": round(projected_load - daily_capacity, 2)
                        })
                
                current_date += timedelta(days=1)
        
        # Generate warnings
        if overloaded_days:
            warnings.append(f"⚠️ CAPACITY OVERLOAD: User will exceed daily capacity on {len(overloaded_days)} day(s)")
            for day in overloaded_days[:3]:  # Show first 3
                warnings.append(
                    f"  • {day['date']}: {day['projected_load']}h / {day['capacity']}h "
                    f"(+{day['overflow']}h over capacity)"
                )
            
            if len(overloaded_days) > 3:
                warnings.append(f"  ... and {len(overloaded_days) - 3} more day(s)")
        
        return len(warnings) == 0, warnings
    
    def _count_working_days(self, start: datetime, end: datetime) -> int:
        """Count weekdays between two dates."""
        working_days = 0
        current = start
        while current <= end:
            if current.weekday() < 5:  # Monday = 0, Sunday = 6
                working_days += 1
            current += timedelta(days=1)
        return working_days
