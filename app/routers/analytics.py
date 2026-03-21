from fastapi import APIRouter, Depends, Response
from app.utils.dependencies import get_current_user
from app.core.database import get_database
from app.models.user import UserResponse
from app.services.pdf import generate_dashboard_pdf
from bson import ObjectId
from datetime import datetime, timedelta
import pandas as pd

router = APIRouter(prefix="/analytics", tags=["analytics"])

from typing import Optional
from app.utils.kpi_engine import ProjectKPIEngine, format_currency, get_status_color

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
                        "title": {"$ifNull": ["$title", "$task_name", "Sin Título"]},
                        "status": "$status",
                        "start_date": "$start_date",
                        "due_date": "$due_date",
                        "estimated_hours": "$estimated_hours",
                        "logged_hours": {"$ifNull": ["$logged_hours", 0]},
                        "progress": {"$ifNull": ["$progress", 0]}
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

@router.get("/kpi-cards")
async def get_kpi_cards(
    project_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Retorna tarjetas de KPI con métricas EVM y Agile.
    Diseñado para el dashboard principal con visualizaciones D3.js.
    """
    db = get_database()
    owner_id = str(current_user.id)
    
    try:
        # 1. Obtener todas las tareas del usuario
        match_stage = {"owner_id": owner_id}
        if project_id and project_id != "ALL":
            match_stage["project_id"] = project_id
        
        tasks_cursor = db.tasks.find(match_stage)
        tasks_list = await tasks_cursor.to_list(length=None)
        
        # 2. Convertir a DataFrame
        if not tasks_list:
            # Retornar valores por defecto si no hay tareas
            return {
                "kpi_cards": [
                    {
                        "id": "financial_health",
                        "title": "Eficiencia de Costos (CPI)",
                        "value": 1.0,
                        "status": "neutral",
                        "meta": {
                            "label": "Proyección Final (EAC)",
                            "value": "$0",
                            "variance": "$0"
                        },
                        "trend_data": [1.0, 1.0, 1.0, 1.0, 1.0]
                    },
                    {
                        "id": "schedule_health",
                        "title": "Desempeño Cronograma (SPI)",
                        "value": 1.0,
                        "status": "neutral",
                        "meta": {
                            "label": "Estado",
                            "value": "Sin datos",
                            "variance": "0 días"
                        },
                        "trend_data": [1.0, 1.0, 1.0, 1.0, 1.0]
                    },
                    {
                        "id": "agility",
                        "title": "Cycle Time Promedio",
                        "value": "0.0 días",
                        "status": "neutral",
                        "delta": {
                            "value": 0,
                            "direction": "neutral",
                            "comparison": "vs semana anterior"
                        },
                        "meta": {
                            "label": "Eficiencia de Flujo",
                            "value": "0%"
                        }
                    }
                ]
            }
        
        # Preparar datos para el DataFrame
        df_data = []
        for task in tasks_list:
            df_data.append({
                'task_id': str(task.get('_id')),
                'assigned_to': task.get('assigned_to', 'Unassigned'),
                'status': task.get('status', 'PENDING').replace('_', ' ').title() if task.get('status') == 'COMPLETED' else task.get('status', 'PENDING'),
                'planned_value': float(task.get('estimated_hours', 0) * 100),  # Convertir horas a valor monetario simulado
                'actual_cost': float(task.get('logged_hours', 0) * 100),  # Horas registradas como costo
                'percent_complete': float(task.get('progress', 0)),
                'date_created': task.get('created_at'),
                'date_started': task.get('start_date'),
                'date_completed': task.get('completed_at')
            })
        
        # Ajustar el status para que coincida con lo esperado por el motor
        for item in df_data:
            if 'Completed' in str(item['status']) or 'COMPLETED' in str(item['status']):
                item['status'] = 'Completed'
        
        df = pd.DataFrame(df_data)
        
        # 3. Obtener presupuesto del proyecto
        project_budget = 100000.0  # Default
        if project_id and project_id != "ALL":
            try:
                project = await db.projects.find_one({"_id": ObjectId(project_id)})
                if project and 'budget' in project:
                    project_budget = float(project['budget'])
            except:
                pass
        else:
            # Calcular presupuesto total de todos los proyectos
            projects = await db.projects.find({"owner_id": owner_id}).to_list(length=None)
            total_budget = sum(float(p.get('budget', 0)) for p in projects)
            if total_budget > 0:
                project_budget = total_budget
        
        # 4. Inicializar motor de KPIs
        engine = ProjectKPIEngine(tasks_df=df, project_budget=project_budget)
        
        # 5. Calcular métricas
        evm_metrics = engine.calculate_evm_metrics()
        agile_metrics = engine.calculate_agile_metrics()
        trend_data = engine.calculate_trend_data()
        
        # 6. Construir tarjetas de KPI
        
        # Tarjeta 1: Eficiencia de Costos (CPI)
        cpi = evm_metrics['CPI']
        eac = evm_metrics['EAC_Projection']
        variance = evm_metrics['Budget_Variance']
        
        card_financial = {
            "id": "financial_health",
            "title": "Eficiencia de Costos (CPI)",
            "value": cpi,
            "status": get_status_color('CPI', cpi),
            "meta": {
                "label": "Proyección Final (EAC)",
                "value": format_currency(eac),
                "variance": f"{'+' if variance < 0 else ''}{format_currency(abs(variance))}"
            },
            "trend_data": trend_data['cpi_trend']
        }
        
        # Tarjeta 2: Desempeño del Cronograma (SPI)
        spi = evm_metrics['SPI']
        sv = evm_metrics['SV']
        
        # Calcular días de adelanto/retraso (aproximado)
        avg_task_value = df['planned_value'].mean() if len(df) > 0 else 1000
        days_variance = (sv / avg_task_value) if avg_task_value > 0 else 0
        
        status_text = "Adelantado" if spi >= 1.0 else "Retrasado"
        
        card_schedule = {
            "id": "schedule_health",
            "title": "Desempeño Cronograma (SPI)",
            "value": spi,
            "status": get_status_color('SPI', spi),
            "meta": {
                "label": "Estado",
                "value": status_text,
                "variance": f"{abs(days_variance):.1f} días"
            },
            "trend_data": trend_data['spi_trend']
        }
        
        # Tarjeta 3: Velocidad de Entrega (Cycle Time)
        cycle_time = agile_metrics['Avg_Cycle_Time_Days']
        process_efficiency = agile_metrics['Process_Efficiency']
        
        # Simular delta vs semana anterior (en producción, esto vendría de datos históricos)
        delta_value = -0.5 if cycle_time > 0 else 0
        delta_direction = "down" if delta_value < 0 else ("up" if delta_value > 0 else "neutral")
        
        card_agility = {
            "id": "agility",
            "title": "Cycle Time Promedio",
            "value": f"{cycle_time} días",
            "status": "neutral",
            "delta": {
                "value": delta_value,
                "direction": delta_direction,
                "comparison": "vs semana anterior"
            },
            "meta": {
                "label": "Eficiencia de Flujo",
                "value": f"{process_efficiency}%"
            }
        }
        
        return {
            "kpi_cards": [card_financial, card_schedule, card_agility]
        }
        
    except Exception as e:
        print(f"Error calculating KPIs: {e}")
        import traceback
        traceback.print_exc()
        
        # Retornar valores seguros en caso de error
        return {
            "kpi_cards": [
                {
                    "id": "financial_health",
                    "title": "Eficiencia de Costos (CPI)",
                    "value": 1.0,
                    "status": "neutral",
                    "meta": {"label": "Error", "value": "Datos no disponibles", "variance": "$0"},
                    "trend_data": [1.0, 1.0, 1.0, 1.0, 1.0]
                },
                {
                    "id": "schedule_health",
                    "title": "Desempeño Cronograma (SPI)",
                    "value": 1.0,
                    "status": "neutral",
                    "meta": {"label": "Error", "value": "Datos no disponibles", "variance": "0 días"},
                    "trend_data": [1.0, 1.0, 1.0, 1.0, 1.0]
                },
                {
                    "id": "agility",
                    "title": "Cycle Time Promedio",
                    "value": "0.0 días",
                    "status": "neutral",
                    "delta": {"value": 0, "direction": "neutral", "comparison": "vs semana anterior"},
                    "meta": {"label": "Error", "value": "Datos no disponibles"}
                }
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


@router.get("/talent-performance")
async def get_talent_performance(
    project_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Returns advanced talent metrics:
    - OTD (On Time Delivery)
    - Workload Heatmap
    - Blocked Rate (Proxy for Churn/Quality)
    """
    db = get_database()
    owner_id = str(current_user.id)
    
    # 1. Base Match
    match_stage = {"owner_id": owner_id}
    if project_id and project_id != "ALL":
        match_stage["project_id"] = project_id
    
    # Date Filtering Logic
    date_query = {}
    if start_date:
        date_query["$gte"] = datetime.fromisoformat(start_date.replace("Z", ""))
    if end_date:
        date_query["$lte"] = datetime.fromisoformat(end_date.replace("Z", ""))
        
    if date_query:
        # Filter by tasks active in this range (created before end, completed after start or null)
        # Simplified: Filter by due_date for OTD, created_at for general
        pass # We'll do in-memory filtering for complex overlap logic to keep mongo simple
        
    tasks = await db.tasks.find(match_stage).to_list(length=2000)
    
    # Data Structures
    resources_stats = {} # { "UserA": { "total": 0, "on_time": 0, "blocked": 0, "workload_hours": 0 } }
    
    now = datetime.utcnow()
    
    for task in tasks:
        assignee = task.get("assigned_to") or "Unassigned"
        status = task.get("status", "PENDING")
        
        if assignee not in resources_stats:
            resources_stats[assignee] = {
                "total_tasks": 0,
                "completed_tasks": 0,
                "on_time_tasks": 0,
                "blocked_tasks": 0,
                "active_tasks": 0,
                "total_hours_assigned": 0,
                "pending_high_priority": 0,
                # Granular Status Counts
                "status_counts": {
                    "PENDING": 0,
                    "IN_PROGRESS": 0,
                    "BLOCKED": 0,
                    "ON_HOLD": 0,
                    "COMPLETED": 0
                }
            }
            
        stats = resources_stats[assignee]
        stats["total_tasks"] += 1
        
        # Helper to normalize status (MATCHING CLIENT-SIDE LOGIC FROM charts.js)
        raw_status = status.upper().replace(" ", "_")
        if "COMPLET" in raw_status or "DONE" in raw_status: normalized = "COMPLETED"
        elif "BLOCK" in raw_status: normalized = "BLOCKED"
        elif "HOLD" in raw_status or "WAIT" in raw_status: normalized = "ON_HOLD"
        elif "PROG" in raw_status: normalized = "IN_PROGRESS"
        else: normalized = "PENDING"
        
        stats["status_counts"][normalized] += 1
        
        # OTD Calculation (Only for completed tasks)
        if status == "COMPLETED":
            stats["completed_tasks"] += 1
            due_date = task.get("due_date")
            completed_at = task.get("completed_at") or task.get("updated_at") # Fallback
            
            # If we considered "On Time" as completed <= due_date
            if due_date and completed_at:
                if isinstance(completed_at, str): completed_at = datetime.fromisoformat(completed_at.replace("Z", ""))
                if isinstance(due_date, str): due_date = datetime.fromisoformat(due_date.replace("Z", ""))
                
                if completed_at <= due_date + timedelta(hours=4): # 4 hour grace period
                    stats["on_time_tasks"] += 1
        
        # Blocked / active stats
        if status == "BLOCKED":
            stats["blocked_tasks"] += 1
            
        if normalized in ["PENDING", "IN_PROGRESS", "BLOCKED", "ON_HOLD"]:
            stats["active_tasks"] += 1
            if task.get("priority") == "High":
                stats["pending_high_priority"] += 1
                
        # Workload (Hours)
        if status != "CANCELLED":
            stats["total_hours_assigned"] += task.get("estimated_hours", 0)

    # Final Aggregation
    result_list = []
    
    total_otd_sum = 0
    otd_count = 0
    total_overloaded = 0
    
    for name, s in resources_stats.items():
        # OTD %
        otd_score = 0
        if s["completed_tasks"] > 0:
            otd_score = (s["on_time_tasks"] / s["completed_tasks"]) * 100
            total_otd_sum += otd_score
            otd_count += 1
            
        # Blocked Rate % (of active tasks)
        blocked_rate = 0
        if s["active_tasks"] > 0:
            blocked_rate = (s["blocked_tasks"] / s["active_tasks"]) * 100
            
        # Workload Score (Simplified cap check)
        if s["total_hours_assigned"] > 40: # Simple threshold for "Overloaded" metric
            total_overloaded += 1
            
        result_list.append({
            "name": name,
            "otd_score": round(otd_score, 1),
            "blocked_rate": round(blocked_rate, 1),
            "workload_hours": round(s["total_hours_assigned"], 1),
            "pending_high_priority": s["pending_high_priority"],
            "status_breakdown": s["status_counts"]
        })
        
    # --- PERSONAL DASHBOARD / MY WORKSPACE LOGIC ---
    
    # --- PERSONAL DASHBOARD / MY WORKSPACE LOGIC (REAL DATA) ---
    
    # Identify Current User Name for matching
    user_name = current_user.full_name if hasattr(current_user, "full_name") else current_user.username
    
    # 1. Vital Signs (Global Header)
    
    # A. Velocity (Tasks completed per week for the last 5 weeks)
    # responsive to all tasks in DB (filtered by owner/project)
    
    velocity_trend = [0, 0, 0, 0, 0] # [-4 weeks, -3, -2, -1, current]
    current_week_num = datetime.utcnow().isocalendar()[1]
    
    for t in tasks:
        if t.get("status") == "COMPLETED" and t.get("completed_at"):
            c_date = t.get("completed_at")
            if isinstance(c_date, str): 
                try:
                    c_date = datetime.fromisoformat(c_date.replace("Z", ""))
                except:
                    continue
            
            # Simple week diff check
            # Note: This is a rough approximation. For production, strict date ranges are better.
            weeks_ago = current_week_num - c_date.isocalendar()[1]
            if 0 <= weeks_ago < 5:
                velocity_trend[4 - weeks_ago] += 1
                
    current_velocity = velocity_trend[-1]
    
    # B. OTD Score (From already calculated resources_stats if available, else 0)
    user_stats = resources_stats.get(user_name)
    if not user_stats:
        # Try to find a partial match or fallback to first if filtered? 
        # Actually, let's just calc from raw tasks if name doesn't match perfectly
        # But resources_stats is keyed by 'assigned_to'.
        otd_score = 0.0
    else:
        otd_score = 0
        if user_stats["completed_tasks"] > 0:
            otd_score = round((user_stats["on_time_tasks"] / user_stats["completed_tasks"]) * 100, 1)

    # C. Focus Mode
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    focus_tasks_count = sum(1 for t in tasks if t.get("priority") == "High" and t.get("status") not in ["COMPLETED", "CANCELLED"])
    
    # D. Gamification (Mock for now as we don't have an XP system yet)
    gamification = {
        "xp_weekly": {"python": 150, "sql": 50, "architecture": 75}, # Placeholder
        "level": "Level 12 - Code Wizard",
        "badges": ["Bug Hunter", "Clean Coder"]
    }

    # 2. Project Data (Accordions)
    # Group tasks by project
    projects_map = {} # { pid: { name: "", tasks: [] } }
    
    for t in tasks:
        pid = t.get("project_id", "unknown")
        pname = t.get("project_name") or t.get("project", "Sin Proyecto")
        
        if pid not in projects_map:
            projects_map[pid] = {"name": pname, "tasks": [], "total": 0, "done": 0}
            
        # Add efficiency/check fields if missing
        if "efficiency" not in t:
             t["efficiency"] = 100 # Default
             
        projects_map[pid]["tasks"].append({
            "id": str(t.get("_id")),
            "name": t.get("name", "Untitled"),
            "status": t.get("status", "Pending"),
            "due": t.get("due_date", ""),
            "priority": t.get("priority", "Medium"),
            "blocker": t.get("blocker_reason"),
            "days_blocked": t.get("days_blocked", 0),
            "completed_date": t.get("completed_at", ""),
            "efficiency": t.get("efficiency", 100)
        })
        
        projects_map[pid]["total"] += 1
        if t.get("status") == "COMPLETED":
            projects_map[pid]["done"] += 1

    projects_data = []
    
    for pid, pdata in projects_map.items():
        p_tasks = pdata["tasks"]
        
        # Lists
        pending = [tk for tk in p_tasks if tk["status"] in ["PENDING", "IN_PROGRESS", "Pending", "In Progress"]]
        blocked = [tk for tk in p_tasks if tk["status"] in ["BLOCKED", "Blocked", "ON_HOLD"]]
        completed = [tk for tk in p_tasks if tk["status"] in ["COMPLETED", "Completed", "DONE", "Done"]]
        
        # Calc Progress
        progress = 0
        if pdata["total"] > 0:
            progress = int((pdata["done"] / pdata["total"]) * 100)
            
        # Status Color
        status_color = "green"
        status_summary = "Active"
        if len(blocked) > 0:
            status_color = "red"
            status_summary = f"{len(blocked)} Blocked"
        elif progress == 100:
            status_color = "blue"
            status_summary = "Completed"
            
        projects_data.append({
            "project_name": pdata["name"],
            "progress_bar": progress,
            "status_summary": status_summary, 
            "status_color": status_color,
            "counts": {
                "pending": len(pending),
                "blocked": len(blocked),
                "done": len(completed)
            },
            "columns": {
                "pending_list": pending,
                "blocked_list": blocked,
                "done_list": completed
            }
        })
    
    # Return structure matching the new "Personal Workspace" requirements
    # Calculate Team KPIs from the result_list (Legacy/Manager View)
    team_kpis = {
        "avg_otd_score": round(sum(r["otd_score"] for r in result_list) / len(result_list), 1) if result_list else 0,
        "total_overloaded_users": sum(1 for r in result_list if r["workload_hours"] > 40),
        "active_resources": len(result_list)
    }

    # Consolidated Return: Personal Workspace + Team Overview
    return {
        "user_header": {
            "velocity": {"current": current_velocity, "trend": velocity_trend},
            "otd_score": otd_score,
            "focus_tasks": focus_tasks_count,
            "gamification": gamification
        },
        "project_cards": projects_data,
        
        # Legacy/Team Fields
        "kpis": team_kpis,
        "resources": result_list
    }
