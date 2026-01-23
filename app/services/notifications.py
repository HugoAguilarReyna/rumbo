from datetime import datetime
from bson import ObjectId

class NotificationService:
    def __init__(self, db):
        self.db = db
    
    async def create_notification(
        self,
        user_id: str,
        notification_type: str,
        title: str,
        message: str,
        link: str = None
    ):
        """Create a new notification for a user."""
        
        notification = {
            "user_id": user_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "link": link,
            "read": False,
            "created_at": datetime.utcnow()
        }
        
        await self.db.notifications.insert_one(notification)
    
    async def notify_task_assignment(self, task, assigned_user_id):
        """Notify user when assigned to a task."""
        await self.create_notification(
            user_id=assigned_user_id,
            notification_type="TASK_ASSIGNED",
            title="New Task Assigned",
            message=f"You've been assigned to: {task['title']}",
            link=f"/tasks/{task['_id']}"
        )
    
    async def notify_task_overdue(self, task, user_id):
        """Notify user about overdue task."""
        await self.create_notification(
            user_id=user_id,
            notification_type="TASK_OVERDUE",
            title="Task Overdue!",
            message=f"Task '{task['title']}' is past its due date",
            link=f"/tasks/{task['_id']}"
        )
    
    async def notify_comment_added(self, task, commenter_name, task_owner_id):
        """Notify task owner about new comment."""
        await self.create_notification(
            user_id=task_owner_id,
            notification_type="COMMENT_ADDED",
            title="New Comment",
            message=f"{commenter_name} commented on '{task['title']}'",
            link=f"/tasks/{task['_id']}"
        )
