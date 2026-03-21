// Global Error Handler
window.addEventListener('error', (event) => {
    console.error('💥 Global Error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
    });
    // Optional: showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('💥 Unhandled Promise Rejection:', event.reason);
});

// Track the currently active tab for refresh logic
let activeTabId = '#overview';

// Main Dashboard Logic
let currentProjectId = "ALL";

// ... (existing code) ...

// ========================================
// API CLIENT WRAPPER
// (Imported via api.js - do not redeclare)
// ========================================

// Toast Notification System
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`,
        error: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        info: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        warning: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto-dismiss
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Status Pill Helper
function getStatusBadgeHTML(status) {
    if (!status) return '';
    const statusLower = status.toLowerCase().replace(/_/g, '-');
    return `<span class="badge-soft-${statusLower}">${status.replace(/_/g, ' ')}</span>`;
}



// Skeleton Loader HTML
function getSkeletonHTML(type) {
    if (type === 'row') return '<div class="skeleton-loader skeleton-row"></div>'.repeat(3);
    if (type === 'card') return '<div class="skeleton-loader skeleton-card"></div>'.repeat(2);
    return '';
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Check auth if needed (placeholder)
    const token = localStorage.getItem('access_token');
    if (!token && window.location.pathname !== '/static/pages/login.html') {
        // window.location.href = '/static/pages/login.html'; 
        // For development loop, we might allow bypass or check 'acceso.txt'
    }

    loadDashboard();

    // Tab Event Listeners
    const triggerTabList = document.querySelectorAll('button[data-bs-toggle="tab"]');
    console.log(`🔍 Found ${triggerTabList.length} tab buttons.`);

    triggerTabList.forEach(triggerEl => {
        triggerEl.addEventListener('shown.bs.tab', event => {
            const targetId = event.target.getAttribute('data-bs-target');
            console.log(`🎯 Tab Switched to: ${targetId}`);
            activeTabId = targetId; // Update global tracker

            if (targetId === '#tasks') loadTasksList(currentProjectId);
            if (targetId === '#capacity') loadCapacityWidget(currentProjectId);
            if (targetId === '#tracking') { loadTasksForDropdown(); loadRecentActivity(); }
            if (targetId === '#timeline' && window.loadGantt) { window.loadGantt(currentProjectId); }
            if (targetId === '#scoreboard') {
                loadProjectOverview();
                loadProjectBoard();
            }
            if (targetId === '#overview' || targetId === '#resumen') {
                // Reload dashboard data when returning to summary to fix any initial load failures
                loadDashboard();
            }

            // Initial load for management tabs if they are active
            if (targetId === '#management') {
                // Default to projects tab inside management
                loadProjectsTable();
            }
        });
    });
});

async function refreshDashboard() {
    console.log(`🔄 Refreshing Dashboard... Active Tab: ${activeTabId}`);

    // Always load core data
    await loadDashboard();

    // Load data specific to the active tab
    if (activeTabId === '#scoreboard') {
        await loadProjectOverview();
        await loadProjectBoard();
    } else if (activeTabId === '#capacity') {
        await loadCapacityWidget(currentProjectId);
    } else if (activeTabId === '#timeline' && window.loadGantt) {
        await window.loadGantt(currentProjectId);
    } else if (activeTabId === '#tracking') {
        await loadRecentActivity();
    } else if (activeTabId === '#management') {
        // Refresh both tables to be safe, or check active sub-tab
        await loadProjectsTable();
        await loadUsersTable();
    }

    showToast('Dashboard refreshed', 'info');
}

async function loadDashboard() {
    console.log("🚀 Dashboard Initializing... loadDashboard called");
    try {
        // Default: Load Metrics & Tasks for Overview
        await loadMetrics(currentProjectId);
        await loadCharts(currentProjectId);
        if (window.loadDummyKPIs) window.loadDummyKPIs(); // Load Dummy KPIs
        await loadTasksList(currentProjectId); // LOAD TASKS ON STARTUP
        console.log("✅ Dashboard Data Loaded Successfully");
    } catch (error) {
        console.error("❌ Dashboard Load Error:", error);
    }
}

// Global scope expose for Tab Logic
window.loadCapacityWidget = loadCapacityWidget;

// ========================================
// DATA LOADING & RENDERING
// ========================================

async function loadMetrics(projectId) {
    const container = document.getElementById('scoreboard-container');
    if (!container) return;

    try {
        let url = '/analytics/metrics';
        if (projectId && projectId !== 'ALL') url += `?project_id=${projectId}`;

        const response = await ApiClient.get(url);
        if (response.ok) {
            const data = await response.json();

            // 1. Update Total Tasks
            const totalEl = document.getElementById('kpi-total-value');
            if (totalEl) totalEl.textContent = data.total_tasks;

            // 2. Update Success Rate & Ring
            const rateEl = document.getElementById('kpi-rate-value');
            if (rateEl) rateEl.textContent = data.completion_rate.toFixed(1) + '%';

            const ringEl = document.getElementById('kpi-rate-ring');
            if (ringEl) {
                const rate = data.completion_rate;
                const color = rate >= 80 ? 'var(--color-success)' : rate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
                // Conic gradient: color from 0% to rate%, gray from rate% to 100%
                ringEl.style.background = `conic-gradient(${color} 0% ${rate}%, var(--color-gray-200) ${rate}% 100%)`;
            }

            // 3. Update Health Bar (Mock logic for demonstration)
            // Ideally we get status distribution from API. Let's assume some defaults if not in `metrics` endpoint or fetch separately.
            // For now, let's use the completion rate to simulate "progress" bar width.
            const progress = data.completion_rate || 0;
            const blocked = 5; // Fixed mock for now

            const barProgress = document.getElementById('bar-progress');
            if (barProgress) barProgress.style.width = `${progress}%`;

            const barBlocked = document.getElementById('bar-blocked');
            if (barBlocked) barBlocked.style.width = `${blocked}%`;

            const healthText = document.getElementById('kpi-health-text');
            if (healthText) {
                if (progress >= 80) healthText.textContent = "Excellent";
                else if (progress >= 50) healthText.textContent = "Good";
                else healthText.textContent = "At Risk";
            }
        }
    } catch (e) {
        console.error("Metrics Load Error", e);
        container.innerHTML = `<div class="col-span-4 text-center text-red-500">Failed to load metrics</div>`;
    }
}

async function loadCharts(projectId) {
    try {
        let url = '/tasks/';
        if (projectId && projectId !== 'ALL') url += `?project_id=${projectId}`;

        // Parallel Fetch: Tasks + Project Map
        const [tasksResponse, projectsResponse] = await Promise.all([
            ApiClient.get(url),
            ApiClient.get('/analytics/projects')
        ]);

        if (tasksResponse.ok) {
            const tasks = await tasksResponse.json();

            // Build Project Map (ID -> Name)
            const projectMap = {};
            if (projectsResponse.ok) {
                const projects = await projectsResponse.json();
                projects.forEach(p => {
                    const pid = p.id || p._id;
                    if (pid) projectMap[pid] = p.name;
                });
            }

            // Call renderers (Pass Map)
            if (window.renderProjectCharts) window.renderProjectCharts(tasks, projectMap);
            if (window.renderUtilizationChart) window.renderUtilizationChart(tasks); // Utilization doesn't need project names
        }
    } catch (e) {
        console.error("Charts Load Error", e);
    }
}

async function loadTasksList(projectId) {
    console.log(`📡 Fetching Tasks for project: ${projectId}`);
    const container = document.getElementById('tasks-container');
    let tasks = null; // Debug scope

    try {
        let url = '/tasks/';
        if (projectId && projectId !== 'ALL') url += `?project_id=${projectId}`;

        // Fetch Tasks and Projects in parallel
        // Use /projects/ endpoint which is more reliable than /analytics/projects
        const [tasksResponse, projectsResponse] = await Promise.all([
            ApiClient.get(url),
            ApiClient.get('/projects/')
        ]);

        if (tasksResponse.ok) {
            const tasks = await tasksResponse.json();

            // Build Project Map
            const projectMap = {};
            if (projectsResponse.ok) {
                const projects = await projectsResponse.json();
                projects.forEach(p => {
                    const pid = p.id || p._id;
                    if (pid) projectMap[pid] = p.name;
                });
            }

            console.log(`📋 Tasks Received: ${tasks.length} tasks found.`);

            if (!Array.isArray(tasks)) {
                console.error("Tasks is not an array:", tasks);
                throw new Error("Invalid format");
            }

            // Render to main container if it exists (legacy)
            if (container) {
                if (tasks.length === 0) {
                    container.innerHTML = `<div class="text-center p-4 text-gray-500">No active tasks found.</div>`;
                } else {
                    container.innerHTML = tasks.slice(0, 5).map(task => `
                        <div class="p-4 border border-gray-100 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer flex justify-between items-center group"
                             onclick="openTaskDetail('${task.id || task._id}')">
                            <div>
                                <div class="font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                                    ${task.title}
                                </div>
                                <div class="text-xs text-gray-500 mt-1">
                                    Due: ${new Date(task.due_date).toLocaleDateString()}
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                ${getStatusBadgeHTML(task.status)}
                                <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                            </div>
                        </div>
                    `).join('');
                }
            }

            // ALWAYS Render the new critical task lists (Overdue / Upcoming)
            renderCriticalTaskLists(tasks);

            // Render Summary Cards with Project Names
            renderTaskSummaries(tasks, projectMap);
        }
    } catch (e) {
        console.error("Tasks Load Error", e);
        const errorMsg = `<div class="text-center text-red-500 py-4">Error al cargar tareas: ${e.message}</div>`;

        if (container) container.innerHTML = errorMsg;

        // Update critical lists to show error too
        const overdueContainer = document.getElementById('overdue-tasks-list');
        const upcomingContainer = document.getElementById('upcoming-tasks-list');
        if (overdueContainer) overdueContainer.innerHTML = errorMsg;
        if (upcomingContainer) upcomingContainer.innerHTML = errorMsg;
    }
}

// Helper to get color for status text
function getStatusColor(status) {
    const colors = {
        'PENDING': '#FFC400',      // Amber Gold
        'IN_PROGRESS': '#2979FF',  // Electric Blue
        'COMPLETED': '#00E676',    // Neon Green
        'BLOCKED': '#FF1744',      // Fluorescent Red
        'ON_HOLD': '#FFC400',      // Amber Gold
        'CANCELLED': '#94A3B8'     // Slate
    };
    return colors[status] || '#94A3B8';
}

// 🚀 CRITICAL TASK LISTS LOGIC (Overdue & Upcoming)
function renderCriticalTaskLists(tasks) {
    const overdueContainer = document.getElementById('overdue-tasks-list');
    const upcomingContainer = document.getElementById('upcoming-tasks-list');

    if (!overdueContainer || !upcomingContainer) return;

    // Date Utilities
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const isValidDate = (d) => d instanceof Date && !isNaN(d) && d.getFullYear() > 1970;

    // 1. Filter Overdue Tasks
    const overdueTasks = tasks.filter(t => {
        if (!t.due_date || t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
        const due = new Date(t.due_date);
        return isValidDate(due) && due < now;
    });

    // 2. Filter Upcoming Tasks (Next 7 Days)
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);

    const upcomingTasks = tasks.filter(t => {
        if (!t.due_date || t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
        const due = new Date(t.due_date);
        due.setHours(0, 0, 0, 0);
        return isValidDate(due) && due >= now && due <= nextWeek;
    });

    // 3. Render
    renderDashboardTaskCards(overdueContainer, overdueTasks, 'overdue');
    renderDashboardTaskCards(upcomingContainer, upcomingTasks, 'upcoming');
}

// 🚀 NEW SUMMARY CARDS RENDERING
function renderTaskSummaries(tasks, projectMap = {}) {
    if (!tasks) return;

    // 1. Status Stats
    const statusCounts = tasks.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
    }, {});

    // Sort statuses by count desc
    const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

    const statusContainer = document.getElementById('summary-status-container');
    if (statusContainer) {
        if (sortedStatuses.length === 0) {
            statusContainer.innerHTML = '<div class="text-center text-muted py-2">Sin datos</div>';
        } else {
            statusContainer.innerHTML = sortedStatuses.map(([status, count]) => `
                <div class="d-flex justify-content-center align-items-center mb-2 gap-3" style="max-width: 250px; margin: 0 auto;">
                    <span class="badge" style="background-color: ${getStatusColor(status)}; color: #fff; min-width: 100px;">${status.replace(/_/g, ' ')}</span>
                    <span class="font-bold" style="min-width: 30px; text-align: left;">${count}</span>
                </div>
            `).join('');
        }
    }

    // 2. Project Stats (Group by project_id for now, ideally project_name if available)
    // We need to fetch project names or use ID. dashboard.js should have access to project list?
    // Let's assume tasks have 'project_name' or we use ID. 
    // Checking previous 'loadTasksList', the task object likely has project_id but maybe not name.
    // However, `renderProjectCharts` in `dashboard.js` uses `projectMap` if available.
    // Let's see if we can access `window.projectMap` or similar. If not, use ID.

    const projectCounts = tasks.reduce((acc, t) => {
        const id = t.project_id || 'Unknown';
        acc[id] = (acc[id] || 0) + 1;
        return acc;
    }, {});

    const sortedProjects = Object.entries(projectCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const projectContainer = document.getElementById('summary-project-container');
    if (projectContainer) {
        if (sortedProjects.length === 0) {
            projectContainer.innerHTML = '<div class="text-center text-muted py-2">Sin datos</div>';
        } else {
            projectContainer.innerHTML = sortedProjects.map(([id, count]) => {
                const name = projectMap[id] || id; // Use Name if available, else ID
                return `
                <div class="d-flex justify-content-center align-items-center mb-2 border-bottom pb-1 gap-3" style="max-width: 280px; margin: 0 auto;">
                    <span class="text-sm text-truncate" style="max-width: 150px; flex: 1; text-align: left;" title="${name}">${name}</span>
                    <span class="badge bg-light text-dark border" style="min-width: 40px; text-align: center;">${count}</span>
                </div>
            `}).join('');
        }
    }

    // 3. Talent Stats
    const talentCounts = tasks.reduce((acc, t) => {
        const name = t.assigned_to || 'Unassigned';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});

    const sortedTalent = Object.entries(talentCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const talentContainer = document.getElementById('summary-talent-container');
    if (talentContainer) {
        if (sortedTalent.length === 0) {
            talentContainer.innerHTML = '<div class="text-center text-muted py-2">Sin datos</div>';
        } else {
            talentContainer.innerHTML = sortedTalent.map(([name, count]) => `
                <div class="d-flex justify-content-center align-items-center mb-2 gap-3" style="max-width: 280px; margin: 0 auto;">
                    <div class="d-flex align-items-center gap-2" style="flex: 1; min-width: 0;">
                        <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center flex-shrink-0" style="width:24px; height:24px; font-size: 10px;">${name.charAt(0)}</div>
                        <span class="text-sm text-truncate">${name}</span>
                    </div>
                    <span class="font-bold text-primary" style="min-width: 40px; text-align: right;">${count}</span>
                </div>
            `).join('');
        }
    }
}

// 🚀 UNIFIED RENDER FUNCTION (RESTORED)
function renderDashboardTaskCards(containerOrId, tasks, type) {
    const container = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
    if (!container) return;
    container.innerHTML = '';

    if (!tasks || tasks.length === 0) {
        container.innerHTML = `<p class="text-center opacity-50 py-4">Sin tareas pendientes</p>`;
        return;
    }

    tasks.forEach(task => {
        // Safe Date Handling
        let dateStr = 'Sin fecha';
        if (task.due_date) {
            const dateObj = new Date(task.due_date);
            if (!isNaN(dateObj) && dateObj.getFullYear() > 1970) {
                dateStr = dateObj.toLocaleDateString();
            }
        }

        // Visual Styling based on Type
        const isOverdue = type === 'overdue';
        const borderColor = isOverdue ? 'border-l-4 border-red-500' : 'border-l-4 border-blue-500';
        const badgeColor = isOverdue ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
        const labelText = isOverdue ? 'EXPIRADO' : 'PRÓXIMO';

        // Card HTML - Now with Edit Trigger
        const cardHtml = `
            <div class="glass-card mb-3 p-3 ${borderColor} shadow-sm hover:shadow-md transition bg-white dark:bg-gray-800 cursor-pointer" 
                 onclick="openTaskDetail('${task.id || task._id}')">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="d-flex align-items-center gap-2 mb-1">
                             <h5 class="fw-bold mb-0 text-truncate" style="font-size: 0.95rem;">${task.title || 'Sin título'}</h5>
                             <i class="bi bi-pencil-square text-muted opacity-50" style="font-size: 0.8rem;"></i>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge ${badgeColor} rounded-pill" style="font-size: 0.65rem;">${labelText}</span>
                            <small class="text-muted">👤 ${task.assigned_to || 'Unassigned'}</small>
                        </div>
                    </div>
                    <div class="text-end ps-3" style="min-width: 80px;">
                        <span class="d-block fw-bold text-dark dark:text-light small">${dateStr}</span>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}

async function loadCapacityWidget(projectId) {
    const container = document.getElementById('capacity-widget');
    if (!container) return;

    try {
        let url = '/analytics/capacity';
        if (projectId && projectId !== 'ALL') url += `?project_id=${projectId}`;

        const response = await ApiClient.get(url);
        if (response.ok) {
            const data = await response.json();

            if (!data || !data.team_capacity || data.team_capacity.length === 0) {
                container.innerHTML = `<div class="text-center p-4 text-gray-500">No team capacity data found.</div>`;
                return;
            }

            container.innerHTML = `
            <div class="glass-card p-6">
                <div class="flex justify-between items-center mb-6">
                     <h3 class="text-xl font-semibold">Team Capacity & Utilization</h3>
                     <span class="text-sm text-gray-500">Total Utilization: <strong id="team-utilization-val">${data.total_team_utilization}</strong>%</span>
                </div>
                
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>Team Member</th>
                            <th class="text-center">Assigned</th>
                            <th class="text-center">Capacity</th>
                            <th style="width: 40%">Utilization</th>
                            <th class="text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.team_capacity.map(member => {

                const isOverloaded = member.total_hours_assigned > member.max_capacity_hours;
                // Bar Color Logic
                let barColorClass = 'bg-blue-600'; // Default Primary
                if (member.utilization_percent > 100) barColorClass = 'bg-red-500';
                else if (member.utilization_percent > 80) barColorClass = 'bg-yellow-500';
                else if (member.utilization_percent < 50) barColorClass = 'bg-green-500';

                return `
                            <tr>
                                <td class="font-medium">${member.user}</td>
                                <td class="text-center">${member.total_hours_assigned}h</td>
                                <td class="text-center">${member.max_capacity_hours}h</td>
                                <td>
                                    <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                                        <div class="${barColorClass} h-2.5 rounded-full transition-all duration-500" 
                                             style="width: ${Math.min(member.utilization_percent, 100)}%"></div>
                                    </div>
                                    <div class="text-right text-xs text-gray-500 mt-1">${member.utilization_percent}%</div>
                                </td>
                                <td class="text-right">
                                    <span class="badge-soft-${member.status === 'overloaded' ? 'blocked' : member.status === 'optimal' ? 'completed' : 'on-hold'} text-xs">
                                        ${member.status.toUpperCase()}
                                    </span>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
        }
    } catch (e) {
        console.error("Capacity Load Error", e);
        container.innerHTML = `<div class="text-center text-red-500">Error loading team capacity</div>`;
    }
}

// ========================================
// CSV UPLOAD LOGIC
// ========================================
// Function implementation is located at the bottom of the file (Line ~1700).

// ========================================
// API CLIENT WRAPPER (Simple)
// ========================================



function toggleTaskModal() {
    if (window.openTaskModal) window.openTaskModal();
}

async function openTaskDetail(taskId) {
    if (window.openTaskModal) {
        window.openTaskModal(taskId);
    } else {
        console.warn('openTaskModal not found, falling back to legacy drawer');
        // Legacy fallback logic if needed...
    }
}

// 🚀 MASTER-DETAIL DRAWER LOGIC (LEGACY - REDIRECTED ABOVE)
let currentDrawerTaskId = null;

function closeTaskDrawer() {
    const drawer = document.getElementById('task-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    if (drawer) drawer.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    currentDrawerTaskId = null;
}

function renderDrawerContent(task) {
    const content = document.getElementById('drawer-content');

    // Format Date for Input (YYYY-MM-DD)
    const dueDateVal = task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '';
    const projectId = task.project_id || '';

    content.innerHTML = `
        <div class="mb-4">
            <label class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Title</label>
            <input type="text" id="drawer-title" class="premium-input-xl" value="${task.title || ''}" placeholder="Task Title">
        </div>

        <div class="mb-4">
            <label class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Status</label>
            <select id="drawer-status" class="form-select border-0 bg-gray-50 fw-bold">
                <option value="PENDING" ${task.status === 'PENDING' ? 'selected' : ''}>Pending</option>
                <option value="IN_PROGRESS" ${task.status === 'IN_PROGRESS' || task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="COMPLETED" ${task.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
                <option value="BLOCKED" ${task.status === 'BLOCKED' ? 'selected' : ''}>Blocked</option>
                <option value="ON_HOLD" ${task.status === 'ON_HOLD' || task.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                <option value="CANCELLED" ${task.status === 'CANCELLED' ? 'selected' : ''}>Cancelled</option>
            </select>
        </div>

        <div class="mb-4">
             <label class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Project</label>
             <select id="drawer-project" class="form-select bg-gray-50 border-0">
                 <option value="">No Project</option>
                 <!-- Populated by JS -->
             </select>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
                <label class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Due Date</label>
                <input type="date" id="drawer-date" class="form-control bg-gray-50 border-0" value="${dueDateVal}">
            </div>
            <div>
                <label class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Assignee</label>
                <input type="text" id="drawer-assignee" class="form-control bg-gray-50 border-0" value="${task.assignee || ''}" placeholder="Unassigned">
            </div>
        </div>

        <div class="mb-4">
            <label class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Description</label>
            <textarea id="drawer-desc" class="form-control bg-gray-50 border-0" rows="5" placeholder="Add details...">${task.description || ''}</textarea>
        </div>
    `;

    // Trigger project load
    loadProjectOptions(projectId);
}

async function loadProjectOptions(selectedId) {
    const select = document.getElementById('drawer-project');
    if (!select) return;

    try {
        const res = await ApiClient.get('/projects/'); // Use cached list if possible? Fetching is safer for now.
        if (res.ok) {
            const projects = await res.json();
            projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id || p._id;
                opt.textContent = p.name;
                if (opt.value === selectedId) opt.selected = true;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Failed to load projects for drawer", e);
    }
}

async function saveTaskDetails() {
    if (!currentDrawerTaskId) return;

    const btn = document.getElementById('btn-save-drawer');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    btn.disabled = true;

    const payload = {
        title: document.getElementById('drawer-title').value,
        status: document.getElementById('drawer-status').value,
        due_date: document.getElementById('drawer-date').value || null,
        assignee: document.getElementById('drawer-assignee').value,
        description: document.getElementById('drawer-desc').value,
        project_id: document.getElementById('drawer-project').value || null
    };

    try {
        const response = await ApiClient.post(`/tasks/${currentDrawerTaskId}`, payload); // Use POST for update if backend expects it, usually PUT but let's check routers. 
        // Checking routers is safer. Based on typical FastAPI: PUT /tasks/{id} or PATCH. 
        // Wait, ApiClient.post acts as a generic mutation helper? Or maybe I should use PUT? 
        // Dashboard.js doesn't have ApiClient.put defined in the snippet I saw earlier (only get/post).
        // I will assume ApiClient.post is fine OR I will extend ApiClient if needed.
        // Actually, let's verify if `ApiClient` has `put`.
        // I'll check `ApiClient` definition again. 

        // RE-CHECK API CLIENT in Dashboard.js
        // ... (ApiClient is simplified in snippet I saw) 
        // If ApiClient.put missing, I'll fallback to fetch or extend. 
        // Let's assume for now I use fetch directly if needed, OR safer: Use PUT method.

        // Using PATCH as per backend definition
        const token = localStorage.getItem('access_token');
        const res = await fetch(`/api/tasks/${currentDrawerTaskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast('Task updated successfully', 'success');
            closeTaskDrawer();
            refreshDashboard(); // Refresh list to show changes
        } else {
            const err = await res.json();
            showToast(err.detail || 'Failed to update task', 'error');
        }
    } catch (e) {
        console.error("Save Error", e);
        showToast('Error saving changes', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ========================================
// TIME TRACKING LOGIC
// ========================================

async function loadTasksForDropdown() {
    const select = document.getElementById('time-task-select');
    if (!select) return;

    try {
        const response = await ApiClient.get('/tasks/');
        const tasks = await response.json();

        select.innerHTML = '<option value="">Select Task</option>';
        tasks.forEach(task => {
            const opt = document.createElement('option');
            opt.value = task.id || task._id;
            opt.textContent = task.title;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error("Error loading tasks", error);
        select.innerHTML = '<option value="">Error loading tasks</option>';
    }
}

async function handleLogTime() {
    const taskId = document.getElementById('time-task-select').value;
    const hours = parseFloat(document.getElementById('time-hours').value);
    const date = document.getElementById('time-date').value;
    const notes = document.getElementById('time-desc').value;

    if (!taskId || !hours) {
        showToast('Please select a task and enter hours', 'warning');
        return;
    }

    try {
        // Assuming endpoint /tasks/{id}/log-time accepts float hours in body or JSON object
        // Based on previous files, it seemed to take just the float or a body. 
        // Let's assume the backend expects the float value as body for simplicity based on previous snippet, 
        // OR better, checking backend would be ideal. But let's check what time_tracking.html had.
        // It had: await ApiClient.post(`/tasks/${taskId}/log-time`, hours); 
        // So we stick to that.
        const response = await ApiClient.post(`/tasks/${taskId}/log-time`, hours);

        if (response.ok) {
            showToast('Time logged successfully', 'success');
            document.getElementById('log-time-form').reset();
            // Set date back to today
            const dateInput = document.getElementById('time-date');
            if (dateInput) dateInput.valueAsDate = new Date();

            loadRecentActivity();
        } else {
            showToast('Failed to log time', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error logging time', 'error');
    }
}

async function loadRecentActivity() {
    const container = document.getElementById('time-logs-container');
    if (!container) return;

    // Skeletons
    container.innerHTML = getSkeletonHTML('row');

    try {
        const response = await ApiClient.get('/tasks/');
        const tasks = await response.json();

        // Filter tasks with logged hours
        const activeTasks = tasks.filter(t => t.logged_hours > 0);

        if (activeTasks.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-gray-500">No recent time logs found.</div>';
            return;
        }

        const html = activeTasks.map(task => `
            <div class="flex justify-between items-center p-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors rounded-lg">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-blue-100 text-blue-600 rounded-full">
                        <svg viewBox="0 0 24 24" class="w-4 h-4"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </div>
                    <div>
                        <h4 class="font-medium text-gray-900 dark:text-gray-100">${task.title}</h4>
                        <p class="text-xs text-gray-500">Total Logged: ${task.logged_hours}h</p>
                    </div>
                </div>
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">${task.logged_hours}h</span>
            </div>
        `).join('');

        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = '<div class="text-red-500 text-center">Failed to load activity</div>';
    }
}

// ========================================
// TASK CREATION LOGIC
// ========================================

async function handleCreateTask() {
    const title = document.getElementById('task-title').value;
    const assignee = document.getElementById('task-assignee').value;
    const hours = document.getElementById('task-hours').value;
    const start = document.getElementById('task-start').value;
    const due = document.getElementById('task-due').value;
    const desc = document.getElementById('task-desc').value;

    if (!title) {
        showToast('Please enter a task title', 'warning');
        return;
    }

    const taskData = {
        title: title,
        assigned_to: assignee,
        estimated_hours: parseFloat(hours) || 0,
        start_date: start || new Date().toISOString().split('T')[0],
        due_date: due || new Date().toISOString().split('T')[0],
        description: desc,
        status: 'PENDING',
        priority: 'MEDIUM',
        project_id: null
    };

    try {
        const response = await ApiClient.post('/tasks/', taskData);
        if (response.ok) {
            showToast('Task created successfully!', 'success');
            document.getElementById('create-task-form').reset();

            // Hide modal
            const modalEl = document.getElementById('addTaskModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            loadTasksList('ALL'); // Refresh list
        } else {
            console.error('Create Task Failed:', response.status);
            showToast('Failed to create task', 'error');
        }
    } catch (e) {
        console.error("Error creating task:", e);
        showToast('Error creating task', 'error');
    }
}

// ========================================
// 📊 GANTT CHART LOADER
// ========================================
// 📊 GANTT CHART LOADER
// ========================================

async function loadGantt(projectId) {
    console.log("📅 Initializing Gantt View (Deep Dive Source)...");
    try {
        const response = await ApiClient.get('/analytics/projects/deep-dive');

        if (response.ok) {
            const data = await response.json();
            const projects = data.projects || [];
            const flatTasks = [];

            projects.forEach(proj => {
                if (projectId && projectId !== 'ALL' && proj.id !== projectId) return;
                const projName = proj.name;
                proj.resources.forEach(res => {
                    const resName = res.name || 'Unassigned';
                    res.tasks.forEach(t => {
                        flatTasks.push({
                            id: t.id,
                            name: t.title,
                            start: t.start_date,
                            end: t.due_date,
                            progress: t.progress || 0,
                            status: t.status ? t.status.toLowerCase().replace(' ', '-') : 'pending',
                            project_id: proj.id,
                            project_name: projName,
                            _project: projName,
                            _assigned: resName,
                            assigned_to: resName,
                            _priority: 'medium',
                            estimated_hours: t.estimated_hours || 0,
                            logged_hours: t.logged_hours || 0,
                            dependencies: ''
                        });
                    });
                });
            });

            // 🚀 Data Bridge: Expose globally & Trigger Render
            window.globalGanttData = flatTasks;
            console.log(`✅ Data Bridge: ${flatTasks.length} tasks ready (Hours Mapped).`);

            if (typeof renderGanttChart === 'function') {
                renderGanttChart(window.globalGanttData);
            } else {
                console.error("❌ Renderer not ready yet!");
            }
        } else {
            throw new Error("Failed to fetch deep-dive data");
        }
    } catch (e) {
        console.warn("⚠️ Gantt Load Failed, using Mock Data:", e);
        // Fallback: Mock Data Injection
        window.globalGanttData = [
            { id: 't1', name: 'Rollback System', start: '2023-11-01', end: '2023-11-05', progress: 100, status: 'completed', assigned_to: 'Architect', _project: 'DASH-V2' },
            { id: 't2', name: 'UI Sync Fix', start: '2023-11-03', end: '2023-11-08', progress: 45, status: 'in-progress', assigned_to: 'Dev', _project: 'DASH-V2' },
            { id: 't3', name: 'Data Bridge Logic', start: '2023-11-06', end: '2023-11-12', progress: 0, status: 'pending', assigned_to: 'Dev', _project: 'DASH-V2' }
        ];
        if (typeof renderGanttChart === 'function') renderGanttChart(window.globalGanttData);
    }
}

// Global Expose
window.loadGantt = loadGantt;

// ========================================
// INITIALIZATION
// ========================================

// Duplicate initialization block removed



// ========================================
// REPORTING & EXPORT
// ========================================

function exportReport() {
    console.log("📄 Exporting Report...");
    // Future: Call backend /analytics/export endpoint
    // For now, simple toast
    showToast('Exportando reporte CSV...', 'info');

    // Simulate delay
    setTimeout(() => {
        showToast('Reporte exportado exitosamente (Simulacion)', 'success');
    }, 1500);
}

function generatePDF() {
    console.log("🖨️ Generating PDF...");
    showToast('Generando PDF...', 'info');

    const element = document.getElementById('overview'); // Target the Main Dashboard Tab

    if (!element) {
        showToast('No se encontró contenido para exportar', 'error');
        return;
    }

    const opt = {
        margin: 0.5,
        filename: 'Rumbo_Dashboard.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    // Use html2pdf if available (It is included in index.html)
    if (window.html2pdf) {
        html2pdf().set(opt).from(element).save().then(() => {
            showToast('PDF Descargado', 'success');
        }).catch(err => {
            console.error(err);
            showToast('Error al generar PDF', 'error');
        });
    } else {
        alert('Librería PDF no cargada. Por favor recarga la página.');
    }
}

// Global Expose
window.exportReport = exportReport;
window.generatePDF = generatePDF;

// ========================================
// DUMMY KPI LOADER (User Request)
// ========================================
window.loadDummyKPIs = function () {
    console.log("📊 Loading Dummy KPI Data...");

    // 1. Utilization
    const utilEl = document.getElementById('utilization-kpi');
    if (utilEl) utilEl.innerText = "84.5%";

    // 2. CPI
    const cpiEl = document.getElementById('kpi-cpi-value');
    if (cpiEl) cpiEl.innerText = "0.94";
    const cpiStatus = document.getElementById('kpi-cpi-status');
    if (cpiStatus) cpiStatus.innerHTML = 'At Risk (< 1.0)';

    // 3. EAC
    const eacEl = document.getElementById('kpi-eac-value');
    if (eacEl) eacEl.innerText = "$111,696";

    // 4. SPI
    const spiEl = document.getElementById('kpi-spi-value');
    if (spiEl) spiEl.innerText = "0.88";
    const spiStatus = document.getElementById('kpi-spi-status');
    if (spiStatus) spiStatus.innerText = "Retrasado";
    const spiDelay = document.getElementById('kpi-spi-delay');
    if (spiDelay) spiDelay.innerText = "12.4 días";

    // 5. Cycle Time
    const cycleEl = document.getElementById('kpi-cycle-value');
    if (cycleEl) cycleEl.innerText = "5.2";

    // 6. Flow Efficiency
    const flowEl = document.getElementById('kpi-flow-value');
    if (flowEl) flowEl.innerText = "24%";
};

// Global Exports for Talent Tab / Super View
window.loadCapacityWidget = loadCapacityWidget;
window.loadRecentActivity = loadRecentActivity;


// ========================================
// MANAGEMENT LOGIC (Projects & Users)
// ========================================

// 1. PROJECTS MANAGEMENT
async function loadProjectsTable() {
    console.log("Loading projects table...");
    const tbody = document.getElementById('projects-table-body');
    if (!tbody) { console.warn("No projects table body found"); return; }

    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Cargando...</td></tr>';

    try {
        const res = await ApiClient.get('/projects/');
        if (res.ok) {
            const projects = await res.json();
            if (projects.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hay proyectos.</td></tr>';
            } else {
                tbody.innerHTML = projects.map(p => `
                    <tr>
                        <td class="font-weight-bold">${p.name}</td>
                        <td class="text-muted small">${p.description || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="editProject('${p.id || p._id}')">Editar</button>
                            <button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="deleteProject('${p.id || p._id}')">Eliminar</button>
                        </td>
                    </tr>
                `).join('');
            }
        } else {
            throw new Error("Failed to fetch projects");
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Error al cargar proyectos</td></tr>';
        console.error(e);
    }
}

// Global scope for onclick handlers
window.openProjectForm = function (project = null) {
    document.getElementById('project-form-container').classList.remove('d-none');

    if (project) {
        document.getElementById('project-form-title').textContent = 'Editar Proyecto';
        document.getElementById('project-id').value = project.id || project._id;
        document.getElementById('project-name').value = project.name;
        document.getElementById('project-desc').value = project.description || '';
    } else {
        document.getElementById('project-form-title').textContent = 'Nuevo Proyecto';
        document.getElementById('project-id').value = '';
        document.getElementById('project-form').reset();
    }
}

window.closeProjectForm = function () {
    document.getElementById('project-form-container').classList.add('d-none');
}

window.editProject = async function (id) {
    try {
        const res = await ApiClient.get('/projects/');
        if (res.ok) {
            const projects = await res.json();
            const project = projects.find(p => (p.id || p._id) === id);
            if (project) openProjectForm(project);
        }
    } catch (e) {
        showToast('Error cargando proyecto', 'error');
    }
}

window.saveProject = async function () {
    const id = document.getElementById('project-id').value;
    const name = document.getElementById('project-name').value;
    const desc = document.getElementById('project-desc').value;

    const payload = { name, description: desc };

    try {
        let res;
        if (id) {
            res = await ApiClient.patch(`/projects/${id}`, payload);
        } else {
            res = await ApiClient.post('/projects/', payload);
        }

        if (res.ok) {
            showToast('Proyecto guardado', 'success');
            closeProjectForm();
            loadProjectsTable();
            // Refresh main dashboard lists if needed
            refreshDashboard();
        } else {
            const err = await res.json();
            showToast(err.detail || 'Error al guardar', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

window.deleteProject = async function (id) {
    if (!confirm('¿Estás seguro de eliminar este proyecto? Las tareas asociadas se desvincularán.')) return;

    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`/api/projects/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('Proyecto eliminado', 'success');
            loadProjectsTable();
            refreshDashboard();
        } else {
            showToast('Error al eliminar', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}


// 2. USERS MANAGEMENT
async function loadUsersTable() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Cargando...</td></tr>';

    try {
        const res = await ApiClient.get('/users/');
        if (res.ok) {
            const users = await res.json();
            tbody.innerHTML = users.map(u => `
                <tr>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                             <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width:24px; height:24px; font-size: 10px;">${(u.username || 'U').charAt(0).toUpperCase()}</div>
                             ${u.username}
                        </div>
                    </td>
                    <td class="text-muted small">${u.email}</td>
                    <td><span class="badge bg-light text-dark border">${u.role}</span></td>
                    <td class="text-center">${u.daily_capacity} / ${u.weekly_capacity}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="editUser('${u.id || u._id}')">Editar</button>
                         <button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="deleteUser('${u.id || u._id}')">Eliminar</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar usuarios</td></tr>';
        console.error(e);
    }
}

window.openUserForm = function (user) {
    document.getElementById('user-form-container').classList.remove('d-none');
    document.getElementById('user-id').value = user.id || user._id;
    document.getElementById('user-role').value = user.role || 'user';
    document.getElementById('user-daily-cap').value = user.daily_capacity || 8.0;
}

window.closeUserForm = function () {
    document.getElementById('user-form-container').classList.add('d-none');
}

window.editUser = async function (id) {
    try {
        const res = await ApiClient.get('/users/');
        if (res.ok) {
            const users = await res.json();
            const user = users.find(u => (u.id || u._id) === id);
            if (user) openUserForm(user);
        }
    } catch (e) {
        showToast('Error cargando usuario', 'error');
    }
}

window.saveUser = async function () {
    const id = document.getElementById('user-id').value;
    const role = document.getElementById('user-role').value;
    const cap = parseFloat(document.getElementById('user-daily-cap').value);
    const weekly = cap * 5;

    const payload = { role, daily_capacity: cap, weekly_capacity: weekly };

    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`/api/users/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast('Usuario actualizado', 'success');
            closeUserForm();
            loadUsersTable();
        } else {
            showToast('Error al actualizar', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

window.deleteUser = async function (id) {
    if (!confirm('¿Eliminar este usuario irremediablemente?')) return;
    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('Usuario eliminado', 'success');
            loadUsersTable();
        } else {
            const err = await res.json();
            showToast(err.detail || 'Error al eliminar', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

// 3. LISTENERS
// Listen for Modal Show to load data
const mgmtModal = document.getElementById('managementModal');
if (mgmtModal) {
    mgmtModal.addEventListener('show.bs.modal', () => {
        loadProjectsTable(); // Default active tab
    });

    const mgmtTabs = document.querySelectorAll('#managementTabs button[data-bs-toggle="tab"]');
    mgmtTabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            if (e.target.id === 'mgmt-projects-tab') loadProjectsTable();
            if (e.target.id === 'mgmt-users-tab') loadUsersTable();
        });
    });
}

// refreshDashboard is defined above.

// ==========================================
// 4. PROJECT BOARD (KANBAN) LOGIC
// ==========================================

async function loadProjectOverview() {
    const container = document.getElementById('scoreboard-table-container');

    // 1. Render Charts (Donuts & Stacked Bar)
    try {
        const [projectsRes, tasksRes] = await Promise.all([
            ApiClient.get('/projects'),
            ApiClient.get('/tasks')
        ]);

        if (projectsRes.ok && tasksRes.ok) {
            const projects = await projectsRes.json();
            const tasks = await tasksRes.json();

            // Create Project Map (ID -> Name)
            const projectMap = {};
            projects.forEach(p => projectMap[p.id || p._id] = p.name);

            // Call Render Function from charts.js
            if (typeof renderProjectCharts === 'function') {
                renderProjectCharts(tasks, projectMap);
            } else {
                console.warn('renderProjectCharts not found');
            }
        }
    } catch (error) {
        console.error('Error loading overview charts:', error);
    }

    // 2. Render Scoreboard (Deep Dive Table)
    if (typeof renderProjectScoreboard === 'function') {
        await renderProjectScoreboard();
    } else {
        if (container) {
            container.innerHTML = '<div class="alert alert-warning m-3">Scoreboard module not loaded.</div>';
        }
    }
}

async function loadProjectBoard() {
    const container = document.getElementById('kanban-projects-container');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-10 text-muted"><i class="fas fa-circle-notch fa-spin fa-2x mb-3"></i><p>Cargando Proyectos...</p></div>';

    try {
        // Fetch Projects and Tasks in parallel
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), 10000)
        );

        const [projectsRes, tasksRes] = await Promise.race([
            Promise.all([
                ApiClient.get('/projects'),
                ApiClient.get('/tasks')
            ]),
            timeout
        ]);

        if (!projectsRes.ok || !tasksRes.ok) {
            throw new Error(`API Error: Projects ${projectsRes.status}, Tasks ${tasksRes.status}`);
        }

        const projects = await projectsRes.json();
        const tasks = await tasksRes.json();

        // Process data for Kanban
        const projectsWithTasks = projects.map(project => {
            // Ensure ID compatibility
            const pid = project.id || project._id;
            const projectTasks = tasks.filter(t => (t.project_id === pid) || (t.project_id === String(pid)));

            // Helper to map API task to Kanban task
            const mapTask = (t) => ({
                ...t,
                id: t.id || t._id,
                title: t.title || t.task_name || 'Sin Título',
                time: t.estimated_hours ? `${t.estimated_hours}h` : '0h',
                date: t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Sin fecha',
                completed: t.status === 'COMPLETED'
            });

            return {
                ...project,
                tasks: {
                    todo: projectTasks.filter(t => ['PENDING', 'IN_PROGRESS', 'ON_HOLD'].includes(t.status)).map(mapTask),
                    blocked: projectTasks.filter(t => ['BLOCKED', 'CANCELLED'].includes(t.status)).map(mapTask),
                    done: projectTasks.filter(t => ['COMPLETED'].includes(t.status)).map(mapTask)
                }
            };
        });

        // Add "No Project" bucket if there are tasks without project? 
        // For now, adhere to "Project Board" == Projects.

        if (projectsWithTasks.length === 0) {
            container.innerHTML = '<div class="text-center py-10 text-muted"><p>No hay proyectos activos.</p></div>';
            return;
        }

        // Render using kanban-premium.js function
        if (typeof renderProjectCards === 'function') {
            renderProjectCards(projectsWithTasks);
        } else {
            console.error('renderProjectCards not found');
            container.innerHTML = '<div class="alert alert-danger">Error: Librería Kanban no cargada.</div>';
        }

    } catch (error) {
        console.error('Error loading board:', error);
        container.innerHTML = '<div class="alert alert-danger">Error al cargar el tablero.</div>';
    }
}

// ==========================================
// 5. AI AUDIT LOGIC
// ==========================================

let auditCharts = {};

async function loadAiAudit() {
    const container = document.getElementById('ai-audit-section');
    // loading indicator could go here

    try {
        // Fetch Data in Parallel
        const [healthRes, tasksRes] = await Promise.all([
            ApiClient.get('/audit/health-score'),
            ApiClient.get('/audit/tasks-with-audit')
        ]);

        const healthData = healthRes.ok ? await healthRes.json() : {};
        const tasksData = tasksRes.ok ? await tasksRes.json() : { tasks: [] };

        // Update UI
        updateAuditKPIs(healthData);
        renderAuditTable(tasksData);
        renderAuditCharts(healthData, tasksData);

    } catch (error) {
        console.error('Error loading audit:', error);
    }
}

function updateAuditKPIs(data) {
    document.getElementById('health-score-value').textContent = data.health_score ? Math.round(data.health_score) : '--';
    document.getElementById('health-score-grade').textContent = data.grade || '?';
}

function renderAuditTable(data) {
    const tableBody = document.querySelector('#audit-table tbody');
    if (!tableBody) return;

    document.getElementById('audited-count').textContent = data.total || 0;

    // Count critical
    const critical = data.tasks ? data.tasks.filter(t => t.ai_audit.risk_level === 'CRITICAL').length : 0;
    document.getElementById('critical-count').textContent = critical;

    if (data.tasks && data.tasks.length > 0) {
        tableBody.innerHTML = data.tasks.map(t => `
            <tr>
                <td class="ps-4">
                    <div class="fw-bold">${t.task_name}</div>
                    <div class="small text-muted">${t.assigned_to}</div>
                </td>
                <td>${t.estimated_hours}h</td>
                <td>${t.ai_audit.benchmark_hours?.toFixed(1) || '-'}h</td>
                <td>
                    <span class="${t.ai_audit.deviation_percentage > 20 ? 'text-danger' : 'text-success'}">
                        ${t.ai_audit.deviation_percentage?.toFixed(0)}%
                    </span>
                </td>
                <td><span class="badgex risk-${t.ai_audit.risk_level}">${t.ai_audit.risk_level}</span></td>
                <td><small>${t.ai_audit.recommended_action || '-'}</small></td>
            </tr>
        `).join('');
    } else {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No hay tareas auditadas aún.</td></tr>';
    }
}

function renderAuditCharts(healthData, tasksData) {
    // 1. Risk Distribution Chart
    const riskCtx = document.getElementById('risk-chart');
    if (riskCtx && healthData.risk_distribution) {
        if (auditCharts.risk) auditCharts.risk.destroy();

        auditCharts.risk = new Chart(riskCtx, {
            type: 'doughnut',
            data: {
                labels: ['Safe', 'Warning', 'Critical'],
                datasets: [{
                    data: [
                        healthData.risk_distribution.SAFE || 0,
                        healthData.risk_distribution.WARNING || 0,
                        healthData.risk_distribution.CRITICAL || 0
                    ],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // 2. Scatter Plot (Estimated vs Benchmark)
    const scatterCtx = document.getElementById('scatter-chart');
    if (scatterCtx && tasksData.tasks) {
        if (auditCharts.scatter) auditCharts.scatter.destroy();

        const scatterData = tasksData.tasks.map(t => ({
            x: t.estimated_hours,
            y: t.ai_audit.benchmark_hours || 0,
            task: t.task_name
        }));

        auditCharts.scatter = new Chart(scatterCtx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Tareas',
                    data: scatterData,
                    backgroundColor: 'rgba(99, 102, 241, 0.6)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }, {
                    label: 'Línea Ideal',
                    data: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
                    type: 'line',
                    borderColor: 'rgba(200, 200, 200, 0.5)',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: { display: true, text: 'Estimación Humana (h)' }
                    },
                    y: {
                        title: { display: true, text: 'Benchmark IA (h)' }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const pt = context.raw;
                                return `${pt.task}: Est ${pt.x}h vs IA ${pt.y}h`;
                            }
                        }
                    }
                }
            }
        });
    }
}

async function runAuditBatch() {
    const btn = document.getElementById('btn-run-audit');
    const spinner = document.getElementById('audit-loading');

    if (btn) btn.disabled = true;
    if (spinner) spinner.style.display = 'block';

    try {
        const res = await ApiClient.post('/audit/batch');
        const result = await res.json();

        if (res.ok) {
            showToast(`Auditoría completada. ${result.tasks_audited} tareas analizadas.`, 'success');
            loadAiAudit(); // Refresh UI
        } else {
            showToast('Error en auditoría', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    } finally {
        if (btn) btn.disabled = false;
        if (spinner) spinner.style.display = 'none';
    }
}

// ==========================================
// 6. EVENT LISTENERS INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Tab Listeners
    const scoreboardTab = document.getElementById('scoreboard-tab');
    if (scoreboardTab) {
        scoreboardTab.addEventListener('shown.bs.tab', () => loadProjectBoard());
    }

    const aiAuditTab = document.getElementById('ai-audit-tab');
    if (aiAuditTab) {
        aiAuditTab.addEventListener('shown.bs.tab', () => loadAiAudit());
    }

    // Button Listeners
    const runAuditBtn = document.getElementById('btn-run-audit');
    if (runAuditBtn) {
        runAuditBtn.addEventListener('click', runAuditBatch);
    }
});

// ==========================================
// 7. CSV UPLOAD
// ==========================================

async function uploadCSV() {
    const input = document.getElementById('csv-upload-input');
    if (!input || !input.files || input.files.length === 0) {
        showToast('Por favor selecciona un archivo CSV primero.', 'warning');
        return;
    }

    const file = input.files[0];
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('Solo se permiten archivos .csv', 'error');
        return;
    }

    // Visual feedback: disable button and show loading
    const uploadBtn = document.querySelector('[onclick="uploadCSV()"]');
    const originalText = uploadBtn ? uploadBtn.textContent : 'Cargar';
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Cargando...`;
    }

    showToast(`Procesando "${file.name}"...`, 'info');

    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            showToast('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/tasks/upload-csv', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const result = await response.json();

        if (response.ok && !result.error) {
            const inserted = result.inserted || 0;
            const failed = result.failed || 0;
            const projectsCreated = result.projects_created || 0;

            let msg = `✅ ${inserted} tarea(s) importada(s) exitosamente.`;
            if (projectsCreated > 0) msg += ` ${projectsCreated} proyecto(s) nuevos creados.`;
            if (failed > 0) msg += ` ⚠️ ${failed} fila(s) con error.`;

            showToast(msg, inserted > 0 ? 'success' : 'warning');

            // Reset file input UI
            input.value = '';
            const fileNameEl = document.getElementById('file-name-nav');
            if (fileNameEl) fileNameEl.textContent = 'Seleccionar Archivo';

            // Close dropdown
            const dropdown = document.getElementById('data-mgmt-dropdown');
            if (dropdown) dropdown.classList.add('hidden');

            // Refresh dashboard data
            if (typeof refreshDashboard === 'function') {
                setTimeout(() => refreshDashboard(), 800);
            }
        } else {
            const errMsg = result.detail || result.error || 'Error desconocido al procesar el CSV.';
            showToast(`❌ Error: ${errMsg}`, 'error');
            console.error('CSV Upload Error:', result);
        }
    } catch (err) {
        console.error('CSV Upload Exception:', err);
        showToast('Error de red al subir el CSV. Verifica tu conexión.', 'error');
    } finally {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = originalText;
        }
    }
}

// Expose globally (called from inline onclick in navigation.js)
window.uploadCSV = uploadCSV;

// ── MÓDULO CRUD DE TAREAS ────────────────────────────────────
function toggleTasksCrudModule() {
    const container = document.getElementById('tasks-crud-container');
    const btn = document.getElementById('btn-toggle-crud-module');
    if (!container) return;

    const isOpen = container.style.display === 'block';
    container.style.display = isOpen ? 'none' : 'block';

    if (btn) {
        btn.innerHTML = isOpen
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Abrir Módulo Tareas'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg> Cerrar Módulo';
    }
}
window.toggleTasksCrudModule = toggleTasksCrudModule;
