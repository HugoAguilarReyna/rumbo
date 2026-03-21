"""
Script de diagnóstico para tarjetas KPI
Verifica datos en MongoDB para identificar el problema
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime

async def diagnose_kpi_data():
    # Cargar variables de entorno
    load_dotenv()
    
    # Conectar a MongoDB
    mongodb_url = os.getenv('MONGO_URL')  # Nombre correcto según .env
    db_name = os.getenv('DB_NAME', 'PM_BD1')  # Default según .env
    
    if not mongodb_url:
        print("❌ MONGO_URL no encontrado en .env")
        return
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]  # Usar nombre de BD del .env
    
    print("=" * 60)
    print("DIAGNÓSTICO DE DATOS PARA TARJETAS KPI")
    print("=" * 60)
    print(f"🔗 Conectado a: {db_name}")
    print()
    
    # 1. Verificar cantidad total de tareas
    total_tasks = await db.tasks.count_documents({})
    print(f"📊 Total de tareas en la BD: {total_tasks}")
    
    if total_tasks == 0:
        print("\n❌ NO HAY TAREAS EN LA BASE DE DATOS")
        print("   Esto explica por qué las tarjetas KPI muestran valores por defecto.")
        print("   Solución: Crear tareas de prueba con datos completos.")
        return
    
    # 2. Verificar usuarios en la BD
    total_users = await db.users.count_documents({})
    print(f"👥 Total de usuarios en la BD: {total_users}")
    
    if total_users > 0:
        users = await db.users.find().to_list(10)
        print("\n📋 Usuarios encontrados:")
        for user in users:
            user_id = str(user.get('_id'))
            username = user.get('username', 'N/A')
            email = user.get('email', 'N/A')
            print(f"   - ID: {user_id}")
            print(f"     Username: {username}, Email: {email}")
            
            # Verificar tareas de este usuario
            user_tasks_count = await db.tasks.count_documents({"owner_id": user_id})
            print(f"     Tareas asociadas: {user_tasks_count}")
    
    print()
    
    # 3. Verificar estructura de las tareas
    print("📝 Muestra de tareas (primeras 3):")
    tasks = await db.tasks.find().limit(3).to_list(3)
    
    for i, task in enumerate(tasks, 1):
        print(f"\n   Tarea {i}:")
        print(f"   - ID: {task.get('_id')}")
        print(f"   - Título: {task.get('title', 'N/A')}")
        print(f"   - owner_id: {task.get('owner_id', 'MISSING ❌')}")
        print(f"   - Status: {task.get('status', 'N/A')}")
        print(f"   - estimated_hours: {task.get('estimated_hours', 'MISSING ❌')}")
        print(f"   - logged_hours: {task.get('logged_hours', 'MISSING ❌')}")
        print(f"   - progress: {task.get('progress', 'MISSING ❌')}")
        print(f"   - created_at: {task.get('created_at', 'N/A')}")
        print(f"   - completed_at: {task.get('completed_at', 'N/A')}")
    
    # 4. Verificar si hay tareas con datos completos para EVM
    tasks_with_evm_data = await db.tasks.count_documents({
        "estimated_hours": {"$exists": True, "$gt": 0},
        "logged_hours": {"$exists": True},
        "progress": {"$exists": True}
    })
    
    print(f"\n📈 Tareas con datos completos para EVM: {tasks_with_evm_data}")
    
    if tasks_with_evm_data == 0:
        print("   ❌ Ninguna tarea tiene los campos necesarios para calcular métricas EVM")
        print("   Campos requeridos: estimated_hours > 0, logged_hours, progress")
    
    # 5. Verificar si hay tareas completadas
    completed_tasks = await db.tasks.count_documents({"status": {"$regex": "COMPLETED", "$options": "i"}})
    print(f"\n✅ Tareas completadas: {completed_tasks}")
    
    if completed_tasks == 0:
        print("   ⚠️  No hay tareas completadas, las métricas Agile podrían estar vacías")
    
    print("\n" + "=" * 60)
    print("FIN DEL DIAGNÓSTICO")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(diagnose_kpi_data())
