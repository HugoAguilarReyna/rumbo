// ========================================
// 🚀 GANTT PREMIUM - NEON GLASS EDITION (UNIFIED THEME + 10 CRITICAL FIXES)
// ========================================

/**
 * FEATURES:
 * 1. ✅ Fixed Sidebar Gantt (Split-Pane)
 * 2. ✅ Neon Glass Charts (Chart.js)
 * 3. ✅ Glow Effects & Dynamic Coloring (UI_THEME)
 * 4. ✅ Premium Inter Typography
 * 5. ✅ Fully Responsive & Interactive
 * 6. ✅ Robust Data Access (Raw vs Mapped)
 * 7. ✅ Weighted Workload Chart (Stacked Tasks)
 * 8. ✅ Multi-Project Stacked Status (ID -> Name Mapping)
 * 9. ✅ HOMOLOGATED COLOR SYSTEM (Global Theme)
 * 10. ✅ Zoom 100 levels, Minimap, Shortcuts, Today Line
 */

// 🌍 ESTADO GLOBAL
window.globalGanttData = window.globalGanttData || [];

// 🎨 GLOBAL UI THEME (The Source of Truth)
const UI_THEME = {
    // 1. Semantic Color Palette
    palette: {
        completed: '#00E676',   // Neon Green
        in_progress: '#2979FF', // Electric Blue
        pending: '#FFC400',     // Amber Gold
        blocked: '#FF1744',     // Fluorescent Red
        on_hold: '#94A3B8',     // Slate Gray
        cancelled: '#64748B',   // Darker Slate
        accent_1: '#00E5FF',    // Cyan
        accent_2: '#D500F9',    // Purple
        text_dark: '#f1f5f9',   // Slate 50
        text_light: '#0f172a',  // Slate 900
        grid_dark: '#334155',   // Slate 700
        grid_light: '#e2e8f0'   // Slate 200
    },
    // 2. Utility Functions
    utils: {
        // Shared Glow Effect (70% opacity for body, 100% for border)
        getColors: (hex) => ({
            background: hexToRgba(hex, 0.2), // 20% Alpha for Charts (Glass Effect)
            border: hex,
            solid: hex
        })
    }
};

// 🎨 THEME CONFIG (Legacy Compat)
const THEME = {
    light: { bg: '#fff', grid: UI_THEME.palette.grid_light, text: UI_THEME.palette.text_light, today: UI_THEME.palette.blocked },
    dark: { bg: '#0f172a', grid: UI_THEME.palette.grid_dark, text: UI_THEME.palette.text_dark, today: UI_THEME.palette.blocked },
    current: 'light' // Can be toggled externally
};

// 🔧 Helper: Hex to RGBA
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 🔍 ZOOM MEJORADO - 100 Niveles con Interpolación
const ZOOM = {
    getConfig(val) {
        const v = Math.max(1, Math.min(100, parseInt(val)));
        const lerp = (a, b, t) => a + (b - a) * t;

        if (v <= 25) { // Ultra Detail
            return { columnWidth: lerp(50, 80, (v - 1) / 24), step: 6, mode: 'Day', label: 'Ultra Detail' };
        } else if (v <= 45) { // Day
            return { columnWidth: lerp(30, 50, (v - 26) / 19), step: 24, mode: 'Day', label: 'Day' };
        } else if (v <= 65) { // Week
            return { columnWidth: lerp(40, 100, (v - 46) / 19), step: 168, mode: 'Week', label: 'Week' };
        } else { // Month (Extended to 100)
            return { columnWidth: lerp(60, 150, (v - 66) / 34), step: 720, mode: 'Month', label: 'Month' };
        }
    }
};

// ⚡ UTILS
const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
const throttle = (fn, ms) => { let last = 0; return (...args) => { const now = Date.now(); if (now - last >= ms) { fn(...args); last = now; } }; };

// ==========================================
// 🎯 GANTT RENDERER (Split-Pane Architecture)
// ==========================================
function renderGanttChart(data) {
    if (data?.length > 0) {
        // ALWAYS update global data and filters if data is provided
        window.globalGanttData = data;
        populateGanttFilters(data);
    }

    const ps = document.getElementById('gantt-filter-project');
    const rs = document.getElementById('gantt-filter-resource');
    const projectFilter = ps?.value || 'ALL';
    const resourceFilter = rs?.value || 'ALL';

    let filtered = globalGanttData.length ? globalGanttData : data;
    if (projectFilter !== 'ALL') filtered = filtered.filter(t => (t.project_id || 'Uncategorized') === projectFilter);
    if (resourceFilter !== 'ALL') filtered = filtered.filter(t => (t.assigned_to || 'Unassigned') === resourceFilter);

    const container = document.getElementById('gantt-chart');
    if (!container) return console.error('❌ Container not found');

    // Sanitization
    const valid = filtered.filter(t => {
        if (!t.start || !t.end) return false;
        const s = new Date(t.start), e = new Date(t.end);
        return !isNaN(s) && !isNaN(e) && s.getFullYear() > 1970;
    });

    if (!valid.length) {
        container.innerHTML = '<div class="text-center py-10 opacity-50"><p>No tasks available</p></div>';
        return;
    }

    const tasks = valid.map((t, i) => ({
        id: t.id || `task_${i}`,
        name: t.name || t.title || `Task ${i + 1}`,
        start: t.start,
        end: t.end,
        progress: t.progress || 0,
        custom_class: `bar-${(t.status || 'pending').toLowerCase().replace(/_/g, '-')}`,
        dependencies: t.dependencies || '',
        _project: t.project_name,
        _assigned: t.assigned_to,
        _priority: t.priority || 'medium',
        _est: t.estimated_hours || 0,
        _act: t.logged_hours || 0
    }));

    injectStyles();
    container.innerHTML = '';

    // 🏗️ DOM Structure (Fixed Sidebar)
    container.style.cssText = 'height:650px; width:100%; display:flex; border:1px solid ' + THEME[THEME.current].grid + '; background:' + THEME[THEME.current].bg + '; position:relative; overflow:hidden;';

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'gantt-sidebar-fixed';
    sidebar.style.cssText = 'width:250px; min-width:250px; border-right:1px solid ' + THEME[THEME.current].grid + '; overflow:hidden; display:flex; flex-direction:column; background:' + THEME[THEME.current].bg + '; z-index:1001; box-shadow: 2px 0 5px rgba(0,0,0,0.05);';

    const sidebarHeader = document.createElement('div');
    sidebarHeader.style.cssText = 'height:76px; min-height:75px; border-bottom:1px solid ' + THEME[THEME.current].grid + '; display:flex; align-items:center; padding:0 16px; font-weight:700; color:' + THEME[THEME.current].text + '; background:' + THEME[THEME.current].bg;
    sidebarHeader.textContent = "Tasks";
    sidebar.appendChild(sidebarHeader);

    const sidebarBody = document.createElement('div');
    sidebarBody.className = 'gantt-sidebar-body';
    sidebarBody.style.cssText = 'flex:1; overflow:hidden; position:relative;';

    const rowHeight = 48; // Frappe Default match
    tasks.forEach(t => {
        const row = document.createElement('div');
        row.style.cssText = `height:${rowHeight}px; display:flex; flex-direction:column; justify-content:center; padding:0 16px; border-bottom:1px solid ${THEME[THEME.current].grid}22; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
        row.innerHTML = `<div style="font-size:13px; font-weight:600; color:${THEME[THEME.current].text}; overflow:hidden; text-overflow:ellipsis;">${t.name}</div>${t._assigned ? `<div style="font-size:11px; color:#94a3b8;">${t._assigned}</div>` : ''}`;
        sidebarBody.appendChild(row);
    });
    sidebar.appendChild(sidebarBody);
    container.appendChild(sidebar);

    // Viewport
    const viewport = document.createElement('div');
    viewport.className = 'gantt-viewport-scrollable';
    viewport.style.cssText = 'flex:1; overflow:auto; position:relative;';

    const renderTarget = document.createElement('div');
    renderTarget.id = 'gantt-render-target';
    viewport.appendChild(renderTarget);
    container.appendChild(viewport);

    // Sync
    let isSyncing = false;
    viewport.addEventListener('scroll', () => {
        if (!isSyncing) {
            isSyncing = true;
            sidebarBody.scrollTop = viewport.scrollTop;
            requestAnimationFrame(() => isSyncing = false);
        }
    });
    // In case logic allows sidebar scroll later
    sidebarBody.addEventListener('scroll', () => {
        if (!isSyncing) {
            isSyncing = true;
            viewport.scrollTop = sidebarBody.scrollTop;
            requestAnimationFrame(() => isSyncing = false);
        }
    });

    try {
        const gantt = new Gantt("#gantt-render-target", tasks, {
            header_height: 75, column_width: 50, step: 24, bar_height: 28, bar_corner_radius: 6, arrow_curve: 8, padding: 20, view_mode: 'Week', custom_popup_html: createPopup, on_click: highlightDeps
        });
        window.ganttInstance = gantt;

        setTimeout(() => {
            syncVisuals(); initZoom(); addTodayLine(); addShortcuts();
            setTimeout(addMinimap, 150); // Delay adicional para asegurar render completo

            // 🚀 INIT ANALYTICS (Using Mapped Data from Gantt Context)
            renderProjectCharts(tasks, {});
            renderUtilizationChart(tasks);

            // Header Sync
            const realHeader = viewport.querySelector('.gantt-header-container');
            if (realHeader) {
                sidebarHeader.style.height = realHeader.offsetHeight + 'px';
                sidebarHeader.style.minHeight = realHeader.offsetHeight + 'px';
            }
            console.log("✅ Gantt & Analytics Loaded");
        }, 100);
    } catch (e) { console.error("❌ Render Error:", e); }
}

// ==========================================
// 📊 NEON GLASS ANALYTICS (GLOBAL THEME INTEGRATION)
// ==========================================

function resolveThemeColor(statusOrValue) {
    if (typeof statusOrValue === 'number') {
        if (statusOrValue > 100) return UI_THEME.palette.blocked;
        if (statusOrValue > 75) return UI_THEME.palette.in_progress;
        return UI_THEME.palette.completed;
    }
    const s = (statusOrValue || '').toUpperCase();
    if (s.includes('COMPLET') || s.includes('DONE')) return UI_THEME.palette.completed;
    if (s.includes('PROGRESS') || s.includes('IN')) return UI_THEME.palette.in_progress;
    if (s.includes('BLOCK') || s.includes('HIGH')) return UI_THEME.palette.blocked;
    if (s.includes('HOLD') || s.includes('WAIT')) return UI_THEME.palette.on_hold;
    return UI_THEME.palette.pending;
}

// 1. PROJECT STATUS (Stacked Horizontal Bar per Project) & DONUTS
function renderProjectCharts(tasks, projectMap = {}) {
    // ... [Original Logic Kept for consistency with UI_THEME] ...
    const ctx = document.getElementById('projectsChart');
    const groups = {};
    const projects = new Set();
    const tasksByProjectCount = {};
    const tasksByResourceCount = {};

    console.log("📊 Chart: Using Global UI_THEME");

    tasks.forEach(t => {
        const pid = t.project_id;
        let pname = projectMap[pid] || t._project || t.project_name || 'Uncategorized';
        projects.add(pname);
        tasksByProjectCount[pname] = (tasksByProjectCount[pname] || 0) + 1;
        const u = t._assigned || t.assigned_to || 'Unassigned';
        tasksByResourceCount[u] = (tasksByResourceCount[u] || 0) + 1;
        if (!groups[pname]) groups[pname] = {
            COMPLETED: 0, IN_PROGRESS: 0, PENDING: 0, BLOCKED: 0, ON_HOLD: 0
        };
        const rawStatus = (t.status || t.custom_class || '').toUpperCase();
        let s = 'PENDING';
        if (rawStatus.includes('COMPLET')) s = 'COMPLETED';
        else if (rawStatus.includes('IN_PROG') || rawStatus.includes('PROGRESS')) s = 'IN_PROGRESS';
        else if (rawStatus.includes('BLOCK')) s = 'BLOCKED';
        else if (rawStatus.includes('HOLD')) s = 'ON_HOLD';
        groups[pname][s]++;
    });

    const projectLabels = Array.from(projects);
    const textColor = THEME.current === 'dark' ? UI_THEME.palette.text_dark : UI_THEME.palette.text_light;
    const axisColor = THEME.current === 'dark' ? UI_THEME.palette.grid_dark : UI_THEME.palette.grid_light;

    if (ctx) {
        if (Chart.getChart('projectsChart')) Chart.getChart('projectsChart').destroy();
        const getData = (status) => projectLabels.map(p => groups[p][status] || 0);
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: projectLabels,
                datasets: [
                    createGlowDataset('Completed', getData('COMPLETED'), UI_THEME.palette.completed),
                    createGlowDataset('In Progress', getData('IN_PROGRESS'), UI_THEME.palette.in_progress),
                    createGlowDataset('Pending', getData('PENDING'), UI_THEME.palette.pending),
                    createGlowDataset('Blocked', getData('BLOCKED'), UI_THEME.palette.blocked),
                    createGlowDataset('On Hold', getData('ON_HOLD'), UI_THEME.palette.on_hold)
                ].map(d => ({ ...d, data: d.data.flat() }))
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { color: textColor } },
                    y: { stacked: true, display: true, ticks: { color: textColor, font: { family: 'Inter', weight: '600' } }, grid: { display: false } }
                },
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, color: textColor, font: { family: 'Inter' }, padding: 16 } },
                    tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', cornerRadius: 8, callbacks: { footer: (items) => `Total Tasks: ${items.reduce((a, b) => a + b.raw, 0)}` } }
                }
            }
        });
    }

    const donutPalette = [
        UI_THEME.palette.in_progress, UI_THEME.palette.completed, UI_THEME.palette.pending,
        UI_THEME.palette.blocked, UI_THEME.palette.accent_1, UI_THEME.palette.accent_2
    ];
    renderDonutClicky('projectDonutChart', 'Tasks', tasksByProjectCount, donutPalette, textColor);
    renderDonutClicky('resourceDonutChart', 'Tasks', tasksByResourceCount, donutPalette, textColor);
}

// 2. TEAM UTILIZATION
function renderUtilizationChart(tasks) {
    const ctx = document.getElementById('workloadChart');
    if (!ctx) return;
    if (Chart.getChart('workloadChart')) Chart.getChart('workloadChart').destroy();

    const groups = {};
    const resources = new Set();
    tasks.forEach(t => {
        const u = t._assigned || t.assigned_to || 'Unassigned';
        resources.add(u);
        if (!groups[u]) groups[u] = { COMPLETED: 0, IN_PROGRESS: 0, PENDING: 0, BLOCKED: 0, ON_HOLD: 0 };
        const rawStatus = (t.status || t.custom_class || '').toUpperCase();
        let s = 'PENDING';
        if (rawStatus.includes('COMPLET') || rawStatus.includes('DONE')) s = 'COMPLETED';
        else if (rawStatus.includes('IN_PROG') || rawStatus.includes('PROGRESS')) s = 'IN_PROGRESS';
        else if (rawStatus.includes('BLOCK')) s = 'BLOCKED';
        else if (rawStatus.includes('HOLD')) s = 'ON_HOLD';
        groups[u][s]++;
    });

    const labels = Array.from(resources);
    const textColor = THEME.current === 'dark' ? UI_THEME.palette.text_dark : UI_THEME.palette.text_light;
    const getDataForStatus = (status) => labels.map(r => groups[r][status] || 0);

    const datasets = [
        createGlowDataset('Completed', getDataForStatus('COMPLETED'), UI_THEME.palette.completed),
        createGlowDataset('In Progress', getDataForStatus('IN_PROGRESS'), UI_THEME.palette.in_progress),
        createGlowDataset('Pending', getDataForStatus('PENDING'), UI_THEME.palette.pending),
        createGlowDataset('Blocked', getDataForStatus('BLOCKED'), UI_THEME.palette.blocked),
        createGlowDataset('On Hold', getDataForStatus('ON_HOLD'), UI_THEME.palette.on_hold)
    ].map(d => ({ ...d, data: d.data.flat() }));

    new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, title: { display: true, text: 'Tasks', color: textColor }, grid: { display: false }, ticks: { color: textColor } },
                y: { stacked: true, grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', weight: '600' } } }
            },
            plugins: {
                legend: { display: true, position: 'bottom', labels: { usePointStyle: true, color: textColor } },
                tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', cornerRadius: 8, callbacks: { footer: (items) => `Total: ${items.reduce((a, b) => a + b.raw, 0)} Tasks` } }
            }
        }
    });
}

// 🔧 Helper: Create Glow Dataset
function createGlowDataset(label, valueOrArray, hexColor) {
    const data = Array.isArray(valueOrArray) ? valueOrArray : [valueOrArray];
    const colors = UI_THEME.utils.getColors(hexColor);
    return {
        label: label,
        data: data,
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderWidth: 2,
        borderRadius: 4,
        barPercentage: 0.5
    };
}

// 🔧 Helper: Generic Donut
function renderDonutClicky(id, label, dataObj, colorArray, textColor) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    if (Chart.getChart(id)) Chart.getChart(id).destroy();
    const keys = Object.keys(dataObj);
    const vals = Object.values(dataObj);
    const bgColors = keys.map((_, i) => UI_THEME.utils.getColors(colorArray[i % colorArray.length]).background);
    const borderColors = keys.map((_, i) => UI_THEME.utils.getColors(colorArray[i % colorArray.length]).border);
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: keys,
            datasets: [{ label: label, data: vals, backgroundColor: bgColors, borderColor: borderColors, borderWidth: 2, cutout: '70%' }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { usePointStyle: true, color: textColor, font: { family: 'Inter', size: 11 } } } }
        }
    });
}

// ==========================================
// 🎨 STYLES & FEATURES (INTEGRATED)
// ==========================================

// 📍 TODAY MARKER
function addTodayLine() {
    const svg = document.querySelector('#gantt-chart svg');
    if (!svg || !window.ganttInstance) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tasks = window.ganttInstance.tasks;
    if (!tasks.length) return;
    const start = new Date(Math.min(...tasks.map(t => new Date(t._start))));
    start.setHours(0, 0, 0, 0);
    const days = Math.floor((today - start) / 86400000);
    const x = days * window.ganttInstance.options.column_width;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x); line.setAttribute('y1', '0');
    line.setAttribute('x2', x); line.setAttribute('y2', svg.getAttribute('height'));
    line.setAttribute('stroke', UI_THEME.palette.blocked); // Use Theme Blocked (Red usually) for Marker
    line.setAttribute('stroke-width', '2'); line.setAttribute('stroke-dasharray', '5,5');
    line.setAttribute('opacity', '0.7');
    const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    anim.setAttribute('attributeName', 'opacity'); anim.setAttribute('values', '0.4;0.9;0.4');
    anim.setAttribute('dur', '2s'); anim.setAttribute('repeatCount', 'indefinite');
    line.appendChild(anim);
    svg.appendChild(line);
}

// ==========================================
// 🗺️ MINIMAPA (Robust v4.0 - Performance & HiDPI)
// ==========================================
function addMinimap() {
    const viewport = document.querySelector('.gantt-viewport-scrollable');
    const root = document.getElementById('gantt-chart');
    const svg = root?.querySelector('svg');

    // 1. Element Validation & Retry
    if (!viewport || !root || !svg) {
        console.warn('⚠️ Minimap: Required DOM elements not found. Retrying...');
        return;
    }

    if (viewport.scrollWidth === 0) {
        console.log('⏳ Minimap: Viewport not ready (scrollWidth=0), retrying in 200ms...');
        setTimeout(addMinimap, 200);
        return;
    }

    // 2. CLEANUP
    root.querySelectorAll('.gantt-minimap').forEach(m => m.remove());

    // 3. DOM CREATION (HiDPI Canvas)
    const map = document.createElement('div');
    map.className = 'gantt-minimap';
    map.style.cssText = `
        position: absolute; bottom: 25px; right: 25px;
        width: 220px; height: 50px;
        background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(255,255,255,0.1);
        border-radius: 10px; z-index: 1010; overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5); cursor: crosshair;
        backdrop-filter: blur(8px);
    `;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 220 * dpr;
    canvas.height = 50 * dpr;
    canvas.style.width = '220px';
    canvas.style.height = '50px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    canvas.style.opacity = '0.7';
    canvas.style.pointerEvents = 'none';

    const visor = document.createElement('div');
    visor.className = 'gantt-minimap-visor';
    visor.style.cssText = `
        position: absolute; top:0; left:0; height:100%;
        background: rgba(41, 121, 255, 0.15); border: 2px solid #2979ff;
        border-radius: 4px; pointer-events: none; z-index: 5;
        box-shadow: 0 0 10px rgba(41, 121, 255, 0.5);
    `;

    map.appendChild(canvas);
    map.appendChild(visor);
    root.appendChild(map);

    // 4. RENDER DATA (Filtered Tasks from Gantt Instance)
    const tasks = window.ganttInstance?.tasks || [];
    console.log('📊 Minimap: Renderizando', tasks.length, 'tareas');

    if (tasks.length > 0) {
        const times = tasks.map(t => [new Date(t._start).getTime(), new Date(t._end).getTime()]).flat().filter(t => !isNaN(t));
        const minT = Math.min(...times);
        const maxT = Math.max(...times);
        const range = maxT - minT || 1;

        tasks.forEach((t, i) => {
            const start = new Date(t._start).getTime();
            const end = new Date(t._end).getTime();
            const x = ((start - minT) / range) * 220;
            const w = ((end - start) / range) * 220;

            const statusClass = t.custom_class || '';
            let color = '#2979ff';
            if (statusClass.includes('completed')) color = '#00e676';
            else if (statusClass.includes('blocked')) color = '#ff1744';
            else if (statusClass.includes('pending')) color = '#ffc400';

            ctx.fillStyle = color;
            ctx.fillRect(x, (i % 12) * 4, Math.max(3, w), 3);
        });
    }

    // 5. INTERACTION LOGIC
    const updateScroll = (clientX) => {
        const rect = map.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const targetX = (viewport.scrollWidth * pct) - (viewport.clientWidth / 2);
        viewport.scrollTo({ left: targetX, behavior: 'smooth' }); // Smooth para click
    };

    const updateScrollInstant = (clientX) => {
        const rect = map.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const targetX = (viewport.scrollWidth * pct) - (viewport.clientWidth / 2);
        viewport.scrollTo({ left: targetX, behavior: 'auto' }); // Instant para drag
    };

    const updateVisor = throttle(() => {
        const tw = viewport.scrollWidth || 1;
        const vw = viewport.clientWidth || 1;
        const sl = viewport.scrollLeft;
        const vWidth = Math.max(20, (vw / tw) * 220); // Min 20px
        visor.style.width = `${vWidth}px`;
        visor.style.transform = `translateX(${(sl / tw) * 220}px)`;
    }, 16);

    // 6. EVENT BINDING
    viewport.addEventListener('scroll', updateVisor);
    window.addEventListener('resize', updateVisor);

    let isDragging = false;
    map.addEventListener('mousedown', (e) => {
        isDragging = true;
        map.style.cursor = 'grabbing';
        updateScroll(e.clientX);
        e.preventDefault();
    });

    const mMove = (e) => {
        if (!isDragging) return;
        updateScrollInstant(e.clientX);
    };
    const mUp = () => {
        isDragging = false;
        map.style.cursor = 'crosshair';
    };

    if (window._mmC) window._mmC();
    document.addEventListener('mousemove', mMove);
    document.addEventListener('mouseup', mUp);
    window._mmC = () => {
        document.removeEventListener('mousemove', mMove);
        document.removeEventListener('mouseup', mUp);
    };

    updateVisor();
    console.log('✅ Minimap inicializado');
}

// ⌨️ SHORTCUTS
function addShortcuts() {
    document.addEventListener('keydown', (e) => {
        const slider = document.getElementById('gantt-zoom-slider');
        if (!slider) return;
        if ((e.ctrlKey || e.metaKey) && e.key === '+') { e.preventDefault(); slider.value = Math.min(100, parseInt(slider.value) + 5); slider.dispatchEvent(new Event('input')); }
        else if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); slider.value = Math.max(1, parseInt(slider.value) - 5); slider.dispatchEvent(new Event('input')); }
        else if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); slider.value = 50; slider.dispatchEvent(new Event('input')); }
    });
}

// 🔗 HIGHLIGHT DEPENDENCIES
function highlightDeps(task) {
    const svg = document.querySelector('#gantt-chart svg');
    if (!svg) return;
    svg.querySelectorAll('.arrow').forEach(a => a.classList.remove('highlighted'));
    if (task.dependencies) {
        task.dependencies.split(',').forEach(depId => {
            const arrow = svg.querySelector(`.arrow[data-from="${depId.trim()}"][data-to="${task.id}"]`);
            if (arrow) arrow.classList.add('highlighted');
        });
    }
}

// 🔍 ZOOM
function applyZoom(val) {
    if (!window.ganttInstance) return;
    const cfg = ZOOM.getConfig(val);
    const lbl = document.getElementById('gantt-zoom-label');
    if (lbl) lbl.textContent = cfg.label;

    // Smooth Sync
    requestAnimationFrame(() => {
        window.ganttInstance.options.column_width = cfg.columnWidth;
        window.ganttInstance.options.step = cfg.step;
        if (window.ganttInstance.options.view_mode !== cfg.mode) {
            window.ganttInstance.change_view_mode(cfg.mode);
        }
        window.ganttInstance.refresh(window.ganttInstance.tasks);
        setTimeout(() => { syncVisuals(); addTodayLine(); }, 50);
    });
}

function initZoom() {
    const slider = document.getElementById('gantt-zoom-slider');
    if (!slider) return;
    slider.value = 50;
    const handle = debounce(e => applyZoom(e.target.value), 50);
    slider.addEventListener('input', e => handle(e));
}

// 📐 SYNC VISUALS (Fixed Sidebar Compliant)
// 📐 SYNC VISUALS (Fixed Sidebar Compliant)
function syncVisuals() {
    const viewport = document.querySelector('.gantt-viewport-scrollable');
    const target = document.getElementById('gantt-render-target');
    if (!viewport || !target) return;

    let svg = target.querySelector('svg');
    const body = target.querySelector('.gantt-body-container');
    if (body) svg = body.querySelector('svg') || svg;
    if (!svg) return;

    const hh = 75;
    const n = window.ganttInstance?.tasks.length || 0;

    // ✅ FIX CRÍTICO: No forzar ancho, permitir que el SVG dicte las dimensiones
    target.style.cssText = 'overflow:visible; height:auto; position:relative; width:auto;';

    // Forzar que el contenedor respete el ancho real del SVG
    const svgWidth = parseInt(svg.getAttribute('width') || 0);
    if (svgWidth > 0) {
        target.style.minWidth = svgWidth + 'px';
    }

    let hc = target.querySelector('.gantt-header-container');
    if (!hc) {
        hc = document.createElement('div');
        hc.className = 'gantt-header-container';
        target.insertBefore(hc, target.firstChild);
    }

    let bc = body;
    if (!bc) {
        bc = document.createElement('div');
        bc.className = 'gantt-body-container';
        target.appendChild(bc);
        bc.appendChild(svg);
    }

    hc.innerHTML = '';
    const hs = svg.cloneNode(true);
    hs.querySelectorAll('.bar-wrapper,.arrow-wrapper,.popup-wrapper').forEach(e => e.remove());
    hc.appendChild(hs);
    hc.style.cssText = `position:sticky; top:0; z-index:100; background:${THEME[THEME.current].bg}; height:${hh}px; min-width:100%; border-bottom:1px solid ${THEME[THEME.current].grid}; overflow:hidden;`;
    hs.style.cssText = `height:${hh}px; overflow:hidden;`;
    svg.style.cssText = `margin-top:-${hh}px; overflow:visible;`;

    const bh2 = svg.querySelector('.grid-header');
    if (bh2) bh2.style.display = 'none'; // Duplicate Header Hide

    if (!viewport.scrollLeft) viewport.scrollLeft = 500;

    console.log('✅ syncVisuals: ancho SVG respetado =', svgWidth);
}

// 🎨 STYLES
function injectStyles() {
    if (document.getElementById('gantt-premium')) return;
    const s = document.createElement('style');
    s.id = 'gantt-premium';
    s.innerHTML = `
        .gantt .bar-completed .bar { fill:${UI_THEME.palette.completed} !important; filter:drop-shadow(0 0 8px ${hexToRgba(UI_THEME.palette.completed, 0.4)}); }
        .gantt .bar-in-progress .bar { fill:${UI_THEME.palette.in_progress} !important; filter:drop-shadow(0 0 8px ${hexToRgba(UI_THEME.palette.in_progress, 0.4)}); }
        .gantt .bar-pending .bar { fill:${UI_THEME.palette.pending} !important; filter:drop-shadow(0 0 8px ${hexToRgba(UI_THEME.palette.pending, 0.4)}); }
        .gantt .bar-blocked .bar { fill:${UI_THEME.palette.blocked} !important; animation:pulse 2s infinite; }
        .gantt .bar-wrapper:hover .bar { opacity:0.9; stroke:#fff; stroke-width:2px; filter:drop-shadow(0 0 10px rgba(0,0,0,0.5)); }
        .gantt .arrow.highlighted { stroke:${UI_THEME.palette.accent_1} !important; stroke-width:3px !important; filter:drop-shadow(0 0 6px ${UI_THEME.palette.accent_1}); }
        .gantt .bar-label { display: none !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .gantt .upper-text { font-size:15px !important; font-weight:700 !important; fill:${UI_THEME.palette.text_light} !important; }
        .gantt .lower-text { font-size:12px !important; fill:${UI_THEME.palette.on_hold} !important; }
        /* Scrollbar */
        .gantt-viewport-scrollable::-webkit-scrollbar { height: 8px; width: 8px; }
        .gantt-viewport-scrollable::-webkit-scrollbar-thumb { background: ${UI_THEME.palette.grid_dark}; border-radius: 4px; }
    `;
    document.head.appendChild(s);
}

// 🎨 POPUP PREMIUM
function createPopup(task) {
    const start = new Date(task._start).toLocaleDateString();
    const end = new Date(task._end).toLocaleDateString();
    const days = Math.ceil((new Date(task._end) - new Date(task._start)) / 86400000);
    const color = resolveThemeColor(task.progress);

    return `<div style="background:linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98)); border:1px solid ${color}; border-radius:12px; padding:16px; min-width:280px; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
        <div style="border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:12px;">
            <div style="font-size:16px; font-weight:700; color:#f1f5f9; margin-bottom:6px;">${task.name}</div>
            <div style="display:flex; gap:8px;">
                <span style="font-size:10px; padding:2px 8px; background:${color}22; color:${color}; border-radius:4px; border:1px solid ${color}44;">${task._priority?.toUpperCase()}</span>
                ${task._assigned ? `<span style="font-size:11px; color:#94a3b8;">👤 ${task._assigned}</span>` : ''}
            </div>
        </div>
        <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="font-size:11px; color:#cbd5e1;">Progress</span>
                <span style="font-size:14px; font-weight:800; color:${color};">${task.progress}%</span>
            </div>
            <div style="background:rgba(255,255,255,0.1); border-radius:8px; height:6px; overflow:hidden;">
                <div style="width:${task.progress}%; height:100%; background:${color}; box-shadow:0 0 10px ${color}66;"></div>
            </div>
        </div>
        <div style="font-size:11px; display:grid; grid-template-columns:auto 1fr; gap:8px;">
            <span style="color:#94a3b8;">📅 Duration:</span><span style="color:#e2e8f0;">${days} days</span>
            <span style="color:#94a3b8;">🎯 End:</span><span style="color:#e2e8f0;">${end}</span>
            ${task._est ? `<span style="color:#94a3b8;">⏱️ Est:</span><span style="color:#e2e8f0;">${task._est}h</span>` : ''}
            ${task._act ? `<span style="color:#94a3b8;">✅ Act:</span><span style="color:#e2e8f0; ${task._act > task._est ? 'color:' + UI_THEME.palette.blocked + ';' : ''}">${task._act}h</span>` : ''}
        </div>
    </div>`;
}

// 📤 EXPORT
function exportGanttImage() {
    const svg = document.querySelector('#gantt-chart svg');
    if (!svg) return alert('No chart to export');
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gantt-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
}

// 🎛️ EXPORTS & HELPERS
function populateGanttFilters(tasks) {
    const ps = document.getElementById('gantt-filter-project');
    const rs = document.getElementById('gantt-filter-resource');
    if (!ps || !rs) return;

    const curP = ps.value, curR = rs.value;

    // Extracción robusta de IDs únicos
    const projects = [...new Set(tasks.map(t => t.project_id || 'Uncategorized'))];
    const resources = [...new Set(tasks.map(t => t.assigned_to || 'Unassigned'))];

    // Poblado de Project Selector
    ps.innerHTML = '<option value="ALL">All Projects</option>' +
        projects.sort().map(p => {
            const task = tasks.find(t => t.project_id === p);
            const label = task?.project_name || task?._project || p;
            return `<option value="${p}">${label}</option>`;
        }).join('');

    // Poblado de Resource Selector
    rs.innerHTML = '<option value="ALL">All Resources</option>' +
        resources.sort().map(r => `<option value="${r}">${r}</option>`).join('');

    // Restaurar selecciones si aún existen
    if (curP && ps.querySelector(`option[value="${curP}"]`)) ps.value = curP;
    if (curR && rs.querySelector(`option[value="${curR}"]`)) rs.value = curR;
}

function filterGanttData() { renderGanttChart(globalGanttData); }

window.renderGanttChart = renderGanttChart;
window.filterGanttData = filterGanttData;
window.renderProjectCharts = renderProjectCharts;
window.renderUtilizationChart = renderUtilizationChart;
window.exportGanttImage = exportGanttImage;
window.initZoom = initZoom;
