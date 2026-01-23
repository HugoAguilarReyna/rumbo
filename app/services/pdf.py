try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError):
    WEASYPRINT_AVAILABLE = False
    print("Warning: WeasyPrint (GTK) not found. PDF generation will be disabled.")

from jinja2 import Template
from datetime import datetime

async def generate_dashboard_pdf(metrics: dict, charts: dict = None):
    if not WEASYPRINT_AVAILABLE:
        return b"PDF generation is not available on this server configuration."

    # Template
    template_str = """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; }
            .header { text-align: center; margin-bottom: 30px; }
            .kpi-container { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .kpi-box { padding: 15px; background: #f4f4f4; border-radius: 5px; text-align: center; width: 22%; }
            .kpi-val { font-size: 24px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Project Dashboard Report</h1>
            <p>Date: {{ date }}</p>
        </div>
        
        <div class="kpi-container">
            <div class="kpi-box">
                <div class="kpi-val">{{ metrics.total_tasks }}</div>
                <div>Total Tasks</div>
            </div>
            <div class="kpi-box">
                <div class="kpi-val">{{ metrics.completed_tasks }}</div>
                <div>Completed</div>
            </div>
             <div class="kpi-box">
                <div class="kpi-val">{{ metrics.completion_rate }}%</div>
                <div>Rate</div>
            </div>
        </div>
        <p>Charts support requires rendering charts to images first (not fully implemented in backend yet).</p>
    </body>
    </html>
    """
    
    template = Template(template_str)
    html_content = template.render(
        metrics=metrics,
        date=datetime.now().strftime("%Y-%m-%d %H:%M")
    )
    
    return HTML(string=html_content).write_pdf()
