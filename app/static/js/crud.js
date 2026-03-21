/**
 * CRUD Logic for Tasks, Projects and Talents
 * Integrated with Enterprise Dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initial data load for dropdowns
    loadProjectsDropdown();
    loadTalentsDropdown();
    loadValdesSoutoTasks();
});

// --- STATE ---
let bootstrapModals = {
    task: null,
    project: null,
    talent: null
};

function getModal(type) {
    const id = `${type}Modal`;
    if (!bootstrapModals[type]) {
        const el = document.getElementById(id);
        if (el) bootstrapModals[type] = new bootstrap.Modal(el);
    }
    return bootstrapModals[type];
}

// --- DROPDOWN LOADING ---
async function loadProjectsDropdown() {
    try {
        const response = await ApiClient.get('/projects');
        if (response.ok) {
            const projects = await response.json();
            const selects = ['task-project-id']; // Add more if needed
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const currentValue = el.value;
                    el.innerHTML = '<option value="">Seleccione un proyecto</option>';
                    projects.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.id || p._id; // Ensure we get the ID (handle 'id' or '_id')
                        opt.textContent = p.name;
                        el.appendChild(opt);
                    });
                    if (currentValue) el.value = currentValue;
                }
            });
        }
    } catch (err) {
        console.error('Error loading projects:', err);
    }
}

async function loadTalentsDropdown() {
    console.log("🚀 Starting to load talents...");
    try {
        const response = await ApiClient.get('/talents?_t=' + new Date().getTime());
        console.log("Talents response status:", response.status);
        if (response.ok) {
            const talents = await response.json();
            console.log("Talents data received:", talents);
            const selects = ['task-assigned-to'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const currentValue = el.value;
                    el.innerHTML = '<option value="">Sin asignar</option>';
                    talents.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.name;
                        opt.textContent = t.name;
                        el.appendChild(opt);
                    });
                    if (currentValue) el.value = currentValue;
                }
            });
            if (talents.length === 0) {
                console.warn("Talents list is empty!");
                // Optional: showToast("Warning: No talents found", "warning"); 
            }
        } else {
            console.error("Talents API returned error:", response.status);
            showToast("Error loading talents: " + response.status, "danger");
        }
    } catch (err) {
        console.error('Error loading talents:', err);
        showToast("Exception loading talents: " + err.message, "danger");
    }
}

async function loadValdesSoutoTasks() {
    console.log("🚀 Loading Valdes-Souto tasks...");
    try {
        const response = await ApiClient.get('/audit/valdes-souto-tasks?_t=' + new Date().getTime());
        if (response.ok) {
            const data = await response.json();
            console.log("Valdes-Souto tasks received:", data.tasks ? data.tasks.length : 0);

            const datalist = document.getElementById('valdes-souto-task-list');
            if (datalist && data.tasks) {
                datalist.innerHTML = '';
                data.tasks.forEach(taskName => {
                    const opt = document.createElement('option');
                    opt.value = taskName;
                    datalist.appendChild(opt);
                });
                console.log("Datalist populated with", data.tasks.length, "items");
            } else {
                console.error("Datalist element 'valdes-souto-task-list' NOT found in DOM or no tasks returned");
            }
        } else {
            console.error("Valdes-Souto API error:", response.status);
        }
    } catch (err) {
        console.error('Error loading Valdes-Souto tasks:', err);
    }
}

// --- OPEN MODALS ---
window.openTaskModal = async function (taskId = null) {
    const modal = getModal('task');
    const form = document.getElementById('task-form');
    const deleteBtn = document.getElementById('delete-task-btn');

    form.reset();
    document.getElementById('task-id').value = taskId || '';
    document.getElementById('taskModalTitle').textContent = taskId ? 'Editar Tarea' : 'Nueva Tarea';

    if (deleteBtn) {
        if (taskId) deleteBtn.classList.remove('d-none');
        else deleteBtn.classList.add('d-none');
    }

    // Refresh dropdowns to ensure we have latest data (and options exist)
    await Promise.all([loadProjectsDropdown(), loadTalentsDropdown()]);

    if (taskId) {
        try {
            const response = await ApiClient.get(`/tasks/${taskId}`);
            if (response.ok) {
                const task = await response.json();
                document.getElementById('task-name').value = task.title || task.name || task.task_name || '';
                document.getElementById('task-project-id').value = task.project_id || '';
                document.getElementById('task-assigned-to').value = task.assigned_to || '';
                document.getElementById('task-priority').value = task.priority || 'MEDIUM';
                document.getElementById('task-status').value = task.status || 'PENDING';
                document.getElementById('task-estimated-hours').value = task.estimated_hours || 0;
                document.getElementById('task-start-date').value = task.start_date ? task.start_date.split('T')[0] : '';
                document.getElementById('task-description').value = task.description || '';
                document.getElementById('task-logged-hours').value = task.logged_hours || 0;
                document.getElementById('task-progress').value = task.progress || 0;
            }
        } catch (err) {
            console.error('Error loading task:', err);
            showToast('Error al cargar datos de la tarea', 'danger');
        }
    }

    // --- Auto-Calculate Progress ---
    // --- Auto-Calculate Progress ---
    const estimatedInput = document.getElementById('task-estimated-hours');
    const loggedInput = document.getElementById('task-logged-hours');
    const progressInput = document.getElementById('task-progress');

    console.log('Auto-Calc Init:', { estimatedInput, loggedInput, progressInput });

    const calculateProgress = () => {
        const estimated = parseFloat(estimatedInput.value) || 0;
        const logged = parseFloat(loggedInput.value) || 0;
        console.log('Calculating Progress:', { estimated, logged });

        if (estimated > 0) {
            let percentage = (logged / estimated) * 100;
            if (percentage > 100) percentage = 100;
            progressInput.value = Math.round(percentage);
        } else {
            progressInput.value = 0;
        }
    };

    if (estimatedInput && loggedInput && progressInput) {
        estimatedInput.oninput = calculateProgress;
        loggedInput.oninput = calculateProgress;
        console.log('Auto-Calc Listeners Attached');
    } else {
        console.error('Auto-Calc: Inputs not found');
    }

    modal.show();
};

window.openProjectModal = async function (projectId = null) {
    const modal = getModal('project');
    const form = document.getElementById('project-form-modal');
    const deleteBtn = document.getElementById('delete-project-btn');
    form.reset();
    document.getElementById('project-modal-id').value = projectId || '';
    document.getElementById('projectModalTitle').textContent = projectId ? 'Editar Proyecto' : 'Nuevo Proyecto';

    if (deleteBtn) {
        if (projectId) deleteBtn.classList.remove('d-none');
        else deleteBtn.classList.add('d-none');
    }

    if (projectId) {
        try {
            const response = await ApiClient.get(`/projects/${projectId}`);
            if (response.ok) {
                const project = await response.json();
                document.getElementById('project-modal-name').value = project.name || '';
                document.getElementById('project-modal-description').value = project.description || '';
            }
        } catch (err) {
            console.error('Error loading project:', err);
        }
    }
    modal.show();
};

window.openTalentModal = async function (talentId = null) {
    const modal = getModal('talent');
    const form = document.getElementById('talent-form');
    const deleteBtn = document.getElementById('delete-talent-btn');
    form.reset();
    document.getElementById('talent-id').value = talentId || '';
    document.getElementById('talentModalTitle').textContent = talentId ? 'Editar Talento' : 'Nuevo Talento';

    if (deleteBtn) {
        if (talentId) deleteBtn.classList.remove('d-none');
        else deleteBtn.classList.add('d-none');
    }

    if (talentId) {
        try {
            const response = await ApiClient.get(`/talents/${talentId}`);
            if (response.ok) {
                const talent = await response.json();
                document.getElementById('talent-name').value = talent.name || '';
                document.getElementById('talent-email').value = talent.email || '';
                document.getElementById('talent-specialty').value = talent.specialty || '';
                document.getElementById('talent-seniority').value = talent.seniority || 'Mid';
                document.getElementById('talent-hourly-rate').value = talent.hourly_rate || 0;
            }
        } catch (err) {
            console.error('Error loading talent:', err);
        }
    }
    modal.show();
};

// --- SAVE ACTIONS ---
window.saveTask = async function () {
    const id = document.getElementById('task-id').value;
    const taskData = {
        title: document.getElementById('task-name').value, // Mapping to 'title' as per Option B
        project_id: document.getElementById('task-project-id').value,
        assigned_to: document.getElementById('task-assigned-to').value || null,
        priority: document.getElementById('task-priority').value,
        status: document.getElementById('task-status').value,
        estimated_hours: parseFloat(document.getElementById('task-estimated-hours').value) || 0,
        start_date: document.getElementById('task-start-date').value ? document.getElementById('task-start-date').value + 'T00:00:00' : null,
        due_date: document.getElementById('task-due-date').value ? document.getElementById('task-due-date').value + 'T23:59:59' : null,
        description: document.getElementById('task-description').value,
        logged_hours: parseFloat(document.getElementById('task-logged-hours').value) || 0,
        progress: parseInt(document.getElementById('task-progress').value) || 0
    };

    try {
        let response;
        if (id) {
            response = await ApiClient.put(`/tasks/${id}`, taskData);
        } else {
            response = await ApiClient.post('/tasks/', taskData);
        }

        if (response.ok) {
            getModal('task').hide();
            showToast('Tarea guardada correctamente', 'success');
            refreshDashboard();
        } else {
            const err = await response.json();
            console.error('Save Task Error:', err);
            showToast(`Error: ${formatError(err)}`, 'danger');
        }
    } catch (err) {
        showToast('Error de conexión', 'danger');
    }
};

window.saveProject = async function () {
    const id = document.getElementById('project-modal-id').value;
    const projectData = {
        name: document.getElementById('project-modal-name').value,
        description: document.getElementById('project-modal-description').value
    };

    try {
        let response;
        if (id) {
            response = await ApiClient.put(`/projects/${id}`, projectData);
        } else {
            response = await ApiClient.post('/projects/', projectData);
        }

        if (response.ok) {
            getModal('project').hide();
            showToast('Proyecto guardado correctamente', 'success');
            loadProjectsDropdown();
            refreshDashboard();
        } else {
            const err = await response.json();
            console.error('Save Project Error:', err);
            showToast(`Error: ${formatError(err)}`, 'danger');
        }
    } catch (err) {
        showToast('Error de conexión', 'danger');
    }
};

window.saveTalent = async function () {
    const id = document.getElementById('talent-id').value;
    const talentData = {
        name: document.getElementById('talent-name').value,
        email: document.getElementById('talent-email').value,
        specialty: document.getElementById('talent-specialty').value,
        seniority: document.getElementById('talent-seniority').value,
        hourly_rate: parseFloat(document.getElementById('talent-hourly-rate').value) || 0
    };

    try {
        let response;
        if (id) {
            response = await ApiClient.put(`/talents/${id}`, talentData);
        } else {
            response = await ApiClient.post('/talents/', talentData);
        }

        if (response.ok) {
            getModal('talent').hide();
            showToast('Talento guardado correctamente', 'success');
            loadTalentsDropdown();
            refreshDashboard();
        } else {
            const err = await response.json();
            console.error('Save Talent Error:', err);
            showToast(`Error: ${formatError(err)}`, 'danger');
        }
    } catch (err) {
        showToast('Error de conexión', 'danger');
    }
};


window.deleteTask = async function () {
    const id = document.getElementById('task-id').value;
    if (!id) return;
    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;

    try {
        const response = await ApiClient.delete(`/tasks/${id}`);
        if (response.ok) {
            getModal('task').hide();
            showToast('Tarea eliminada correctamente', 'success');
            refreshDashboard();
        } else {
            showToast('Error al eliminar tarea', 'danger');
        }
    } catch (err) {
        showToast('Error de conexión', 'danger');
    }
};

window.deleteProjectModal = async function () {
    const id = document.getElementById('project-modal-id').value;
    if (!id) return;
    if (!confirm('¿Estás seguro de eliminar este proyecto? Se desvincularán las tareas asociadas.')) return;

    try {
        const response = await ApiClient.delete(`/projects/${id}`);
        if (response.ok) {
            getModal('project').hide();
            showToast('Proyecto eliminado correctamente', 'success');
            loadProjectsDropdown();
            refreshDashboard();
        } else {
            showToast('Error al eliminar proyecto', 'danger');
        }
    } catch (err) {
        showToast('Error de conexión', 'danger');
    }
};

window.deleteTalent = async function () {
    const id = document.getElementById('talent-id').value;
    if (!id) return;
    if (!confirm('¿Estás seguro de eliminar este talento?')) return;

    try {
        const response = await ApiClient.delete(`/talents/${id}`);
        if (response.ok) {
            getModal('talent').hide();
            showToast('Talento eliminado correctamente', 'success');
            loadTalentsDropdown();
            refreshDashboard();
        } else {
            showToast('Error al eliminar talento', 'danger');
        }
    } catch (err) {
        showToast('Error de conexión', 'danger');
    }
};

// --- UTILS ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0 show`;
    toast.role = 'alert';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

function formatError(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err.detail) {
        if (typeof err.detail === 'string') return err.detail;
        if (Array.isArray(err.detail)) {
            return err.detail.map(e => `${e.loc ? e.loc.join('.') : ''}: ${e.msg}`).join(' | ');
        }
        return JSON.stringify(err.detail);
    }
    return JSON.stringify(err);
}

// function refreshDashboard() removed: handled by dashboard.js
