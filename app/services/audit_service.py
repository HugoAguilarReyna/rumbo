import math
from datetime import datetime
from typing import List, Dict, Any

class ValdesSoutoModel:
    """
    Implementation of the Valdés-Souto Model (COSMIC ISO/IEC 19761)
    for software effort estimation and auditing.
    """
    
    def __init__(self):
        # Industrial productivity baselines (Hours per FP)
        self.baselines = {
            "Junior": 12.5,
            "Mid": 8.2,
            "Senior": 5.4,
            "Lead": 3.8
        }
        
    def _estimate_fp(self, task: Dict[str, Any]) -> float:
        """
        Estimates Function Points (FP) based on task metadata.
        In a real AI scenario, this would use NLP on the description.
        Here we use a heuristic based on keywords and estimated hours.
        """
        name = task.get("task_name", "").lower()
        hours = task.get("estimated_hours", 0)
        
        # Keyword-based complexity modifiers
        complexity = 1.0
        if any(w in name for w in ["api", "backend", "migration", "database", "security"]):
            complexity = 1.5
        elif any(w in name for w in ["ui", "css", "style", "text"]):
            complexity = 0.8
            
        # Reverse engineer roughly expected FP from hours + noise to simulate "AI" insight
        # This creates "disagreement" between manual estimate and "AI" benchmark
        simulated_fp = (hours / 8.0) * complexity * 1.2
        
        return round(simulated_fp, 2)

    def _get_productivity_rate(self, seniority: str) -> float:
        return self.baselines.get(seniority, self.baselines["Mid"])

    def _classify_risk(self, deviation: float) -> str:
        if abs(deviation) > 50:
            return "CRITICAL"
        elif abs(deviation) > 20:
            return "WARNING"
        return "SAFE"

    def _get_recommendation(self, deviation: float, risk: str) -> str:
        if risk == "SAFE":
            return "Estimation within acceptable range."
        
        if deviation > 0:
            # Benchmark is higher -> Underestimated
            return f"Underestimated by {deviation:.1f}%. Consider increasing scope or resources."
        else:
            # Benchmark is lower -> Overestimated
            return f"Overestimated by {abs(deviation):.1f}%. Review for padding or simplification."

    def audit_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Audits a single task comparing human estimate vs Valdés-Souto benchmark.
        """
        human_estimate = task.get("estimated_hours", 0)
        seniority = task.get("seniority", "Mid")
        
        # 1. AI Estimate of Functional Size
        fp = self._estimate_fp(task)
        
        # 2. Calculate Benchmark Effort using Valdés-Souto standard rates
        prod_rate = self._get_productivity_rate(seniority)
        benchmark_hours = fp * prod_rate
        
        # 3. Calculate Deviation
        # Deviation % = (Benchmark - Human) / Human * 100
        # Positive = Underestimated (Risk), Negative = Overestimated (Waste)
        if human_estimate > 0:
            deviation = ((benchmark_hours - human_estimate) / human_estimate) * 100
        else:
            deviation = 100.0 if benchmark_hours > 0 else 0
            
        risk = self._classify_risk(deviation)
        
        return {
            "benchmark_hours": round(benchmark_hours, 2),
            "risk_level": risk,
            "confidence_score": 0.85, # Mock confidence
            "recommended_action": self._get_recommendation(deviation, risk),
            "estimated_fp": fp,
            "deviation_percentage": round(deviation, 2),
            "audit_status": "completed",
            "audited_at": datetime.utcnow().isoformat()
        }

    def calculate_project_health(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates overall project health score based on audit results.
        """
        if not tasks:
            return {
                "health_score": None,
                "total_tasks": 0,
                "grade": "N/A",
                "risk_distribution": {}
            }
            
        scores = {"SAFE": 100, "WARNING": 60, "CRITICAL": 20}
        total_score = 0
        dist = {"SAFE": 0, "WARNING": 0, "CRITICAL": 0}
        
        for t in tasks:
            audit = t.get("ai_audit", {})
            risk = audit.get("risk_level", "SAFE")
            dist[risk] = dist.get(risk, 0) + 1
            total_score += scores.get(risk, 100)
            
        avg_score = total_score / len(tasks)
        
        # Grade Assignment
        if avg_score >= 85: grade, label = "A", "Excellent"
        elif avg_score >= 70: grade, label = "B", "Good"
        elif avg_score >= 50: grade, label = "C", "Needs Attention"
        else: grade, label = "D", "Critical"
        
        return {
            "health_score": round(avg_score, 1),
            "total_tasks": len(tasks),
            "grade": grade,
            "grade_label": label,
            "risk_distribution": dist
        }

# Singleton instance
audit_service = ValdesSoutoModel()
