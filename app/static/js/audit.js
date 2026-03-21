/**
 * app/static/js/audit.js
 * Frontend Logic para AI Audit Dashboard
 * Stack: Vanilla JS + Chart.js + Bootstrap 5
 */

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================

const AUDIT_API_BASE = '/api/audit';

// Referencias a charts (global para poder actualizarlos)
let scatterChart = null;
let riskChart = null;


// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('🤖 AI Audit Dashboard inicializado');

    // Event listener para el botón de auditoría
    const btnRunAudit = document.getElementById('btn-run-audit');
    if (btnRunAudit) {
        btnRunAudit.addEventListener('click', runFullAudit);
    }

    // Event listener para cuando se activa la pestaña
    const auditTab = document.getElementById('ai-audit-tab');
    if (auditTab) {
        auditTab.addEventListener('shown.bs.tab', function () {
            loadAuditDashboard();
        });
    }

    // Cargar datos si la pestaña ya está activa
    if (auditTab && auditTab.classList.contains('active')) {
        loadAuditDashboard();
    }
});


// ============================================================================
// FUNCIÓN PRINCIPAL: CARGAR DASHBOARD
// ============================================================================

async function loadAuditDashboard() {
    console.log('📊 Cargando dashboard de auditoría...');

    try {
        // Mostrar loading
        showLoading(true);

        // Cargar datos en paralelo
        const [healthData, tasksData] = await Promise.all([
            fetchHealthScore(),
            fetchAuditedTasks()
        ]);

        // Actualizar KPIs
        updateKPIs(healthData, tasksData);

        // Renderizar gráficos
        renderScatterPlot(tasksData.tasks);
        renderRiskChart(healthData.risk_distribution);

        // Renderizar tabla
        renderAuditTable(tasksData.tasks);

        // Ocultar loading
        showLoading(false);

        console.log('✅ Dashboard cargado correctamente');

    } catch (error) {
        console.error('❌ Error al cargar dashboard:', error);
        // Don't show error alert on initial load if just empty
        showLoading(false);
    }
}


// ============================================================================
// API CALLS
// ============================================================================

async function fetchHealthScore() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${AUDIT_API_BASE}/health-score`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Error al obtener health score');
        return await response.json();
    } catch (e) {
        console.warn("Could not fetch health score", e);
        return { health_score: null, risk_distribution: {} };
    }
}

async function fetchAuditedTasks() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${AUDIT_API_BASE}/tasks-with-audit`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Error al obtener tareas auditadas');
        return await response.json();
    } catch (e) {
        console.warn("Could not fetch tasks", e);
        return { tasks: [] };
    }
}

async function fetchCriticalTasks() {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${AUDIT_API_BASE}/critical-tasks`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Error al obtener tareas críticas');
    return await response.json();
}

async function runBatchAudit() {
    const token = localStorage.getItem('access_token');
    if (!token) throw new Error('No authentication token found. Please log in again.');

    const response = await fetch(`${AUDIT_API_BASE}/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errorText}`);
    }

    return await response.json();
}


// ============================================================================
// EJECUTAR AUDITORÍA COMPLETA
// ============================================================================

async function runFullAudit() {
    const btn = document.getElementById('btn-run-audit');

    try {
        // Deshabilitar botón
        if (btn) {
            btn.disabled = true;
            btn.classList.add('running');
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Auditando...';
        }

        // Mostrar loading
        showLoading(true);

        // Ejecutar auditoría
        const result = await runBatchAudit();

        console.log('✅ Auditoría completada:', result);

        // Mostrar notificación de éxito
        showNotification(
            `✅ Auditoría completada: ${result.tasks_audited} tareas analizadas`,
            'success'
        );

        // Recargar dashboard
        await loadAuditDashboard();

    } catch (error) {
        console.error('❌ Error en auditoría:', error);
        showError('Error al ejecutar auditoría: ' + error.message);

    } finally {
        // Restaurar botón
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('running');
            btn.innerHTML = '<i class="bi bi-play-circle"></i> Ejecutar Auditoría';
        }
        showLoading(false);
    }
}


// ============================================================================
// ACTUALIZAR KPIs
// ============================================================================

function updateKPIs(healthData, tasksData) {

    // Health Score
    const healthScoreValue = document.getElementById('health-score-value');
    const healthScoreGrade = document.getElementById('health-score-grade');
    const healthScoreLabel = document.getElementById('health-score-label');
    const healthScoreCard = document.getElementById('health-score-card');

    if (healthData && healthData.health_score !== null && healthData.health_score !== undefined) {
        if (healthScoreValue) healthScoreValue.textContent = `${healthData.health_score.toFixed(1)}%`;
        if (healthScoreGrade) healthScoreGrade.textContent = healthData.grade;
        if (healthScoreLabel) healthScoreLabel.textContent = healthData.grade_label || '';

        // Aplicar color según grado
        if (healthScoreCard) healthScoreCard.className = `card border-start border-5 health-grade-${healthData.grade}`;
        if (healthScoreGrade) healthScoreGrade.className = `display-4 grade-${healthData.grade}`;
    } else {
        if (healthScoreValue) healthScoreValue.textContent = '--';
        if (healthScoreGrade) healthScoreGrade.textContent = '?';
        if (healthScoreLabel) healthScoreLabel.textContent = 'Ejecutar auditoría';
    }

    // Critical Count
    const criticalCount = document.getElementById('critical-count');
    const criticalFromHealth = healthData?.risk_distribution?.CRITICAL || 0;
    if (criticalCount) criticalCount.textContent = criticalFromHealth;

    // Audited Count
    const auditedCount = document.getElementById('audited-count');
    const total = tasksData?.total || tasksData?.tasks?.length || 0;
    if (auditedCount) auditedCount.textContent = total;
}


// ============================================================================
// RENDERIZAR SCATTER PLOT
// ============================================================================

// 📊 NEON THEME HELPERS (Copying logic from charts.js for consistency)
// 📊 NEON THEME HELPERS (Copying logic from charts.js for consistency)
// CONSTRAINT: Use GLASS effect for Audit Charts (0.2 Alpha Fill / 1.0 Border)
const getThemeColor = (risk) => {
    if (!window.UI_THEME) return null; // Fallback handled in render
    const map = {
        'SAFE': window.UI_THEME.palette.completed,      // Green
        'WARNING': window.UI_THEME.palette.pending,     // Amber
        'CRITICAL': window.UI_THEME.palette.blocked     // Red
    };
    return map[risk] || window.UI_THEME.palette.on_hold;
};

// Helper to resolve glass effect
const resolveGlassColor = (hex) => {
    if (!hex) return { background: '#94a3b833', border: '#94a3b8' };

    // Check if charts.js utils are available
    if (window.UI_THEME && window.UI_THEME.utils && window.UI_THEME.utils.getColors) {
        return window.UI_THEME.utils.getColors(hex);
    }

    // Manual Fallback for Hex to RGBA 0.2
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return {
        background: `rgba(${r}, ${g}, ${b}, 0.2)`,
        border: hex
    };
};

// ============================================================================
// RENDERIZAR SCATTER PLOT
// ============================================================================

function renderScatterPlot(tasks) {
    const ctx = document.getElementById('scatter-chart');
    if (!ctx) return;

    // Destruir chart anterior si existe
    if (scatterChart) {
        scatterChart.destroy();
    }

    if (!tasks || tasks.length === 0) return;

    // Preparar datos
    const scatterData = tasks.map(task => ({
        x: task.estimated_hours,
        y: task.ai_audit?.benchmark_hours || 0,
        taskName: task.task_name,
        risk: task.ai_audit?.risk_level || 'SAFE'
    }));

    // Agrupar por riesgo
    const safeData = scatterData.filter(d => d.risk === 'SAFE');
    const warningData = scatterData.filter(d => d.risk === 'WARNING');
    const criticalData = scatterData.filter(d => d.risk === 'CRITICAL');

    // Calcular límites para la línea diagonal
    const maxValue = Math.max(
        ...scatterData.map(d => Math.max(d.x, d.y))
    ) || 100;

    // Theme Colors (Glass Effect)
    const glassSafe = resolveGlassColor(getThemeColor('SAFE'));
    const glassWarn = resolveGlassColor(getThemeColor('WARNING'));
    const glassCrit = resolveGlassColor(getThemeColor('CRITICAL'));

    const cGrid = window.UI_THEME ? window.UI_THEME.palette.grid_light : '#e2e8f0';
    const cText = window.UI_THEME ? window.UI_THEME.palette.text_light : '#0f172a';

    // Crear chart
    scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'SAFE',
                    data: safeData,
                    backgroundColor: glassSafe.background,
                    borderColor: glassSafe.border,
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointStyle: 'circle'
                },
                {
                    label: 'WARNING',
                    data: warningData,
                    backgroundColor: glassWarn.background,
                    borderColor: glassWarn.border,
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointStyle: 'rectRounded'
                },
                {
                    label: 'CRITICAL',
                    data: criticalData,
                    backgroundColor: glassCrit.background,
                    borderColor: glassCrit.border,
                    borderWidth: 2,
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    pointStyle: 'triangle'
                },
                {
                    label: 'Línea ideal',
                    data: [
                        { x: 0, y: 0 },
                        { x: maxValue, y: maxValue }
                    ],
                    type: 'line',
                    borderColor: '#9ca3af', // Gray for guide line
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        font: { family: 'Inter', size: 12 },
                        color: cText
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Inter', size: 13, weight: 'bold' },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        title: function (context) {
                            return context[0].raw.taskName || '';
                        },
                        label: function (context) {
                            if (context.dataset.label === 'Línea ideal') return '';
                            const data = context.raw;
                            return [
                                `Estimación: ${data.x}h`,
                                `Benchmark: ${data.y.toFixed(1)}h`,
                                `Riesgo: ${data.risk}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Estimación Humana (horas)',
                        color: cText,
                        font: { family: 'Inter', weight: '600' }
                    },
                    grid: { color: cGrid, borderDash: [2, 2] },
                    ticks: { color: cText, font: { family: 'Inter' } },
                    beginAtZero: true
                },
                y: {
                    title: {
                        display: true,
                        text: 'Benchmark IA (horas)',
                        color: cText,
                        font: { family: 'Inter', weight: '600' }
                    },
                    grid: { color: cGrid, borderDash: [2, 2] },
                    ticks: { color: cText, font: { family: 'Inter' } },
                    beginAtZero: true
                }
            }
        }
    });
}


// ============================================================================
// RENDERIZAR GRÁFICO DE RIESGO
// ============================================================================

function renderRiskChart(riskDistribution) {
    const ctx = document.getElementById('risk-chart');
    if (!ctx) return;

    // Destruir chart anterior si existe
    if (riskChart) {
        riskChart.destroy();
    }

    // Datos por defecto si no hay distribución
    const distribution = riskDistribution || {
        SAFE: 0,
        WARNING: 0,
        CRITICAL: 0
    };

    // Theme Colors (Glass Effect)
    const glassSafe = resolveGlassColor(getThemeColor('SAFE'));
    const glassWarn = resolveGlassColor(getThemeColor('WARNING'));
    const glassCrit = resolveGlassColor(getThemeColor('CRITICAL'));

    const cText = window.UI_THEME ? window.UI_THEME.palette.text_light : '#0f172a';
    const cGrid = window.UI_THEME ? window.UI_THEME.palette.grid_light : '#e2e8f0';

    // Crear chart
    riskChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['SAFE', 'WARNING', 'CRITICAL'],
            datasets: [{
                label: 'Cantidad de Tareas',
                data: [
                    distribution.SAFE || 0,
                    distribution.WARNING || 0,
                    distribution.CRITICAL || 0
                ],
                backgroundColor: [glassSafe.background, glassWarn.background, glassCrit.background],
                borderColor: [glassSafe.border, glassWarn.border, glassCrit.border],
                borderWidth: 2,
                borderRadius: 6,
                barPercentage: 0.9, // Wider bars (requested)
                categoryPercentage: 1.0 // Occupy full category width
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Inter', size: 13, weight: 'bold' },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 10,
                    cornerRadius: 8
                },
                datalabels: { display: false } // Explicitly disable data labels
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: cText, font: { family: 'Inter', weight: '600' } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: cGrid, borderDash: [2, 2] },
                    ticks: {
                        color: cText,
                        font: { family: 'Inter' },
                        stepSize: 1
                    }
                }
            }
        }
    });
}


// ============================================================================
// RENDERIZAR TABLA DE AUDITORÍA
// ============================================================================

function renderAuditTable(tasks) {
    const tbody = document.querySelector('#audit-table tbody');
    if (!tbody) return;

    // Limpiar tabla
    tbody.innerHTML = '';

    if (!tasks || tasks.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    No hay tareas auditadas. Ejecuta una auditoría para ver resultados.
                </td>
            </tr>
        `;
        return;
    }

    // Renderizar filas
    tasks.forEach(task => {
        const audit = task.ai_audit || {};
        const row = document.createElement('tr');

        // Determinar clase de riesgo
        const riskClass = getRiskBadgeClass(audit.risk_level);
        const riskIcon = getRiskIcon(audit.risk_level);

        // Determinar color de desviación
        const deviation = audit.deviation_percentage || 0;
        const deviationClass = deviation > 0 ? 'text-danger' : 'text-success';
        const deviationSign = deviation > 0 ? '+' : '';

        row.innerHTML = `
            <td>
                <strong>${task.task_name}</strong>
                ${task.assigned_to ? `<br><small class="text-muted">${task.assigned_to}</small>` : ''}
            </td>
            <td>${task.estimated_hours}h</td>
            <td class="fw-bold text-primary">${(audit.benchmark_hours || 0).toFixed(1)}h</td>
            <td class="${deviationClass} fw-bold">
                ${deviationSign}${deviation.toFixed(1)}%
            </td>
            <td>
                <span class="risk-badge risk-${audit.risk_level}">
                    ${riskIcon} ${audit.risk_level || 'N/A'}
                </span>
            </td>
            <td>
                <small>${audit.recommended_action || 'Sin acción'}</small>
            </td>
        `;

        tbody.appendChild(row);
    });
}


// ============================================================================
// HELPERS
// ============================================================================

function getRiskBadgeClass(risk) {
    const classes = {
        'SAFE': 'risk-SAFE',
        'WARNING': 'risk-WARNING',
        'CRITICAL': 'risk-CRITICAL'
    };
    return classes[risk] || 'risk-SAFE';
}

function getRiskIcon(risk) {
    const icons = {
        'SAFE': '✓',
        'WARNING': '⚠',
        'CRITICAL': '⚠'
    };
    return icons[risk] || '';
}

function showLoading(show) {
    const loading = document.getElementById('audit-loading');
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
}

function showNotification(message, type = 'info') {
    // Bootstrap toast o alert simple
    console.log(`[${type.toUpperCase()}] ${message}`);

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    // Auto-remover después de 5 segundos
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function showError(message) {
    showNotification(message, 'danger');
}
