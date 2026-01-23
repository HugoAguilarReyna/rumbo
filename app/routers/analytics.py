from fastapi import APIRouter, Depends, Response
from app.utils.dependencies import get_current_user
from app.core.database import get_database
from app.models.user import UserResponse
from app.services.pdf import generate_dashboard_pdf
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/analytics", tags=["analytics"])

from typing import Optional

@router.get("/projects")
async def get_projects(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    projects = await db.projects.find({"owner_id": str(current_user.id)}).to_list(length=100)
    return [{"id": str(p["_id"]), "name": p["name"]} for p in projects]

@router.get("/metrics")
async def get_metrics(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    owner_id = str(current_user.id)
    
    match_stage = {"owner_id": owner_id}
    if project_id and project_id != "ALL":
        match_stage["project_id"] = project_id
    
    pipeline = [
        {"$match": match_stage},
        {"$facet": {
            "total_tasks": [{"$count": "count"}],
            "completed_tasks": [
                {"$match": {"status": "COMPLETED"}},
                {"$count": "count"}
            ],
            "completion_times": [
                {"$match": {"status": "COMPLETED", "completed_at": {"$exists": True}}},
                {"$project": {
                    "days_to_complete": {
                        "$divide": [
                            {"$subtract": ["$completed_at", "$created_at"]},
                            86400000 
                        ]
                    }
                }},
                {"$group": {
                    "_id": None,
                    "avg_days": {"$avg": "$days_to_complete"}
                }}
            ]
        }}
    ]
    
    result = await db.tasks.aggregate(pipeline).to_list(length=1)
    data = result[0]
    
    total = data["total_tasks"][0]["count"] if data["total_tasks"] else 0
    completed = data["completed_tasks"][0]["count"] if data["completed_tasks"] else 0
    avg_days = data["completion_times"][0]["avg_days"] if data["completion_times"] else 0.0
    
    return {
        "total_tasks": total,
        "completed_tasks": completed,
        "completion_rate": (completed / total * 100) if total > 0 else 0,
        "avg_completion_time_days": avg_days
    }

@router.get("/project-status")
async def get_project_status(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    match_stage = {"owner_id": str(current_user.id)}
    if project_id and project_id != "ALL":
        match_stage["project_id"] = project_id

    pipeline = [
        {"$match": match_stage},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    stats = await db.tasks.aggregate(pipeline).to_list(length=10)
    
    # Enforce strict 6 statuses order and colors
    STATUS_ORDER = ["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "ON_HOLD", "CANCELLED"]
    STATUS_COLORS = ["#FFA500", "#2979FF", "#00C853", "#F44336", "#757575", "#000000"]
    
    data_map = {s["_id"]: s["count"] for s in stats}
    data = [data_map.get(s, 0) for s in STATUS_ORDER]
    
    return {
        "labels": STATUS_ORDER,
        "data": data,
        "colors": STATUS_COLORS
    }

@router.get("/resource-load")
async def get_resource_load(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    # Simple count for backward compat if needed, but we will mostly rely on workload-distribution now
    pipeline = [
        {"$match": {"owner_id": str(current_user.id), "status": "IN_PROGRESS"}},
        {"$group": {"_id": "$assigned_to", "count": {"$sum": 1}}}
    ]
    stats = await db.tasks.aggregate(pipeline).to_list(length=20)
    
    labels = [s["_id"] or "Unassigned" for s in stats]
    data = [s["count"] for s in stats]
    
    return {
        "labels": labels,
        "data": data,
        "backgroundColor": "#3B82F6"
    }

@router.get("/workload-distribution")
async def get_workload_distribution(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    
    match_stage = {"owner_id": str(current_user.id)}
    if project_id and project_id != "ALL":
        match_stage["project_id"] = project_id
    
    # 1. Match ALL active/relevant tasks for this user
    pipeline = [
        {
            "$match": match_stage
        },
        {
            "$group": {
                "_id": {
                    "user": "$assigned_to",
                    "status": "$status"
                },
                "count": {"$sum": 1}
            }
        }
    ]
    
    raw_data = await db.tasks.aggregate(pipeline).to_list(length=2000)
    
    # Process into JSON structure for Chart.js
    # Get unique users - Sorted
    users = sorted(list(set(d["_id"]["user"] or "Unassigned" for d in raw_data)))
    
    # Color Mapping & Order
    STATUS_CONFIG = {
        "PENDING":     {"label": "PENDING",     "color": "#FFA500"}, # Orange
        "IN_PROGRESS": {"label": "IN_PROGRESS", "color": "#2979FF"}, # Blue (SaaS Spec)
        "COMPLETED":   {"label": "COMPLETED",   "color": "#00C853"}, # Green
        "BLOCKED":     {"label": "BLOCKED",     "color": "#F44336"}, # Red
        "ON_HOLD":     {"label": "ON_HOLD",     "color": "#757575"}, # Grey
        "CANCELLED":   {"label": "CANCELLED",   "color": "#000000"}  # Black
    }
    
    # Initialize datasets for all 6 statuses so they always appear in legend/stack order
    datasets_map = {
        status: {
            "label": config["label"],
            "data": [0] * len(users),
            "color": config["color"]
        }
        for status, config in STATUS_CONFIG.items()
    }
    
    for item in raw_data:
        user = item["_id"]["user"] or "Unassigned"
        status = item["_id"]["status"]
        count = item["count"]
        
        # Determine effective status key (handle unknown statuses gracefully by skipping or mapping to other)
        if status not in datasets_map:
            continue

        if user in users:
            idx = users.index(user)
            datasets_map[status]["data"][idx] = count
            
    # Return as list in specific order
    ordered_datasets = [
        datasets_map["PENDING"],
        datasets_map["IN_PROGRESS"],
        datasets_map["COMPLETED"],
        datasets_map["BLOCKED"],
        datasets_map["ON_HOLD"],
        datasets_map["CANCELLED"]
    ]
                
    return {
        "users": users,
        "datasets": ordered_datasets
    }
# --------------------------------------------------------------------------------
# MODULE 1: CAPACITY REPORT
# --------------------------------------------------------------------------------
@router.get("/capacity")
async def get_capacity_summary(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get current week's team capacity summary.
    This replaces the old logic with a simplified view for the Capacity Widget.
    """
    db = get_database()
    try:
        from app.services.capacity import CapacityService
        
        # Default to current week
        now = datetime.utcnow()
        start = now
        end = now + timedelta(days=7)
        
        service = CapacityService(db)
        
        # We'll re-use the capacity report logic but format it for the widget
        report = await service.get_capacity_report(start, end)
        
        # Transform for frontend widget
        # The service returns users dict, we want a list
        team_capacity = []
        total_assigned = 0
        total_capacity = 0
        
        if "users" in report:
            for user_id, stats in report["users"].items():
                util_pct = stats.get("utilization_percent", 0)
                status = "optimal"
                if util_pct > 100: status = "overloaded"
                elif util_pct < 50: status = "underutilized"
                
                team_capacity.append({
                    "user": stats.get("username", "Unknown"),
                    "total_hours_assigned": round(stats.get("total_hours", 0), 1),
                    "max_capacity_hours": round(stats.get("capacity_hours", 40), 1),
                    "utilization_percent": round(util_pct, 0),
                    "status": status
                })
                total_assigned += stats.get("total_hours", 0)
                total_capacity += stats.get("capacity_hours", 0)
        
        total_util_pct = (total_assigned / total_capacity * 100) if total_capacity > 0 else 0
        
        return {
            "team_capacity": team_capacity,
            "total_team_utilization": round(total_util_pct, 1)
        }

    except Exception as e:
        print(f"Capacity Widget Error: {e}")
        # Return empty safe response instead of 500
        return {
            "team_capacity": [],
            "total_team_utilization": 0
        }

@router.get("/capacity-report")
async def get_capacity_report(
    start_date: str,
    end_date: str,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    now = datetime.utcnow()
    
@router.get("/efficiency")
async def get_efficiency_scoreboard(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    db = get_database()
    now = datetime.utcnow()
    
    match_stage = {"owner_id": str(current_user.id)}
    if project_id and project_id != "ALL":
        match_stage["project_id"] = project_id
    
    pipeline = [
        {"$match": match_stage},
        {
            "$group": {
                "_id": "$assigned_to",
                "total": {"$sum": 1},
                "completed": {
                    "$sum": {"$cond": [{"$eq": ["$status", "COMPLETED"]}, 1, 0]}
                },
                "overdue": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$lt": ["$due_date", now]},
                                {"$ne": ["$status", "COMPLETED"]}
                            ]},
                            1, 0
                        ]
                    }
                }
            }
        },
        {
            "$project": {
                "user": {"$ifNull": ["$_id", "Unassigned"]},
                "total": 1,
                "completed": 1,
                "overdue": 1,
                "completion_rate": {
                    "$cond": [
                        {"$gt": ["$total", 0]},
                        {"$multiply": [{"$divide": ["$completed", "$total"]}, 100]},
                        0
                    ]
                }
            }
        },
        {"$sort": {"completion_rate": -1}}
    ]
    
    metrics = await db.tasks.aggregate(pipeline).to_list(length=100)
    
    # Rounding in python since MongoDB $round is available but this is easier for ensuring float consistency
    for m in metrics:
        m["completion_rate"] = round(m["completion_rate"], 1)
        
    return metrics

@router.get("/projects/stats")
async def get_project_stats(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Aggregate tasks by project and status.
    Returns data for stacked bar chart visualization.
    """
    db = get_database()
    pipeline = [
        # Match user's tasks only
        {"$match": {"owner_id": str(current_user.id)}},
        
        # 1. Lookup Project Name (since task has project_id)
        {
            "$lookup": {
                "from": "projects",
                "let": {"pid": {"$convert": {"input": "$project_id", "to": "objectId", "onError": None, "onNull": None}}}, # Safely convert
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", "$$pid"]}}}
                ],
                "as": "project_info"
            }
        },
        # Unwind project info (preserveNullAndEmptyArrays if tasks have no project)
        {"$unwind": {"path": "$project_info", "preserveNullAndEmptyArrays": True}},
        
        # Add project_name field
        {
            "$addFields": {
                "project_name": {"$ifNull": ["$project_info.name", "$project_name", "Uncategorized"]}
            }
        },

        # Group by project and status
        {
            "$group": {
                "_id": {
                    "project": "$project_name",  
                    "status": "$status"
                },
                "count": {"$sum": 1}
            }
        },
        
        # Reshape for easier frontend consumption
        {
            "$group": {
                "_id": "$_id.project",
                "total_tasks": {"$sum": "$count"},
                "status_breakdown": {
                    "$push": {
                        "status": "$_id.status",
                        "count": "$count"
                    }
                }
            }
        },
        
        # Filter: CRITICAL - Exclude projects with 0 tasks
        {"$match": {"total_tasks": {"$gt": 0}}},
        
        # Sort by total tasks (most active first)
        {"$sort": {"total_tasks": -1}},
        
        # Limit to top 15 projects (prevent chart clutter)
        {"$limit": 15}
    ]
    
    results = await db.tasks.aggregate(pipeline).to_list(length=15)
    
    # Transform for Chart.js stacked bar format
    projects = []
    status_counts = {
        "PENDING": [],
        "IN_PROGRESS": [],
        "COMPLETED": [],
        "BLOCKED": [],
        "ON_HOLD": [],
        "CANCELLED": []
    }
    
    for project in results:
        projects.append(project["_id"] or "No Project")
        
        # Create lookup dict for this project's statuses
        status_lookup = {
            item["status"]: item["count"] 
            for item in project["status_breakdown"]
        }
        
        # Populate all status categories (use 0 for missing)
        for status in status_counts.keys():
            status_counts[status].append(status_lookup.get(status, 0))
    
    # Define colors for statuses
    STATUS_COLORS = {
        "PENDING": "#FFA500",
        "IN_PROGRESS": "#3B82F6",
        "COMPLETED": "#10B981",
        "BLOCKED": "#EF4444",
        "ON_HOLD": "#6B7280",
        "CANCELLED": "#1F2937"
    }

    datasets = []
    dataset_labels = {
        "PENDING": "Pending",
        "IN_PROGRESS": "In Progress",
        "COMPLETED": "Completed", 
        "BLOCKED": "Blocked",
        "ON_HOLD": "On Hold",
        "CANCELLED": "Cancelled"
    }

    for key, data_list in status_counts.items():
        datasets.append({
            "label": dataset_labels[key],
            "data": data_list,
            "backgroundColor": STATUS_COLORS[key]
        })

    return {
        "labels": projects,
        "datasets": datasets
    }

@router.get("/stats/overview")
async def get_stats_overview(current_user: UserResponse = Depends(get_current_user)):
    """
    Returns aggregated data for Donut Charts:
    1. Tasks by Project (Total count)
    2. Tasks by Resource (Total count)
    """
    db = get_database()
    
    # 1. Tasks by Project
    project_pipeline = [
        {"$match": {"owner_id": str(current_user.id)}},
        
        # Lookup Project Name
        {
            "$lookup": {
                "from": "projects",
                "let": {"pid": {"$convert": {"input": "$project_id", "to": "objectId", "onError": None, "onNull": None}}},
                "pipeline": [{"$match": {"$expr": {"$eq": ["$_id", "$$pid"]}}}],
                "as": "project_info"
            }
        },
        {"$unwind": {"path": "$project_info", "preserveNullAndEmptyArrays": True}},
        
        {"$group": {
            "_id": {"$ifNull": ["$project_info.name", "$project_name", "Uncategorized"]}, 
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    # 2. Tasks by Resource
    resource_pipeline = [
        {"$match": {"owner_id": str(current_user.id)}},
        {"$group": {
            "_id": {"$ifNull": ["$assigned_to", "Unassigned"]}, 
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    # Execution
    file_stats = await db.tasks.aggregate(project_pipeline).to_list(length=20)
    res_stats = await db.tasks.aggregate(resource_pipeline).to_list(length=20)
    
    return {
        "by_project": {
            "labels": [item["_id"] for item in file_stats],
            "data": [item["count"] for item in file_stats]
        },
        "by_resource": {
            "labels": [item["_id"] for item in res_stats],
            "data": [item["count"] for item in res_stats]
        }
    }

@router.get("/projects/deep-dive")
async def get_project_deep_dive(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Returns hierarchical project data:
    Project → Resources → Tasks
    """
    db = get_database()
    pipeline = [
        {"$match": {"owner_id": str(current_user.id)}},
        
        # Lookup Project Name
         {
            "$lookup": {
                "from": "projects",
                "let": {"pid": {"$convert": {"input": "$project_id", "to": "objectId", "onError": None, "onNull": None}}},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", "$$pid"]}}}
                ],
                "as": "project_info"
            }
        },
        {"$unwind": {"path": "$project_info", "preserveNullAndEmptyArrays": True}},
        {
            "$addFields": {
                "project_name": {"$ifNull": ["$project_info.name", "$project_name", "Uncategorized"]}
            }
        },

        # Group by Project and Resource
        {
            "$group": {
                "_id": {
                    "id": "$project_id",
                    "project": "$project_name",
                    "resource": "$assigned_to"
                },
                "tasks": {
                    "$push": {
                        "id": {"$toString": "$_id"},
                        "title": "$title",
                        "status": "$status",
                        "start_date": "$start_date", 
                        "due_date": "$due_date",
                        "estimated_hours": "$estimated_hours",
                        "logged_hours": "$logged_hours"
                    }
                },
                "completed": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "COMPLETED"]}, 1, 0]
                    }
                },
                "cnt_pending": {"$sum": {"$cond": [{"$eq": ["$status", "PENDING"]}, 1, 0]}},
                "cnt_in_progress": {"$sum": {"$cond": [{"$eq": ["$status", "IN_PROGRESS"]}, 1, 0]}},
                "cnt_blocked": {"$sum": {"$cond": [{"$eq": ["$status", "BLOCKED"]}, 1, 0]}},
                "cnt_on_hold": {"$sum": {"$cond": [{"$eq": ["$status", "ON_HOLD"]}, 1, 0]}},
                "cnt_cancelled": {"$sum": {"$cond": [{"$eq": ["$status", "CANCELLED"]}, 1, 0]}},
                "total": {"$sum": 1}
            }
        },
        
        # Calculate resource efficiency
        {
            "$addFields": {
                "completion_rate": {
                    "$multiply": [
                        {"$divide": ["$completed", "$total"]},
                        100
                    ]
                }
            }
        },
        
        # Group by Project
        {
            "$group": {
                "_id": {
                    "id": "$_id.id",
                    "name": "$_id.project"
                },
                "total_tasks": {"$sum": "$total"},
                "completed_tasks": {"$sum": "$completed"},
                
                # Sum status counts
                "total_pending": {"$sum": "$cnt_pending"},
                "total_in_progress": {"$sum": "$cnt_in_progress"},
                "total_blocked": {"$sum": "$cnt_blocked"},
                "total_on_hold": {"$sum": "$cnt_on_hold"},
                "total_cancelled": {"$sum": "$cnt_cancelled"},

                "resources": {
                    "$push": {
                        "name": "$_id.resource",
                        "task_count": "$total",
                        "completed": "$completed",
                        "completion_rate": "$completion_rate",
                        "tasks": "$tasks"
                    }
                }
            }
        },
        
        # Filter empty projects
        {"$match": {"total_tasks": {"$gt": 0}}},
        
        # Calculate project-level metrics
        {
            "$addFields": {
                "project_completion_rate": {
                    "$multiply": [
                        {"$divide": ["$completed_tasks", "$total_tasks"]},
                        100
                    ]
                }
            }
        },
        
        # Sort by completion
        {"$sort": {"project_completion_rate": 1}}
    ]
    
    results = await db.tasks.aggregate(pipeline).to_list(length=None)
    
    return {
        "projects": [
            {
                "id": project["_id"].get("id"),
                "name": project["_id"]["name"] or "Unassigned",
                "total_tasks": project["total_tasks"],
                "completed_tasks": project["completed_tasks"],
                "completion_rate": round(project["project_completion_rate"], 1),
                "status_distribution": {
                    "PENDING": project.get("total_pending", 0),
                    "IN_PROGRESS": project.get("total_in_progress", 0),
                    "COMPLETED": project.get("completed_tasks", 0), # completed_tasks is the sum of COMPLETED
                    "BLOCKED": project.get("total_blocked", 0),
                    "ON_HOLD": project.get("total_on_hold", 0),
                    "CANCELLED": project.get("total_cancelled", 0)
                },
                "resources": sorted(
                    project["resources"],
                    key=lambda r: r["completion_rate"]
                )
            }
            for project in results
        ]
    }

@router.get("/export-pdf")
async def export_pdf(current_user: UserResponse = Depends(get_current_user)):
    # Re-fetch metrics for PDF
    metrics = await get_metrics(current_user=current_user)
    pdf_bytes = await generate_dashboard_pdf(metrics)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=dashboard_{datetime.now().strftime('%Y%m%d')}.pdf"
        }
    )
