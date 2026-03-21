"""
Script para poblar datos de prueba en las tareas existentes
Agrega campos necesarios para cálculos EVM: estimated_hours, logged_hours, progress
"""
import asyncio
import os
import random
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def populate_task_data():
    # Cargar variables de entorno
    load_dotenv()
    
    # Conectar a MongoDB
    mongodb_url = os.getenv('MONGO_URL')
    db_name = os.getenv('DB_NAME', 'PM_BD1')
    
    if not mongodb_url:
        print("❌ MONGO_URL no encontrado en .env")
        return
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    print("=" * 60)
    print("POBLANDO DATOS DE PRUEBA EN TAREAS")
    print("=" * 60)
    print()
    
    # Obtener todas las tareas
    tasks = await db.tasks.find({}).to_list(1000)
    
    print(f"📊 Total de tareas a actualizar: {len(tasks)}")
    print()
    
    updated_count = 0
    
    for task in tasks:
        task_id = task['_id']
        status = task.get('status', 'PENDING')
        
        # Generar datos basados en el status
        if 'COMPLETED' in status.upper():
            # Tareas completadas: datos completos
            estimated_hours = round(random.uniform(4, 24), 1)
            logged_hours = round(estimated_hours * random.uniform(1.0, 1.3), 1)  # 100-130%
            progress = 100.0
        
        elif 'IN_PROGRESS' in status.upper() or 'PROGRESS' in status.upper():
            # Tareas en progreso: parcialmente completadas
            estimated_hours = round(random.uniform(8, 40), 1)
            progress = round(random.uniform(35, 75), 1)
            logged_hours = round(estimated_hours * (progress / 100) * random.uniform(0.8, 1.2), 1)
        
        else:  # PENDING, TODO, etc.
            # Tareas pendientes: sin progreso
            estimated_hours = round(random.uniform(2, 16), 1)
            logged_hours = round(random.uniform(0, estimated_hours * 0.1), 1)  # 0-10%
            progress = round(random.uniform(0, 15), 1)
        
        # Actualizar la tarea
        update_data = {
            "$set": {
                "estimated_hours": estimated_hours,
                "logged_hours": logged_hours,
                "progress": progress
            }
        }
        
        await db.tasks.update_one({"_id": task_id}, update_data)
        updated_count += 1
        
        # Mostrar progreso cada 50 tareas
        if updated_count % 50 == 0:
            print(f"   ✅ Actualizadas {updated_count} tareas...")
    
    print()
    print(f"✅ Actualización completa: {updated_count} tareas")
    print()
    
    # Verificar que los datos se hayan guardado
    tasks_with_evm_data = await db.tasks.count_documents({
        "estimated_hours": {"$exists": True, "$gt": 0},
        "logged_hours": {"$exists": True},
        "progress": {"$exists": True}
    })
    
    print(f"📈 Tareas con datos completos para EVM: {tasks_with_evm_data}")
    print()
    
    # Mostrar muestra de tareas actualizadas
    print("📝 Muestra de tareas actualizadas (primeras 5):")
    updated_tasks = await db.tasks.find({"estimated_hours": {"$gt": 0}}).limit(5).to_list(5)
    
    for i, task in enumerate(updated_tasks, 1):
        print(f"\n   Tarea {i}: {task.get('title', 'N/A')}")
        print(f"   - Status: {task.get('status')}")
        print(f"   - estimated_hours: {task.get('estimated_hours')} h")
        print(f"   - logged_hours: {task.get('logged_hours')} h")
        print(f"   - progress: {task.get('progress')}%")
    
    print("\n" + "=" * 60)
    print("DATOS POBLADOS EXITOSAMENTE")
    print("=" * 60)
    print()
    print("💡 Ahora puedes recargar el dashboard para ver las métricas correctas")

if __name__ == "__main__":
    asyncio.run(populate_task_data())
