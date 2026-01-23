let ganttInstance;
let allGanttTasks = [];

async function loadGantt(projectId) {
    const container = document.getElementById('gantt-chart');
    if (!container) return;

    console.log(`📊 Gantt: Loading data for project: ${projectId}`);
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Loading timeline...</p></div>';

    try {
        let url = '/tasks/gantt';
        if (projectId && projectId !== 'ALL') url += `?project_id=${projectId}`;

        // Standardized fetch with ApiClient
        const response = await ApiClient.get(url);

        if (response.ok) {
            const tasks = await response.json();
            console.log(`📊 Gantt: Received ${tasks ? tasks.length : 0} tasks`);

            // 🚀 Call the new standardized renderer in charts.js
            if (window.renderGanttChart) {
                window.renderGanttChart(tasks);
            } else {
                console.error("❌ renderGanttChart not found in global scope.");
                // Fallback or legacy render if needed, but we expect charts.js to be loaded
            }
        } else if (response.status === 401) {
            console.warn('📊 Gantt: Unauthorized access detected.');
            container.innerHTML = `
                <div class="text-center py-5">
                    <p class="text-gray-500 mb-3">Your session has expired</p>
                    <a href="/static/pages/login.html" class="btn btn-primary btn-sm">Login Again</a>
                </div>
            `;
        } else {
            console.error('📊 Gantt: API Response not OK', response.status);
            container.innerHTML = `<div class="text-center text-red-500 py-4">Error: ${response.statusText}</div>`;
        }
    } catch (e) {
        console.error('📊 Gantt Error:', e);
        container.innerHTML = `<div class="text-center text-red-500 py-4">Failed to load timeline: ${e.message}</div>`;
    }
}

// Global Alias for dashboard.js
window.loadGantt = loadGantt;
window.loadGanttChart = loadGantt;
