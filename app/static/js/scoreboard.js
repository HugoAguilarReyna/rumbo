/**
 * Hierarchical Project Scoreboard
 * Structure: Project > Resource > Task (3 levels)
 */

class ProjectScoreboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    async load() {
        try {
            const response = await ApiClient.get('/analytics/projects/deep-dive');

            const data = await response.json();
            this.render(data.projects);

        } catch (error) {
            console.error('Scoreboard load error:', error);
            if (this.container) {
                this.container.innerHTML =
                    `<div class="alert alert-danger">
                        <strong>Failed to load scoreboard</strong><br>
                        <small>${error.message}</small>
                    </div>`;
            }
        }
    }

    render(projects) {
        if (!this.container) return;

        if (!projects || projects.length === 0) {
            this.container.innerHTML =
                '<div class="alert alert-info">No project data available</div>';
            return;
        }

        this.container.innerHTML = `
            <div class="accordion" id="projectAccordion">
                ${projects.map((project, idx) => this.renderProject(project, idx)).join('')}
            </div>
        `;
    }

    renderProject(project, index) {
        const completionColor =
            project.completion_rate >= 80 ? 'success' :
                project.completion_rate >= 50 ? 'warning' :
                    'danger';

        const collapseId = `collapse-${index}`;
        const headingId = `heading-${index}`;

        return `
            <div class="accordion-item">
                <h2 class="accordion-header" id="${headingId}">
                    <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" 
                            type="button" 
                            data-bs-toggle="collapse" 
                            data-bs-target="#${collapseId}">
                        <div class="w-100 d-flex justify-content-between align-items-center pe-3">
                            <div>
                                <strong class="fs-6">${project.name}</strong>
                                <br>
                                <small class="text-muted">
                                    ${project.completed_tasks} / ${project.total_tasks} tasks
                                </small>
                            </div>
                            <div style="width: 250px;">
                                <div class="progress" style="height: 25px;">
                                    ${this.generateStatusBar(project.status_distribution, project.total_tasks)}
                                </div>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="${collapseId}" 
                     class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                     data-bs-parent="#projectAccordion">
                    <div class="accordion-body p-0">
                        ${this.renderResources(project.resources)}
                    </div>
                </div>
            </div>
        `;
    }

    renderResources(resources) {
        return `
            <table class="table table-sm table-hover mb-0">
                <thead class="table-light">
                    <tr>
                        <th width="30%">Resource</th>
                        <th width="15%" class="text-center">Tasks</th>
                        <th width="15%" class="text-center">Completed</th>
                        <th width="25%">Completion Rate</th>
                        <th width="15%"></th>
                    </tr>
                </thead>
                <tbody>
                    ${resources.map(resource => this.renderResource(resource)).join('')}
                </tbody>
            </table>
        `;
    }

    renderResource(resource) {
        // Unique ID for resource row across all projects should be robust
        // Adding random suffix or using explicit indices would be safer but name is okay for now if unique per project context?
        // Actually resource names might clash across projects but here we just need a unique ID for the toggle.
        // Let's use a random ID to be safe.
        const resourceId = `res-${Math.random().toString(36).substr(2, 9)}`;

        const rateColor =
            resource.completion_rate >= 80 ? 'success' :
                resource.completion_rate >= 50 ? 'warning' :
                    'danger';

        return `
            <tr>
                <td>
                    <strong>${resource.name || 'Unassigned'}</strong>
                </td>
                <td class="text-center">
                    <span class="badge bg-primary">${resource.task_count}</span>
                </td>
                <td class="text-center">
                    <span class="badge bg-success">${resource.completed}</span>
                </td>
                <td>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar bg-${rateColor}" 
                             style="width: ${resource.completion_rate}%">
                            ${resource.completion_rate.toFixed(1)}%
                        </div>
                    </div>
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary" 
                            onclick="toggleTaskDetails('${resourceId}')">
                        <span id="${resourceId}-icon">▶</span> Tasks
                    </button>
                </td>
            </tr>
            <tr id="${resourceId}" style="display: none;">
                <td colspan="5" class="bg-light">
                    ${this.renderTasks(resource.tasks)}
                </td>
            </tr>
        `;
    }

    renderTasks(tasks) {
        return `
            <div class="ps-4 pe-4 pt-2 pb-2">
                <table class="table table-sm table-borderless bg-white">
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th width="15%">Status</th>
                            <th width="15%">Due Date</th>
                            <th width="15%">Hours</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tasks.map(task => `
                            <tr>
                                <td>
                                    <a href="#" onclick="openTaskDetail('${task.id}'); return false;">
                                        ${task.title}
                                    </a>
                                </td>
                                <td>
                                    <span class="badge bg-${this.getStatusColor(task.status)}">
                                        ${task.status}
                                    </span>
                                </td>
                                <td>
                                    ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}
                                </td>
                                <td>
                                    <small class="text-muted">
                                        ${task.logged_hours || 0}h / ${task.estimated_hours || 0}h
                                    </small>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    getStatusColor(status) {
        const colors = {
            'PENDING': 'secondary',
            'IN_PROGRESS': 'primary',
            'COMPLETED': 'success',
            'BLOCKED': 'danger',
            'ON_HOLD': 'warning',
            'CANCELLED': 'dark'
        };
        return colors[status] || 'secondary';
    }

    generateStatusBar(distribution, total) {
        if (!distribution || total === 0) return '';

        const config = [
            { key: 'COMPLETED', color: 'success', label: 'Completed' },
            { key: 'IN_PROGRESS', color: 'primary', label: 'In Progress' },
            { key: 'PENDING', color: 'warning', label: 'Pending' },
            { key: 'BLOCKED', color: 'danger', label: 'Blocked' },
            { key: 'ON_HOLD', color: 'secondary', label: 'On Hold' },
            { key: 'CANCELLED', color: 'dark', label: 'Cancelled' }
        ];

        return config.map(item => {
            const count = distribution[item.key] || 0;
            if (count === 0) return '';
            const width = (count / total) * 100;
            return `
                <div class="progress-bar bg-${item.color}" 
                     role="progressbar" 
                     style="width: ${width}%" 
                     title="${item.label}: ${count} tasks"
                     data-bs-toggle="tooltip">
                     ${width > 10 ? count : ''}
                </div>
            `;
        }).join('');
    }
}

// Global function to toggle task details
function toggleTaskDetails(resourceId) {
    const row = document.getElementById(resourceId);
    const icon = document.getElementById(`${resourceId}-icon`);

    if (!!row && row.style.display === 'none') {
        row.style.display = 'table-row';
        if (icon) icon.textContent = '▼';
    } else if (row) {
        row.style.display = 'none';
        if (icon) icon.textContent = '▶';
    }
}

// Initialize scoreboard
async function renderProjectScoreboard() {
    // Ensure the container exists in index.html, it is named 'scoreboard-table-container'
    const scoreboard = new ProjectScoreboard('scoreboard-table-container');
    await scoreboard.load();
}
