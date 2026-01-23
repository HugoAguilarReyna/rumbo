class ChecklistManager {
    constructor(taskId) {
        this.taskId = taskId;
    }

    async addItem(text) {
        const response = await fetch(`/api/tasks/${this.taskId}/checklist`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ text })
        });

        return response.json();
    }

    async toggleItem(itemId, completed) {
        const response = await fetch(`/api/tasks/${this.taskId}/checklist/${itemId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ completed })
        });

        return response.json();
    }

    async deleteItem(itemId) {
        const response = await fetch(`/api/tasks/${this.taskId}/checklist/${itemId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        return response.json();
    }

    renderChecklist(task) {
        const checklists = task.checklists || [];
        const progress = task.checklist_progress || { total: 0, completed: 0, percentage: 0 };

        return `
            <div class="checklist-container mt-3">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0">Checklist (${progress.completed}/${progress.total})</h6>
                    <div class="progress" style="width: 150px; height: 10px;">
                        <div class="progress-bar bg-success" 
                             style="width: ${progress.percentage}%">
                        </div>
                    </div>
                </div>
                
                <div class="checklist-items mb-3">
                    ${checklists.length === 0 ? '<p class="text-muted small">No subtasks yet.</p>' : ''}
                    ${checklists.map(item => `
                        <div class="d-flex align-items-center mb-2 justify-content-between">
                            <div class="form-check mb-0">
                                <input class="form-check-input" 
                                       type="checkbox" 
                                       id="chk-${item.id}"
                                       ${item.completed ? 'checked' : ''}
                                       onchange="toggleChecklistItem('${this.taskId}', '${item.id}', this.checked)">
                                <label class="form-check-label ${item.completed ? 'text-decoration-line-through text-muted' : ''}" for="chk-${item.id}">
                                    ${item.text}
                                </label>
                            </div>
                            <button class="btn btn-sm btn-link text-danger p-0" 
                                    style="text-decoration: none;"
                                    onclick="deleteChecklistItem('${this.taskId}', '${item.id}')">
                                &times;
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <div class="input-group input-group-sm">
                    <input type="text" 
                           class="form-control" 
                           id="new-checklist-item-${this.taskId}"
                           placeholder="Add subtask...">
                    <button class="btn btn-outline-secondary" 
                            onclick="addChecklistItem('${this.taskId}')">
                        Add
                    </button>
                </div>
            </div>
        `;
    }
}

// Global functions for inline usage
async function toggleChecklistItem(taskId, itemId, completed) {
    const manager = new ChecklistManager(taskId);
    await manager.toggleItem(itemId, completed);
    // Ideally we re-render just the checklist or the whole modal
    // Assuming 'renderTaskDetails' is the global function to refresh modal
    if (window.renderTaskDetails) await window.renderTaskDetails(taskId);
}

async function deleteChecklistItem(taskId, itemId) {
    if (!confirm('Delete this subtask?')) return;
    const manager = new ChecklistManager(taskId);
    await manager.deleteItem(itemId);
    if (window.renderTaskDetails) await window.renderTaskDetails(taskId);
}

async function addChecklistItem(taskId) {
    const input = document.getElementById(`new-checklist-item-${taskId}`);
    const text = input.value.trim();
    if (!text) return;

    const manager = new ChecklistManager(taskId);
    await manager.addItem(text);
    input.value = '';
    if (window.renderTaskDetails) await window.renderTaskDetails(taskId);
}
