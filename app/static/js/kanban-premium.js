// ==================== PREMIUM KANBAN INTERACTIONS ====================

/**
 * Toggle project card accordion expansion
 * @param {HTMLElement} headerElement - The header element that was clicked
 */
function toggleProjectCard(headerElement) {
    const card = headerElement.closest('.project-card');
    if (card) {
        card.classList.toggle('expanded');
    }
}

/**
 * Initialize drag and drop functionality for task cards
 */
function initializeDragDrop() {
    let draggedElement = null;

    // Setup draggable task cards
    document.querySelectorAll('.task-card').forEach(card => {
        card.setAttribute('draggable', 'true');

        card.addEventListener('dragstart', (e) => {
            draggedElement = card;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => card.style.opacity = '0.5', 0);
        });

        card.addEventListener('dragend', () => {
            if (draggedElement) {
                draggedElement.style.opacity = '1';
                draggedElement = null;
            }
        });
    });

    // Setup drop zones (columns)
    document.querySelectorAll('.kanban-column').forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            column.style.background = 'rgba(88, 101, 242, 0.05)';
        });

        column.addEventListener('dragleave', () => {
            column.style.background = '';
        });

        column.addEventListener('drop', (e) => {
            e.preventDefault();
            column.style.background = '';

            if (draggedElement) {
                // Insert before the empty state if it exists
                const emptyState = column.querySelector('.empty-state');
                if (emptyState) {
                    column.insertBefore(draggedElement, emptyState);
                } else {
                    column.appendChild(draggedElement);
                }

                // Update column counts
                updateColumnCounts();
            }
        });
    });
}

/**
 * Update project metrics based on task distribution
 */
function updateColumnCounts() {
    const projectCard = document.querySelector('.project-card');
    if (!projectCard) return;

    const columns = projectCard.querySelectorAll('.kanban-column');
    const metrics = {
        todo: 0,
        blocked: 0,
        done: 0
    };

    columns.forEach((column, index) => {
        const taskCards = column.querySelectorAll('.task-card:not(.empty-state)');
        if (index === 0) metrics.todo = taskCards.length;
        if (index === 1) metrics.blocked = taskCards.length;
        if (index === 2) metrics.done = taskCards.length;
    });

    // Update metric displays
    const metricElements = projectCard.querySelectorAll('.metric-value');
    if (metricElements.length >= 3) {
        metricElements[0].textContent = metrics.todo;
        metricElements[1].textContent = metrics.blocked;
        metricElements[2].textContent = metrics.done;
    }

    // Update progress bar
    const total = metrics.todo + metrics.blocked + metrics.done;
    if (total > 0) {
        const progressPercent = Math.round((metrics.done / total) * 100);
        const progressFill = projectCard.querySelector('.progress-fill');
        const progressText = projectCard.querySelector('.project-progress span:last-child');

        if (progressFill) {
            progressFill.style.width = `${progressPercent}%`;
        }
        if (progressText) {
            progressText.textContent = `${progressPercent}%`;
        }
    }
}

/**
 * Initialize scroll reveal animations using IntersectionObserver
 */
function initializeScrollReveal() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'cardEnter 0.8s ease-out 0.2s both';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.task-card').forEach(card => {
        observer.observe(card);
    });
}

/**
 * Create a new task card element
 * @param {Object} task - Task data
 * @param {string} task.title - Task title
 * @param {string} task.time - Estimated hours
 * @param {string} task.date - Due date
 * @param {boolean} task.completed - Completion status
 * @param {number} task.xp - XP value (for completed tasks)
 * @returns {HTMLElement} Task card element
 */
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = task.completed ? 'task-card completed' : 'task-card';
    card.setAttribute('draggable', 'true');

    if (task.completed) {
        card.innerHTML = `
            <div class="task-header-row">
                <h5 class="task-title">${task.title}</h5>
                <span class="xp-badge">⚡ +${task.xp || 20} XP</span>
            </div>
            <div class="task-footer">
                <span class="checkmark">✓</span>
                <span class="completion">✓ 100%</span>
            </div>
        `;
    } else {
        card.innerHTML = `
            <h5 class="task-title">${task.title}</h5>
            <div class="task-meta">
                <span class="task-time">⏱ ${task.time}</span>
                <span class="task-date">📅 ${task.date}</span>
            </div>
            <button class="task-action">▶</button>
        `;
    }

    return card;
}

/**
 * Render project cards from data
 * @param {Array} projects - Array of project objects
 */
function renderProjectCards(projects) {
    const container = document.getElementById('kanban-projects-container');
    if (!container) return;

    container.innerHTML = '';

    projects.forEach((project, index) => {
        const card = document.createElement('div');
        card.className = index === 0 ? 'project-card expanded' : 'project-card';

        const progress = calculateProgress(project.tasks);

        card.innerHTML = `
            <div class="project-header" onclick="toggleProjectCard(this)">
                <div class="project-info">
                    <div class="project-icon">${project.icon || ''}</div>
                    <div class="project-details">
                        <h3 class="project-title">${project.name}</h3>
                        <div class="project-progress">
                            <span>Progress</span>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                            <span>${progress}%</span>
                        </div>
                    </div>
                </div>
                
                <div class="project-metrics">
                    <div class="metric">
                        <div class="metric-value">${project.tasks.todo.length}</div>
                        <div class="metric-label">Por Hacer</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${project.tasks.blocked.length}</div>
                        <div class="metric-label">Bloqueos</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${project.tasks.done.length}</div>
                        <div class="metric-label">Logros</div>
                    </div>
                    <div class="status-badge">
                        <span class="status-indicator"></span>
                        ${project.status || 'Active'}
                    </div>
                </div>

                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            </div>
            
            <div class="project-content">
                <div class="kanban-columns">
                    <!-- Por Hacer Column -->
                    <div class="kanban-column">
                        <h4 class="column-title">
                            <span class="column-icon">📋</span>
                            Por Hacer
                        </h4>
                        ${renderTaskCards(project.tasks.todo, false)}
                    </div>
                    
                    <!-- Bloqueado Column -->
                    <div class="kanban-column">
                        <h4 class="column-title">
                            <span class="column-icon">🚫</span>
                            Bloqueado
                        </h4>
                        ${project.tasks.blocked.length === 0 ?
                '<div class="empty-state"><div class="shield-icon">🛡️</div><p>Sin bloqueos activos.</p></div>' :
                renderTaskCards(project.tasks.blocked, false)
            }
                    </div>
                    
                    <!-- Logros Column -->
                    <div class="kanban-column">
                        <h4 class="column-title">
                            <span class="column-icon">✨</span>
                            Logros
                        </h4>
                        ${renderTaskCards(project.tasks.done, true)}
                    </div>
                </div>
            </div>
        `;

        container.appendChild(card);
    });

    // Reinitialize drag and drop
    initializeDragDrop();
    initializeScrollReveal();
}

/**
 * Helper: Render task cards HTML
 */
function renderTaskCards(tasks, completed) {
    if (!tasks || tasks.length === 0) return '';

    return tasks.map(task => {
        if (completed) {
            return `
                <div class="task-card completed" draggable="true">
                    <div class="task-header-row">
                        <h5 class="task-title">${task.title}</h5>
                        <span class="xp-badge">⚡ +${task.xp || 20} XP</span>
                    </div>
                    <div class="task-footer">
                        <span class="checkmark">✓</span>
                        <span class="completion">✓ 100%</span>
                    </div>
                </div>
            `;
        } else if (task.is_blocked || task.blocker) {
            return `
                <div class="task-card blocked" draggable="true" style="border-left: 3px solid #ef4444; background: #fef2f2;">
                    <h5 class="task-title" style="color: #991b1b;">${task.title}</h5>
                    <div class="task-meta" style="color: #ef4444; font-weight: 600;">
                        <span class="blocker-reason"><i class="fas fa-lock" style="margin-right:4px;"></i> ${task.blocker || 'Bloqueado'}</span>
                    </div>
                    <div class="task-footer" style="margin-top: 8px; border-top: 1px solid #fecaca; padding-top: 6px;">
                        <span class="task-time" style="color: #b91c1c;">${task.time}</span>
                        <button class="task-action text-red-500 hover:bg-white" title="Notificar">🔔</button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="task-card" draggable="true">
                    <h5 class="task-title">${task.title}</h5>
                    <div class="task-meta">
                        <span class="task-time">⏱ ${task.time}</span>
                        <span class="task-date">📅 ${task.date}</span>
                    </div>
                    <button class="task-action">▶</button>
                </div>
            `;
        }
    }).join('');
}

/**
 * Helper: Calculate project progress
 */
function calculateProgress(tasks) {
    const total = tasks.todo.length + tasks.blocked.length + tasks.done.length;
    if (total === 0) return 0;
    return Math.round((tasks.done.length / total) * 100);
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeDragDrop();
        initializeScrollReveal();
    });
} else {
    initializeDragDrop();
    initializeScrollReveal();
}
