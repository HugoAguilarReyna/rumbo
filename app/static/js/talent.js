// talent.js - Personal Workspace / My Dashboard Logic

const talentManager = {
    // Current State
    state: {
        projects: [],
        filterDate: 'this_month',
        filterProject: 'ALL'
    },

    // Initialize the module
    init() {
        console.log("Initializing Personal Workspace...");
        this.charts = {}; // Initialize charts object
        this.cacheDOM();
        this.bindEvents();
        this.refresh();
    },

    cacheDOM() {
        this.dom = {
            // Header Metrics
            velocityVal: document.getElementById('my-velocity-value'),
            // velocitySpark: removed 
            otdVal: document.getElementById('my-otd-value'),
            // otdRingFill: removed
            xpGained: document.getElementById('xp-gained'),

            // Main Container
            projectsContainer: document.getElementById('kanban-projects-container'),

            // Team / Legacy Metrics
            kpiOtd: document.getElementById('kpi-otd-value'),
            kpiOverloaded: document.getElementById('kpi-overloaded-value'),
            kpiBlocked: document.getElementById('kpi-blocked-value'),

            // Charts
            chartWorkload: document.getElementById('talent-workload-chart'),
            chartStacked: document.getElementById('talent-stacked-chart'),

            // Table
            tableBody: document.getElementById('talent-table-body')
        };

    },

    bindEvents() {
        // Tab Visibility Listener (Fix for Chart.js rendering on hidden canvas)
        const tabEl = document.getElementById('talent-tab');
        if (tabEl) {
            tabEl.addEventListener('shown.bs.tab', () => {
                console.log("Talent Tab Shown - Refreshing Charts");
                this.refresh();
            });
        }

        // Global event listeners for buttons inside dynamically created elements
        document.addEventListener('click', (e) => {

            // Expanded/Collapse Accordion
            if (e.target.closest('.accordion-trigger')) {
                const trigger = e.target.closest('.accordion-trigger');
                const content = trigger.nextElementSibling;
                const icon = trigger.querySelector('.fa-chevron-down');

                content.classList.toggle('hidden');
                icon.classList.toggle('rotate-180');
            }

            // Notify Blocker Button
            if (e.target.closest('.btn-notify-blocker')) {
                const btn = e.target.closest('.btn-notify-blocker');
                const taskName = btn.dataset.task;
                this.handleNotifyBlocker(taskName);
            }

            // Start Focus Button
            if (e.target.closest('.btn-start-focus')) {
                const btn = e.target.closest('.btn-start-focus');
                const taskId = btn.dataset.id;
                this.handleStartFocus(taskId, btn);
            }
        });
    },

    async refresh() {
        try {
            console.log("Talent Tab: Refreshing...");
            console.log("Talent Tab: Checking Auth Token:", localStorage.getItem('access_token') ? "OK" : "MISSING");

            // 1. Parallel Fetch: Tasks (Raw) + Projects (Mapping)
            const [tasksRes, projectsRes] = await Promise.all([
                ApiClient.get('/tasks/'),
                ApiClient.get('/analytics/projects')
            ]);

            console.log("Talent Tab: Tasks Response Status:", tasksRes.status);
            console.log("Talent Tab: Projects Response Status:", projectsRes.status);

            if (!tasksRes.ok) {
                console.error("Talent Tab: Tasks Fetch Failed", await tasksRes.text());
                throw new Error(`Failed to fetch tasks: ${tasksRes.status}`);
            }

            const tasks = await tasksRes.json();
            console.log("Talent Tab: Tasks fetched", tasks.length);

            let projects = [];
            if (projectsRes.ok) {
                projects = await projectsRes.json();
            } else {
                console.warn("Talent Tab: Projects Fetch Failed", projectsRes.status);
            }
            console.log("Talent Tab: Projects fetched", projects.length);

            // 2. Process Data Locally (Homologation)
            // Join Project Names
            const projectLookup = {};
            projects.forEach(p => projectLookup[p.id] = p.name);

            const processedData = this.processTasksForTalent(tasks, projectLookup);
            console.log("Talent Tab: Processed Data", processedData);

            // 3. Render Views
            this.renderHeader(processedData.user_header);
            this.renderProjects(processedData.project_cards);
            this.renderTeamStats(processedData.kpis, processedData.resources);

        } catch (error) {
            console.error("Error loading Personal Workspace:", error);
            // console.warn("Falling back to Mock Data due to error.");
            // this.renderWithMockData();

            // DEBUG: Show error to user (UI only, no alert)
            if (this.dom.projectsContainer) {
                this.dom.projectsContainer.innerHTML = `
                    <div class="p-4 bg-red-100 text-red-700 rounded-lg">
                        <h3 class="font-bold">Error Loading Data</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }
    },

    // ⚡ CORE HOMOLOGATION LOGIC ⚡
    processTasksForTalent(tasks, projectMap = {}) {
        // A. Filter for Current User (if needed) - Keeping it Global for Manager View

        // B. Aggregate by Project
        const projects = {}; // Map by Name to aggregate
        const resourceMap = {};

        // 0. Initialize ALL projects from the lookup to ensure they appear even if empty
        // projectMap is ID -> Name. We need to invert it or use the original array if available.
        // Since we only passed projectMap, let's assume we can reconstruct or simple iterate tasks is insufficient.
        // BETTER APPROACH: The caller 'refresh' has access to the full 'projects' array. 
        // Let's change the signature of processTasksForTalent to key off the projects array if possible, 
        // OR, simply auto-populate from the map values.

        // 0. Initialize ALL projects from the Deep Dive source
        // This ensures "Mis Proyectos" matches the "Tablero" (Scoreboard) exactly.

        Object.values(projectMap).forEach(pName => {
            // Clean up name if needed (sometimes map might have different keys, but pName is the value)
            if (!projects[pName]) {
                projects[pName] = {
                    name: pName,
                    total: 0,
                    completed: 0,
                    blocked: 0,
                    pending: 0,
                    tasks: []
                };
            }
        });

        // Helper: safe status check (Homologated with Charts.js)
        const getStatus = (t) => {
            const s = (t.status || t.custom_class || '').toUpperCase();
            if (s.includes('COMPLET') || s.includes('DONE')) return 'COMPLETED';
            if (s.includes('IN_PROG') || s.includes('PROGRESS')) return 'IN_PROGRESS';
            if (s.includes('BLOCK') || s.includes('HOLD')) return 'ON_HOLD';
            return 'PENDING'; // Default
        };

        tasks.forEach(task => {
            // 1. Resolve Project Name
            // Try project_name directly, then lookup ID, then fallback
            let pName = task.project_name;
            if (!pName && task.project_id) {
                pName = projectMap[task.project_id];
            }
            if (!pName) pName = 'Sin Proyecto';

            // Ensure project exists (in case it wasn't in the map for some reason)
            if (!projects[pName]) {
                projects[pName] = {
                    name: pName,
                    total: 0,
                    completed: 0,
                    blocked: 0,
                    pending: 0,
                    tasks: []
                };
            }
            projects[pName].total++;
            projects[pName].tasks.push(task);

            const status = getStatus(task);
            if (status === 'COMPLETED') projects[pName].completed++;
            if (status === 'BLOCKED') projects[pName].blocked++;
            if (status === 'PENDING' || status === 'IN_PROGRESS') projects[pName].pending++;

            // 2. Resources Aggregation
            const uName = task.assigned_to || task._assigned || 'Unassigned';
            if (!resourceMap[uName]) {
                resourceMap[uName] = {
                    name: uName,
                    active_tasks: 0,
                    pending_high_priority: 0,
                    workload_hours: 0,
                    blocked_rate: 0,
                    completed_count: 0,
                    total_count: 0,
                    status_breakdown: { PENDING: 0, IN_PROGRESS: 0, BLOCKED: 0, ON_HOLD: 0, COMPLETED: 0 }
                };
            }

            const r = resourceMap[uName];
            r.total_count++;

            // Increment granular status
            r.status_breakdown[status] = (r.status_breakdown[status] || 0) + 1;

            if (status === 'IN_PROGRESS' || status === 'PENDING') r.active_tasks++;
            if (status === 'COMPLETED') r.completed_count++;
            if (String(task.priority).toUpperCase() === 'HIGH' && (status === 'PENDING' || status === 'IN_PROGRESS')) r.pending_high_priority++;

            // Workload: Handle different field names for hours
            // console.log("Task est:", task.estimated_hours, task._est);
            const hours = parseFloat(task.estimated_hours || task._est || 0);
            if (!isNaN(hours)) r.workload_hours += hours;
        });

        // C. Metrics Calculation
        const resourcesList = Object.values(resourceMap).map(r => {
            r.otd_score = r.total_count ? Math.round((r.completed_count / r.total_count) * 100) : 0;
            r.blocked_rate = r.total_count ? Math.round((r.status_breakdown.BLOCKED / r.total_count) * 100) : 0;
            return r;
        });

        // D. Format Project Cards
        const projectCards = Object.values(projects).map(p => ({
            project_name: p.name,
            progress_bar: p.total ? Math.round((p.completed / p.total) * 100) : 0,
            status_summary: p.blocked > 0 ? "Blocked" : "Active",
            counts: { pending: p.pending, blocked: p.blocked, done: p.completed },
            columns: {
                pending_list: p.tasks.filter(t => ['PENDING', 'IN_PROGRESS', 'ON_HOLD'].includes(getStatus(t))).map(t => ({
                    name: t.title || t.name,
                    priority: t.priority || 'Normal',
                    est: (t.estimated_hours || 0) + 'h',
                    due: t.due_date
                })),
                blocked_list: p.tasks.filter(t => getStatus(t) === 'BLOCKED').map(t => ({
                    name: t.title || t.name,
                    blocker: "Bloqueo detectado",
                    days_blocked: 1
                })),
                done_list: p.tasks.filter(t => getStatus(t) === 'COMPLETED').map(t => ({
                    name: t.title || t.name,
                    efficiency: 100
                }))
            }
        }));

        // E. Executive Portfolio Metrics (New Redesign)
        const totalProjects = projectCards.length;
        const blockedProjects = projectCards.filter(p => p.status_summary === 'Blocked').length;
        const activeProjects = totalProjects - blockedProjects;

        // Calculate Global Weighted Progress
        const totalProgressSum = projectCards.reduce((acc, p) => acc + p.progress_bar, 0);
        const globalProgress = totalProjects > 0 ? Math.round(totalProgressSum / totalProjects) : 0;

        // F. Calculate Velocity & Gamification (Real Data)
        const completedTasks = tasks.filter(t => getStatus(t) === 'COMPLETED');
        const velocityCurrent = completedTasks.reduce((acc, t) => acc + (parseFloat(t.estimated_hours || 0) || 0), 0);
        const totalXp = completedTasks.length * 10;

        // Calculate Avg OTD from resources or tasks? 
        // Resources OTD is already calculated in resourcesList (line 227)
        // Let's average the resources OTD
        const avgOtd = resourcesList.length > 0
            ? Math.round(resourcesList.reduce((acc, r) => acc + r.otd_score, 0) / resourcesList.length)
            : 0;

        return {
            user_header: {
                velocity: {
                    current: Math.round(velocityCurrent),
                    trend: [Math.round(velocityCurrent * 0.8), Math.round(velocityCurrent)] // Mock trend for now 
                },
                otd_score: avgOtd,
                gamification: {
                    xp_weekly: { python: totalXp },
                    badges: []
                },
                // Keep these just in case, but they are not used by renderHeader currently
                portfolio: {
                    total: totalProjects,
                    active: activeProjects,
                    blocked: blockedProjects
                }
            },
            project_cards: projectCards,
            kpis: {
                avg_otd_score: 85,
                total_overloaded_users: resourcesList.filter(r => r.workload_hours > 40).length,
                active_resources: resourcesList.length
            },
            resources: resourcesList
        };
    },

    // KEEP MOCK FOR OFFLINE / ERROR Fallback
    renderWithMockData() {
        const mockData = this.getMockData();
        this.renderHeader(mockData.user_header);
        this.renderHeader(mockData.user_header);
        this.renderProjects(mockData.project_cards);
        this.renderTeamStats(mockData.kpis, mockData.resources);
    },


    getMockData() {
        return {
            user_header: {
                velocity: { current: 12, trend: [8, 10, 12, 11, 14] },
                otd_score: 95.0,
                gamification: { xp_weekly: { python: 20 }, badges: ["Bug Hunter"] }
            },
            project_cards: [
                {
                    project_name: "App Bancaria iOS",
                    progress_bar: 60,
                    status_summary: "Active",
                    status_color: "green",
                    counts: { pending: 5, blocked: 1, done: 12 },
                    columns: {
                        pending_list: [
                            { name: "Integrar FaceID", due: "Mañana", est: "2h", priority: "High" },
                            { name: "Refactor Login", due: "Jueves", est: "4h", priority: "Medium" }
                        ],
                        blocked_list: [
                            { name: "Fix Crash Splash", blocker: "Esperando diseño", days_blocked: 2 }
                        ],
                        done_list: [
                            { name: "Setup Proyecto", completed_date: "Yesterday", efficiency: 100 }
                        ]
                    }
                },
                {
                    project_name: "Migración Cloud",
                    progress_bar: 20,
                    status_summary: "Blocked",
                    status_color: "red",
                    counts: { pending: 2, blocked: 1, done: 3 },
                    columns: {
                        pending_list: [{ name: "Config Docker", due: "Hoy", est: "3h", priority: "High" }],
                        blocked_list: [{ name: "Script Python", blocker: "Acceso AWS", days_blocked: 1 }],
                        done_list: []
                    }
                }
            ],
            // Mock Team Data
            kpis: {
                avg_otd_score: 88.5,
                total_overloaded_users: 2,
                active_resources: 5
            },
            resources: [
                { name: "Dev A", otd_score: 95, active_tasks: 4, pending_high_priority: 1, workload_hours: 42, blocked_rate: 0 },
                { name: "Dev B", otd_score: 70, active_tasks: 6, pending_high_priority: 3, workload_hours: 38, blocked_rate: 15 },
                { name: "Dev C", otd_score: 92, active_tasks: 3, pending_high_priority: 0, workload_hours: 20, blocked_rate: 5 },
                { name: "Dev D", otd_score: 85, active_tasks: 5, pending_high_priority: 2, workload_hours: 45, blocked_rate: 10 }
            ]
        };

    },

    renderHeader(headerData) {
        if (!this.dom.velocityVal) return;

        // Velocity
        this.dom.velocityVal.textContent = headerData.velocity.current;
        // this.renderSparkline(headerData.velocity.trend, this.dom.velocitySpark); // Removed

        // OTD
        if (this.dom.otdVal) this.dom.otdVal.textContent = headerData.otd_score + "%";

        // OTD Ring Animation - Removed for Resumen Style

        // Gamification XP
        let totalXp = 0;
        if (headerData.gamification && headerData.gamification.xp_weekly) {
            totalXp = Object.values(headerData.gamification.xp_weekly).reduce((a, b) => a + b, 0);
        }
        if (this.dom.xpGained) this.dom.xpGained.textContent = "+" + totalXp; // Or just totalXp if "+" is in HTML
    },

    formatDateFriendly(dateStr) {
        if (!dateStr) return '';
        if (['Hoy', 'Mañana', 'Yesterday'].includes(dateStr)) return dateStr; // Keep existing human strings
        const date = new Date(dateStr);
        if (isNaN(date)) return dateStr;

        const now = new Date();
        const diffStats = Math.floor((date - now) / (1000 * 60 * 60 * 24));

        if (diffStats === -1) return 'Ayer';
        if (diffStats === 0) return 'Hoy';
        if (diffStats === 1) return 'Mañana';

        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    },

    renderProjects(projects) {
        if (!this.dom.projectsContainer) return;

        // Map Talent.js Data Format -> Kanban Premium Data Format
        const kanbanData = projects.map(p => ({
            name: p.project_name,
            icon: '<i class="fas fa-layer-group fa-lg"></i>', // Generic Icon
            status: p.status_summary,
            tasks: {
                todo: p.columns.pending_list.map(t => ({
                    title: t.name,
                    time: t.est,
                    date: t.due,
                    priority: t.priority,
                    completed: false
                })),
                blocked: p.columns.blocked_list.map(t => ({
                    title: t.name,
                    time: t.days_blocked ? `${t.days_blocked}d blocked` : 'Blocked', // Fallback for time slot
                    date: 'Action Req',
                    blocker: t.blocker, // Pass blocker reason
                    completed: false,
                    is_blocked: true
                })),
                done: p.columns.done_list.map(t => ({
                    title: t.name,
                    xp: 20,
                    completed: true
                }))
            }
        }));

        // Call the Global Rendering Function from kanban-premium.js
        if (typeof renderProjectCards === 'function') {
            console.log("Rendering Premium Kanban Cards for", kanbanData.length, "projects");
            renderProjectCards(kanbanData);
        } else {
            console.error("Kanban Premium Module not loaded!");
            this.dom.projectsContainer.innerHTML = '<div class="text-red-500">Error: Premium Kanban module missing</div>';
        }
    },

    generateTaskColumnHtml(tasks, type) {
        if (!tasks || tasks.length === 0) {
            // Premium Empty State
            let emptyIcon = "fa-check-circle";
            let emptyMsg = "¡Genial! Nada pendiente.";
            if (type === 'blocked') { emptyIcon = "fa-shield-alt"; emptyMsg = "Sin bloqueos activos."; }
            if (type === 'done') { emptyIcon = "fa-mug-hot"; emptyMsg = "Aún no hay logros hoy."; }

            return `
            <div class="text-center py-8 opacity-50 select-none">
                <i class="fas ${emptyIcon} fa-3x text-gray-300 mb-2"></i>
                <p class="text-sm text-gray-400 font-medium">${emptyMsg}</p>
            </div>`;
        }

        return tasks.map(task => {
            // Humanize Date
            const dateStr = task.due || task.completed_date || '';
            const dateDisplay = this.formatDateFriendly(dateStr);
            const isSoon = dateStr.includes('Mañana') || dateStr.includes('Hoy');
            const dateColorStyle = isSoon ? 'color: #ef4444;' : 'color: #6b7280;'; // Red vs Gray

            // FORCE COLORS via Inline Styles
            const borderColors = { 'High': '#ef4444', 'Medium': '#3b82f6', 'Low': '#d1d5db' };
            const borderColor = task.priority === 'High' ? borderColors['High'] : (task.priority === 'Medium' ? borderColors['Medium'] : borderColors['Low']);

            // Distinct styling for each type
            if (type === 'pending') {
                return `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm hover:shadow-lg transition-all group relative" style="border-left: 6px solid ${borderColor}; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">${task.name}</span>
                        ${task.priority === 'High' ? '<span class="flex-shrink-0 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider" style="color: #b91c1c; background-color: #fef2f2; border: 1px solid #fecaca;">HIGH</span>' : ''}
                    </div>
                    <div class="flex justify-between items-center mt-3">
                        <div class="flex items-center gap-3">
                             <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-gray-50 dark:bg-gray-700 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                                <i class="fas fa-clock text-gray-400"></i> ${task.est || 'N/A'}
                             </span>
                             <span class="text-[11px] font-medium flex items-center gap-1.5" style="${dateColorStyle}">
                                <i class="fas fa-calendar-alt"></i> ${dateDisplay}
                             </span>
                        </div>
                        <button class="btn-start-focus text-gray-300 hover:text-blue-600 transition-colors p-1" title="Iniciar Focus Mode" data-id="${task.id || Math.random()}">
                            <i class="fas fa-play-circle fa-2x"></i>
                        </button>
                    </div>
                </div>`;
            } else if (type === 'blocked') {
                return `
                <div class="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg shadow-sm group transition-colors" style="border-left: 6px solid #ef4444; background-color: #fef2f2;">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-2">${task.name}</span>
                    </div>
                    <div class="text-xs font-medium mb-3 px-2 py-1.5 rounded inline-block" style="color: #b91c1c; background-color: #fee2e2; border: 1px solid #fecaca;">
                        <i class="fas fa-lock me-1"></i>${task.blocker || 'Bloqueo'}
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] text-gray-400 font-medium">Hace ${task.days_blocked || 1} días</span>
                        <button class="btn-notify-blocker bg-white text-red-500 hover:text-red-700 text-[11px] px-2.5 py-1 rounded border border-red-100 shadow-sm transition-all" data-task="${task.name}">
                            Notificar
                        </button>
                    </div>
                </div>`;
            } else { // done
                const efficiency = task.efficiency || 100;
                const efficiencyColor = efficiency >= 100 ? '#10b981' : '#f59e0b';

                return `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm opacity-75 hover:opacity-100 transition-all" style="border-left: 6px solid #22c55e;">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-sm font-bold text-gray-600 dark:text-gray-400 line-clamp-2 decoration-gray-300">${task.name}</span>
                         <span class="text-xs font-bold drop-shadow-sm flex items-center gap-1" style="color: #d97706;"><i class="fas fa-bolt text-amber-400"></i> +${efficiency >= 100 ? '20' : '10'} XP</span>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                         <span class="text-[10px] text-gray-400"><i class="fas fa-check me-1"></i>${dateDisplay}</span>
                         <span class="text-[10px] px-2 py-0.5 rounded-full font-bold border" style="background-color: #ecfdf5; color: #15803d; border-color: #bbf7d0;">
                            ⚡ ${efficiency}%
                         </span>
                    </div>
                </div>`;
            }
        }).join('');
    },

    handleNotifyBlocker(taskName) {
        console.log(`Sending ping for blocked task: ${taskName}`);

        let msg = `🔔 Notificación enviada al responsable del bloqueo en "${taskName}"`;
        if (typeof showToast === 'function') {
            showToast(msg, "success"); // Assuming showToast is globally available from dashboard.js
        } else {
            alert(msg);
        }
    },

    handleStartFocus(taskId, btnElement) {
        // Toggle visual state
        const card = btnElement.closest('div.group'); // The task card wrapper
        const isFocused = card.classList.contains('ring-2');

        if (isFocused) {
            // Stop Focus
            card.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20', 'scale-105');
            btnElement.innerHTML = '<i class="fas fa-play-circle fa-lg"></i>';
            btnElement.classList.remove('text-blue-600');
            btnElement.classList.add('text-gray-300');
        } else {
            // Start Focus - Reset others first
            document.querySelectorAll('.btn-start-focus').forEach(b => {
                const c = b.closest('div.group');
                if (c) c.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20', 'scale-105');
                b.innerHTML = '<i class="fas fa-play-circle fa-lg"></i>';
                b.classList.remove('text-blue-600');
                b.classList.add('text-gray-300');
            });

            card.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20', 'scale-105');
            btnElement.innerHTML = '<i class="fas fa-pause-circle fa-lg text-blue-600"></i>';
            btnElement.classList.remove('text-gray-300');
            btnElement.classList.add('text-blue-600');

            if (typeof showToast === 'function') {
                showToast(`▶️ Modo Focus iniciado. ¡A trabajar!`, "info");
            }
        }
    },

    filterFocus() {
        if (typeof showToast === 'function') {
            showToast(`🔍 Filtrando por tareas críticas de hoy...`, "info");
        }
    },

    // --- TEAM / MANAGER VIEW LOGIC ---

    renderTeamStats(kpis, resources) {
        // 1. KPIs
        if (this.dom.kpiOtd) this.dom.kpiOtd.textContent = kpis.avg_otd_score + "%";
        if (this.dom.kpiOverloaded) this.dom.kpiOverloaded.textContent = kpis.total_overloaded_users;
        if (this.dom.kpiBlocked) {
            // Calculate avg blocked rate from resources if not provided directly
            const avgBlocked = resources.length ? (resources.reduce((a, b) => a + (b.blocked_rate || 0), 0) / resources.length).toFixed(1) : 0;
            this.dom.kpiBlocked.textContent = avgBlocked + "%";
        }

        // 2. Charts
        this.renderWorkloadChart(resources);
        this.renderStackedChart(resources);

        // 3. Table
        this.renderTeamTable(resources);
    },

    // Helper for Glow Effect (Replicated from charts.js)
    hexToRgba(hex, alpha) {
        if (!hex) return `rgba(0,0,0,${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    // ============================================
    // CHART 1: Carga de Trabajo (Horas Asignadas)
    // ============================================
    renderWorkloadChart(resources) {
        if (!this.dom.chartWorkload) return;

        const ctx = this.dom.chartWorkload.getContext('2d');
        const labels = resources.map(r => r.name);

        // Get workload hours
        const hours = resources.map(r => r.workload_hours || 0);

        // Theme & Colors
        const PALETTE = {
            completed: '#00E676',   // Neon Green
            in_progress: '#2979FF', // Electric Blue
            pending: '#FFC400',     // Amber Gold
            blocked: '#FF1744',     // Fluorescent Red
            on_hold: '#94A3B8',     // Slate Gray
            text_dark: '#f1f5f9',   // Slate 50
            text_light: '#0f172a'   // Slate 900
        };

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? PALETTE.text_dark : PALETTE.text_light;

        // Helper function to create rgba
        const rgba = (hex, alpha) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        // Destroy existing chart
        if (this.charts.workload instanceof Chart) {
            this.charts.workload.destroy();
        }

        // Create dataset with color based on hours (overload > 40h)
        const dataset = {
            label: 'Horas Asignadas',
            data: hours,
            backgroundColor: hours.map(h => rgba(h > 40 ? PALETTE.blocked : PALETTE.in_progress, 0.2)),
            borderColor: hours.map(h => h > 40 ? PALETTE.blocked : PALETTE.in_progress),
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
            hoverBackgroundColor: hours.map(h => rgba(h > 40 ? PALETTE.blocked : PALETTE.in_progress, 0.3)),
            hoverBorderWidth: 3
        };

        this.charts.workload = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [dataset]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                barPercentage: 0.9,       // Match Resumen proportion
                categoryPercentage: 0.8,  // Match Resumen proportion
                plugins: {
                    legend: {
                        display: false // No legend for single dataset
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        cornerRadius: 8,
                        padding: 12,
                        titleFont: {
                            family: 'Inter',
                            size: 13,
                            weight: '600'
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                const hours = context.raw;
                                const overloaded = hours > 40 ? ' ⚠️ OVERLOADED' : '';
                                return `Hours: ${hours}h${overloaded}`;
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        beginAtZero: true,
                        max: 60, // Max 60 hours for scale
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Horas Asignadas',
                            color: textColor,
                            font: {
                                family: 'Inter',
                                size: 12,
                                weight: '600'
                            }
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: 'Inter',
                                size: 11
                            },
                            callback: function (value) {
                                return value + 'h';
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: 'Inter',
                                weight: '600',
                                size: 12
                            },
                            autoSkip: false // Show all labels
                        }
                    }
                }
            }
        });
    },

    // ===============================================
    // CHART 2: Estado de Tareas por Recurso (Stacked)
    // ===============================================
    renderStackedChart(resources) {
        if (!this.dom.chartStacked) return;

        const ctx = this.dom.chartStacked.getContext('2d');
        const labels = resources.map(r => r.name);

        // Theme & Colors
        const PALETTE = {
            completed: '#00E676',   // Neon Green
            in_progress: '#2979FF', // Electric Blue
            pending: '#FFC400',     // Amber Gold
            blocked: '#FF1744',     // Fluorescent Red
            on_hold: '#94A3B8',     // Slate Gray
            text_dark: '#f1f5f9',   // Slate 50
            text_light: '#0f172a'   // Slate 900
        };

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? PALETTE.text_dark : PALETTE.text_light;

        // Helper function to create rgba
        const rgba = (hex, alpha) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        // Extract status data from resources
        const getDataForStatus = (status) => {
            return labels.map(resourceName => {
                const resource = resources.find(r => r.name === resourceName);
                if (!resource || !resource.status_breakdown) return 0;
                return resource.status_breakdown[status] || 0;
            });
        };

        // Destroy existing chart
        if (this.charts.stacked instanceof Chart) {
            this.charts.stacked.destroy();
        }

        // Create stacked datasets
        const createDataset = (label, data, color) => ({
            label: label,
            data: data,
            backgroundColor: rgba(color, 0.2),
            borderColor: color,
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
            hoverBackgroundColor: rgba(color, 0.3),
            hoverBorderWidth: 3
        });

        const datasets = [
            createDataset('Completed', getDataForStatus('COMPLETED'), PALETTE.completed),
            createDataset('In Progress', getDataForStatus('IN_PROGRESS'), PALETTE.in_progress),
            createDataset('Pending', getDataForStatus('PENDING'), PALETTE.pending),
            createDataset('Blocked', getDataForStatus('BLOCKED'), PALETTE.blocked),
            createDataset('On Hold', getDataForStatus('ON_HOLD'), PALETTE.on_hold)
        ];

        this.charts.stacked = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                barPercentage: 0.9,       // Match Resumen proportion
                categoryPercentage: 0.8,  // Match Resumen proportion

                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            color: textColor,
                            font: {
                                family: 'Inter',
                                size: 12,
                                weight: '500'
                            },
                            padding: 16,
                            boxWidth: 8,
                            boxHeight: 8
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        cornerRadius: 8,
                        padding: 12,
                        titleFont: {
                            family: 'Inter',
                            size: 13,
                            weight: '600'
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            footer: (items) => {
                                const total = items.reduce((a, b) => a + b.raw, 0);
                                return `Total: ${total} Tasks`;
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Cantidad de Tareas',
                            color: textColor,
                            font: {
                                family: 'Inter',
                                size: 12,
                                weight: '600'
                            }
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    y: {
                        stacked: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: 'Inter',
                                weight: '600',
                                size: 12
                            },
                            autoSkip: false // Show all labels
                        }
                    }
                }
            }
        });
    },

    renderTeamTable(resources) {
        if (!this.dom.tableBody) return;

        this.dom.tableBody.innerHTML = resources.map((r, index) => {
            // Logic for visual states
            const score = r.otd_score;
            let scoreColor = '#23A559'; // Success
            let scoreTrack = '#E6F4EA';

            if (score < 60) { scoreColor = '#DA373C'; scoreTrack = '#FDECEA'; } // Critical
            else if (score < 80) { scoreColor = '#F0B232'; scoreTrack = '#FEF7EC'; } // Warning

            // Conic Gradient for Ring
            const gradient = `conic-gradient(${scoreColor} ${score}%, ${scoreTrack} ${score}% 100%)`;

            // Workload Logic
            let hoursClass = 'normal';
            if (r.workload_hours > 45) hoursClass = 'heavy';

            // Status Logic
            let statusClass = 'success';
            let statusText = 'Normal';
            if (r.workload_hours > 50 || score < 60) { statusClass = 'error'; statusText = 'Atención'; }
            else if (r.workload_hours > 40 || score < 80) { statusClass = 'warning'; statusText = 'Revisar'; }

            // Priority Badge
            const priorityBadge = r.pending_high_priority > 0
                ? `<div class="glass-badge red"><i class="fas fa-fire"></i> ${r.pending_high_priority} High</div>`
                : `<div class="glass-badge empty">-</div>`;

            // Avatar Initials
            const initial = (r.name || 'U').charAt(0).toUpperCase();

            // Staggered Animation Delay
            const delay = index * 0.05;

            return `
                <tr class="animate-row" style="animation-delay: ${delay}s;">
                    <!-- Resource Avatar & Name -->
                    <td>
                        <div class="resource-cell">
                            <div class="avatar-wrapper">
                                <div class="resource-avatar">${initial}</div>
                            </div>
                            <div class="resource-info">
                                <span class="name">${r.name}</span>
                                <span class="id">ID: ${r.id || 'N/A'}</span>
                            </div>
                        </div>
                    </td>

                    <!-- OTD Score Ring -->
                    <td>
                        <div class="ring-container">
                            <div class="progress-ring-circle" style="
                                width: 44px; 
                                height: 44px; 
                                border-radius: 50%;
                                background: ${gradient};
                                -webkit-mask: radial-gradient(closest-side, transparent 75%, black 76%);
                                mask: radial-gradient(closest-side, transparent 75%, black 76%);
                            "></div>
                            <span class="ring-value">${score}%</span>
                        </div>
                    </td>

                    <!-- Active Tasks -->
                    <td style="text-align: center;">
                        <div class="metric-box">
                            <span class="metric-number">${r.active_tasks}</span>
                            <span class="metric-label">Activas</span>
                        </div>
                    </td>

                    <!-- Priority -->
                    <td style="text-align: center;">
                        ${priorityBadge}
                    </td>

                    <!-- Workload Hours -->
                    <td style="text-align: center;">
                        <div class="hours-pill ${hoursClass}">
                            ${r.workload_hours}h
                        </div>
                    </td>

                    <!-- Status Pill -->
                    <td style="text-align: center;">
                        <div class="status-pill ${statusClass}">
                            <span class="status-dot"></span>
                            ${statusText}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

};

// Export to global scope
window.talentManager = talentManager;

document.addEventListener('DOMContentLoaded', () => {
    // Check if element exists to avoid errors on other pages
    if (document.getElementById('talent')) {
        talentManager.init();
    }
});
