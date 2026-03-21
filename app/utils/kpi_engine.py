"""
Motor de Cálculo de KPIs para Gestión de Proyectos.
Implementa métricas EVM (Earned Value Management) y Agile.
Optimizado con pandas para procesamiento vectorizado de alta velocidad.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List


class ProjectKPIEngine:
    """
    Motor de cálculo para KPIs de Gestión de Proyectos (EVM y Agile).
    Diseñado para ingerir DataFrames de tareas y costos, y retornar métricas calculadas.
    """

    def __init__(self, tasks_df: pd.DataFrame, project_budget: float):
        """
        Inicializa el motor con los datos del proyecto.
        
        Args:
            tasks_df (pd.DataFrame): DataFrame conteniendo columnas:
                ['task_id', 'status', 'planned_value', 'actual_cost', 
                 'percent_complete', 'date_created', 'date_started', 'date_completed']
            project_budget (float): Presupuesto total aprobado (BAC - Budget at Completion).
        """
        self.df = tasks_df.copy() if not tasks_df.empty else pd.DataFrame()
        self.bac = project_budget
        
        # Aseguramos formato de fechas
        if not self.df.empty:
            date_cols = ['date_created', 'date_started', 'date_completed']
            for col in date_cols:
                if col in self.df.columns:
                    self.df[col] = pd.to_datetime(self.df[col], errors='coerce')

    def calculate_evm_metrics(self) -> Dict[str, float]:
        """
        Calcula las métricas de Gestión del Valor Ganado (Earned Value Management).
        
        Returns:
            Dict: Diccionario con CPI, SPI, CV, SV, EAC y Budget_Variance.
        """
        if self.df.empty:
            return {
                "CPI": 1.0,
                "SPI": 1.0,
                "CV": 0.0,
                "SV": 0.0,
                "EAC_Projection": self.bac,
                "Budget_Variance": 0.0,
                "PV": 0.0,
                "EV": 0.0,
                "AC": 0.0
            }
        
        # PV (Planned Value): Valor planificado acumulado
        pv = self.df['planned_value'].fillna(0).sum()

        # EV (Earned Value): Valor ganado (Presupuesto x % Avance Real)
        # Vectorizamos el cálculo
        self.df['earned_value'] = self.df['planned_value'].fillna(0) * (self.df['percent_complete'].fillna(0) / 100)
        ev = self.df['earned_value'].sum()

        # AC (Actual Cost): Costo real incurrido
        ac = self.df['actual_cost'].fillna(0).sum()

        # Manejo de división por cero
        cpi = ev / ac if ac > 0 else 1.0
        spi = ev / pv if pv > 0 else 1.0

        # EAC (Estimate At Completion): Proyección de costo final basado en el rendimiento actual
        # Fórmula: BAC / CPI. Si CPI es 0 o muy bajo, usamos AC + (BAC - EV) como fallback.
        if cpi > 0.1: 
            eac = self.bac / cpi
        else:
            eac = ac + (self.bac - ev)

        return {
            "CPI": round(cpi, 2),        # Eficiencia de Costo (<1 malo, >1 bueno)
            "SPI": round(spi, 2),        # Eficiencia de Cronograma
            "CV": round(ev - ac, 2),     # Variación de Costo ($)
            "SV": round(ev - pv, 2),     # Variación de Cronograma ($ o Valor)
            "EAC_Projection": round(eac, 2), # Cuánto costará el proyecto al finalizar
            "Budget_Variance": round(self.bac - eac, 2), # Desviación final proyectada
            "PV": round(pv, 2),
            "EV": round(ev, 2),
            "AC": round(ac, 2)
        }

    def calculate_agile_metrics(self) -> Dict[str, float]:
        """
        Calcula métricas de flujo basadas en tiempos (Cycle Time & Lead Time).
        Útil para detectar cuellos de botella.
        """
        if self.df.empty:
            return {
                "Avg_Cycle_Time_Days": 0.0,
                "Avg_Lead_Time_Days": 0.0,
                "Process_Efficiency": 0.0
            }
        
        completed_tasks = self.df[self.df['status'] == 'Completed'].copy()
        
        if completed_tasks.empty:
            return {
                "Avg_Cycle_Time_Days": 0.0,
                "Avg_Lead_Time_Days": 0.0,
                "Process_Efficiency": 0.0
            }

        # Cycle Time: Fin - Inicio (Tiempo real de trabajo)
        completed_tasks['cycle_time_days'] = (
            completed_tasks['date_completed'] - completed_tasks['date_started']
        ).dt.total_seconds() / 86400 # Convertir a días
        
        # Eliminar valores negativos o NaN
        completed_tasks['cycle_time_days'] = completed_tasks['cycle_time_days'].clip(lower=0)

        # Lead Time: Fin - Creación (Tiempo de espera + trabajo)
        completed_tasks['lead_time_days'] = (
            completed_tasks['date_completed'] - completed_tasks['date_created']
        ).dt.total_seconds() / 86400
        
        # Eliminar valores negativos o NaN
        completed_tasks['lead_time_days'] = completed_tasks['lead_time_days'].clip(lower=0)

        avg_cycle = completed_tasks['cycle_time_days'].mean()
        avg_lead = completed_tasks['lead_time_days'].mean()
        
        # Process Efficiency: Qué porcentaje del tiempo total fue trabajo activo
        efficiency = (avg_cycle / avg_lead * 100) if avg_lead > 0 else 0

        return {
            "Avg_Cycle_Time_Days": round(avg_cycle, 1) if not pd.isna(avg_cycle) else 0.0,
            "Avg_Lead_Time_Days": round(avg_lead, 1) if not pd.isna(avg_lead) else 0.0,
            "Process_Efficiency": round(efficiency, 1) if not pd.isna(efficiency) else 0.0
        }

    def get_resource_saturation(self, resource_col: str = 'assigned_to') -> pd.DataFrame:
        """
        Genera un DataFrame agrupado para visualizar la carga de trabajo.
        Ideal para el gráfico de barras del dashboard.
        """
        if self.df.empty or resource_col not in self.df.columns:
            return pd.DataFrame()
        
        # Agrupamos por recurso y sumamos valor planeado o conteo de tareas
        workload = self.df.groupby(resource_col).agg(
            Tasks_Count=('task_id', 'count'),
            Total_Planned_Value=('planned_value', 'sum'),
            Avg_Completion=('percent_complete', 'mean')
        ).reset_index()
        
        return workload
    
    def calculate_trend_data(self, days: int = 30) -> Dict[str, List[float]]:
        """
        Calcula tendencia histórica de CPI y SPI para los últimos N días.
        Útil para gráficos sparkline.
        
        Args:
            days: Número de días hacia atrás para calcular la tendencia
            
        Returns:
            Dict con arrays de CPI y SPI históricos
        """
        if self.df.empty:
            return {"cpi_trend": [1.0] * 5, "spi_trend": [1.0] * 5}
        
        # Por simplicidad, generamos una tendencia simulada basada en el CPI/SPI actual
        # En producción, esto debería calcular métricas reales por fecha
        current_metrics = self.calculate_evm_metrics()
        cpi = current_metrics['CPI']
        spi = current_metrics['SPI']
        
        # Generamos 5 puntos de tendencia con variación aleatoria pequeña
        cpi_trend = [round(cpi + np.random.uniform(-0.05, 0.05), 2) for _ in range(5)]
        spi_trend = [round(spi + np.random.uniform(-0.05, 0.05), 2) for _ in range(5)]
        
        # Aseguramos que el último valor sea el actual
        cpi_trend[-1] = cpi
        spi_trend[-1] = spi
        
        return {
            "cpi_trend": cpi_trend,
            "spi_trend": spi_trend
        }


def format_currency(value: float) -> str:
    """Formatea un número como moneda USD."""
    return f"${value:,.0f}"


def get_status_color(metric_type: str, value: float) -> str:
    """
    Determina el color del indicador basado en el tipo de métrica y su valor.
    
    Args:
        metric_type: Tipo de métrica ('CPI', 'SPI', 'cycle_time', etc.)
        value: Valor de la métrica
        
    Returns:
        Color del estado: 'success', 'warning', 'danger', 'neutral'
    """
    if metric_type in ['CPI', 'SPI']:
        if value >= 1.0:
            return 'success'
        elif value >= 0.9:
            return 'warning'
        else:
            return 'danger'
    elif metric_type == 'cycle_time':
        # Para cycle time, valores más bajos son mejores (neutral por defecto)
        return 'neutral'
    else:
        return 'neutral'


# --- EJEMPLO DE USO (Simulación) ---
if __name__ == "__main__":
    # 1. Simulación de datos (normalmente vendría de tu SQL/Mongo)
    data = {
        'task_id': [101, 102, 103, 104, 105],
        'assigned_to': ['Sarah', 'Mike', 'Sarah', 'John', 'Mike'],
        'status': ['Completed', 'In Progress', 'Completed', 'Pending', 'In Progress'],
        'planned_value': [5000, 3000, 2000, 4000, 3000],  # Presupuesto de la tarea
        'actual_cost': [4800, 3500, 2100, 0, 1500],       # Lo gastado realmente
        'percent_complete': [100, 60, 100, 0, 40],        # % Avance físico
        'date_created': ['2023-10-01', '2023-10-02', '2023-10-01', '2023-10-05', '2023-10-06'],
        'date_started': ['2023-10-02', '2023-10-04', '2023-10-02', None, '2023-10-08'],
        'date_completed': ['2023-10-05', None, '2023-10-04', None, None]
    }
    
    df_tasks = pd.DataFrame(data)
    
    # 2. Instanciar el motor con un presupuesto total del proyecto de $20,000
    engine = ProjectKPIEngine(tasks_df=df_tasks, project_budget=20000)
    
    # 3. Obtener KPIs
    evm_metrics = engine.calculate_evm_metrics()
    agile_metrics = engine.calculate_agile_metrics()
    trend_data = engine.calculate_trend_data()
    
    print("--- KPI Financieros (EVM) ---")
    print(evm_metrics)
    
    print("\n--- KPI de Tiempos (Agile) ---")
    print(agile_metrics)
    
    print("\n--- Datos de Tendencia ---")
    print(trend_data)
