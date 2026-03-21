class PremiumNavigation {
    constructor() {
        this.init();
    }

    init() {
        this.createNavbar();
        this.setupUserMenu();
        this.setupDataMgmtMenu();
        this.setupNotifications();
        this.setupSpaNavigation();
    }

    createNavbar() {
        if (document.querySelector('.premium-navbar')) return;

        const navbar = document.createElement('nav');
        navbar.className = 'premium-navbar';

        // Determine active page
        const path = window.location.pathname;
        const isActive = (p) => path.includes(p) ? 'active' : '';

        navbar.innerHTML = `
            <div class="navbar-container">
                <!-- Logo Section -->
                <div class="navbar-brand">
                    <div class="logo-wrapper">
                        <span class="logo-text">RUMBO</span>
                    </div>
                </div>

                <!-- Navigation Links (Placeholder) -->
                <div class="nav-links" style="display: none; gap: 1.5rem; margin-right: auto; margin-left: 2rem;">
                </div>
                
                <!-- Right Actions -->
                <div class="navbar-actions" style="margin-left: auto;">
                    
                    <div class="notifications-menu">
                        <button class="action-btn" id="notifications-btn">
                            <svg viewBox="0 0 24 24">
                                <path d="M15 17H20L18.5951 15.5951C18.2141 15.2141 18 14.6973 18 14.1585V11C18 8.38757 16.3304 6.16509 14 5.34142V5C14 3.89543 13.1046 3 12 3C10.8954 3 10 3.89543 10 5V5.34142C7.66962 6.16509 6 8.38757 6 11V14.1585C6 14.6973 5.78595 15.2141 5.40493 15.5951L4 17H9M15 17V18C15 19.6569 13.6569 21 12 21C10.3431 21 9 19.6569 9 18V17M15 17H9" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            <span class="notification-badge" id="notif-count" style="display: none;">0</span>
                        </button>
                        <div class="user-dropdown hidden" id="notifications-dropdown" style="right: 100px; width: 320px;">
                            <div class="dropdown-header flex justify-between items-center px-4 py-2 border-b bg-gray-50 dark:bg-gray-800">
                                <span class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Notificaciones</span>
                                <button class="text-[10px] text-blue-500 hover:text-blue-700 font-bold uppercase" onclick="window.premiumNav.markAllNotificationsRead(event)">Marcar todas como leídas</button>
                            </div>
                            <div id="notifications-list" class="max-h-[400px] overflow-y-auto">
                                <div class="p-4 text-center text-gray-500 text-xs italic">Cargando...</div>
                            </div>
                        </div>
                    </div>
                    
                    
                    <div class="data-mgmt-menu">
                        <button class="action-btn" id="data-mgmt-btn" title="Gestión de Datos">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        </button>
                        <div class="user-dropdown hidden" id="data-mgmt-dropdown" style="right: 50px; width: 280px;">
                            <div class="dropdown-header">GESTIÓN DE DATOS</div>
                            
                            <!-- Cargar CSV -->
                            <div class="p-3 pb-0">
                                <div class="text-xs font-bold text-gray-500 uppercase mb-2">Cargar CSV</div>
                                <a href="/static/project_tasks_template.csv" class="dropdown-item text-primary text-xs mb-2" download>
                                    <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    Descargar Plantilla
                                </a>
                                <input type="file" id="csv-upload-input" accept=".csv" class="hidden" 
                                       onchange="const f = this.files[0]; document.getElementById('file-name-nav').textContent = f?.name || 'Seleccionar Archivo'; const b = document.getElementById('btn-cargar-csv'); b.disabled = !f; b.style.opacity = f ? '1' : '0.5'; b.style.backgroundColor = f ? '#2563eb' : '#6c757d'; b.style.cursor = f ? 'pointer' : 'not-allowed';">
                                <button onclick="document.getElementById('csv-upload-input').click()" 
                                        class="premium-input text-xs mb-2 flex justify-between items-center w-full h-8 px-2 cursor-pointer">
                                    <span id="file-name-nav" class="truncate" style="max-width: 150px;">Seleccionar Archivo</span>
                                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-gray-400"><path d="M12 4v16m8-8H4" stroke="currentColor" stroke-width="2"/></svg>
                                </button>
                                <button id="btn-cargar-csv" disabled onclick="uploadCSV()" style="opacity: 0.5; background-color: #6c757d; cursor: not-allowed;" class="action-btn w-full justify-center text-white h-8 text-xs">Cargar</button>
                            </div>

                            <div class="dropdown-divider my-2"></div>
                            
                            <!-- Acciones -->
                            <div class="p-3 py-0">
                                <div class="text-xs font-bold text-gray-500 uppercase mb-2">Acciones</div>
                                <a href="javascript:void(0)" onclick="refreshDashboard()" class="dropdown-item">
                                    <svg viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" stroke-width="2"/></svg>
                                    Actualizar Datos
                                </a>
                                <a href="javascript:void(0)" onclick="exportReport()" class="dropdown-item">
                                    <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="2"/></svg>
                                    Exportar Reporte
                                </a>
                            </div>

                            <div class="dropdown-divider my-2"></div>

                            <!-- Administración -->
                            <div class="p-3 py-0">
                                <div class="text-xs font-bold text-gray-500 uppercase mb-2">Administración</div>
                                <a href="javascript:void(0)" onclick="const m = new bootstrap.Modal(document.getElementById('managementModal')); m.show();" class="dropdown-item">
                                    <svg viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><circle cx="15" cy="15" r="3"></circle></svg>
                                    Proyectos y Usuarios
                                </a>
                            </div>

                            <div class="dropdown-divider my-2"></div>

                            <!-- Reporte -->
                            <div class="p-3 pt-0">
                                <div class="text-xs font-bold text-gray-500 uppercase mb-2">Reporte</div>
                                <a href="javascript:void(0)" onclick="generatePDF()" class="dropdown-item text-success">
                                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2"/></svg>
                                    Generar PDF
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="user-menu">
                        <button class="user-avatar" id="user-menu-btn">
                            <img src="https://ui-avatars.com/api/?name=User&background=random" alt="User">
                            <span class="status-indicator online"></span>
                        </button>
                        <div class="user-dropdown hidden" id="user-dropdown">
                             <div class="dropdown-header">
                                <div class="user-info">
                                    <span class="user-name" id="nav-user-name">User</span>
                                    <span class="user-email" id="nav-user-email">user@example.com</span>
                                </div>
                            </div>
                            <div class="dropdown-divider"></div>
                             <a href="javascript:void(0)" class="dropdown-item text-danger" onclick="logout()">
                                <svg viewBox="0 0 24 24"><path d="M17 16L21 12M21 12L17 8M21 12H7M13 16V17C13 18.6569 11.6569 20 10 20H6C4.34315 20 3 18.6569 3 17V7C3 5.34315 4.34315 4 6 4H10C11.6569 4 13 5.34315 13 7V8" stroke="currentColor" stroke-width="2"/></svg>
                                Logout
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertBefore(navbar, document.body.firstChild);
        this.populateUser();
    }

    populateUser() {
        const token = localStorage.getItem('access_token');
        if (token) {
            const savedUser = localStorage.getItem('user_info');
            if (savedUser) {
                try {
                    const u = JSON.parse(savedUser);
                    const nameEl = document.getElementById('nav-user-name');
                    const emailEl = document.getElementById('nav-user-email');
                    if (nameEl) nameEl.textContent = u.username || 'User';
                    if (emailEl) emailEl.textContent = u.email || '';

                    // Update avatar if we have a name
                    const avatar = document.querySelector('.user-avatar img');
                    if (avatar) {
                        avatar.src = `https://ui-avatars.com/api/?name=${u.username || 'User'}&background=random&color=fff`;
                    }
                } catch (e) { }
            }
        }
    }


    setupNotifications() {
        const btn = document.getElementById('notifications-btn');
        const dropdown = document.getElementById('notifications-dropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const isOpening = dropdown.classList.contains('hidden');

            // Close other dropdowns
            document.querySelectorAll('.user-dropdown').forEach(el => {
                if (el !== dropdown) el.classList.add('hidden');
            });

            dropdown.classList.toggle('hidden');

            if (isOpening) {
                await this.loadNotifications();
            }
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        // Periodically update badge
        this.updateNotificationBadge();
        setInterval(() => this.updateNotificationBadge(), 60000);
    }

    async updateNotificationBadge() {
        try {
            const resp = await ApiClient.get('/notifications/?unread_only=true');
            if (resp.ok) {
                const data = await resp.json();
                const badge = document.getElementById('notif-count');
                if (badge) {
                    badge.textContent = data.length;
                    badge.style.display = data.length > 0 ? 'flex' : 'none';
                }
            }
        } catch (e) { }
    }

    async loadNotifications() {
        const list = document.getElementById('notifications-list');
        if (!list) return;

        try {
            const resp = await ApiClient.get('/notifications/');
            if (resp.ok) {
                const data = await resp.json();
                if (data.length === 0) {
                    list.innerHTML = '<div class="p-6 text-center text-gray-400 text-xs italic">No hay notificaciones pendientes.</div>';
                    return;
                }

                list.innerHTML = data.map(n => `
                    <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${n.read ? 'opacity-60' : 'bg-blue-50/10'}" 
                         onclick="window.premiumNav.markAsRead('${n._id}')">
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-bold ${n.read ? 'text-gray-600' : 'text-blue-600'}">${n.title || 'Notificación'}</span>
                            <span class="text-xs text-gray-500">${n.message}</span>
                            <span class="text-[10px] text-gray-400 mt-1">${new Date(n.created_at).toLocaleTimeString()} - ${new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            list.innerHTML = '<div class="p-6 text-center text-red-400 text-xs italic">Error al cargar notificaciones.</div>';
        }
    }

    async markAsRead(id) {
        try {
            const resp = await ApiClient.patch(`/notifications/${id}/read`);
            if (resp.ok) {
                await this.loadNotifications();
                await this.updateNotificationBadge();
            }
        } catch (e) { }
    }

    async markAllNotificationsRead(e) {
        if (e) e.stopPropagation();
        try {
            const resp = await ApiClient.post('/notifications/mark-all-read');
            if (resp.ok) {
                await this.loadNotifications();
                await this.updateNotificationBadge();
            }
        } catch (e) { }
    }

    setupUserMenu() {
        const btn = document.getElementById('user-menu-btn');
        const dropdown = document.getElementById('user-dropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    setupDataMgmtMenu() {
        const btn = document.getElementById('data-mgmt-btn');
        const dropdown = document.getElementById('data-mgmt-dropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other dropdowns
            document.querySelectorAll('.user-dropdown').forEach(el => {
                if (el !== dropdown) el.classList.add('hidden');
            });
            dropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }


    setupSpaNavigation() {
        // Initial load
        const hash = window.location.hash || '#overview';
        this.activateTab(hash);
        this.updateActiveNavLink(hash);

        // Handle clicks
        document.body.addEventListener('click', (e) => {
            const link = e.target.closest('a.nav-item');
            if (link) {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
                        this.activateTab(href);
                        history.pushState(null, null, href);
                        this.updateActiveNavLink(href);
                    } else {
                        window.location.href = `index.html${href}`;
                    }
                }
            }
        });

        // Back button support
        window.addEventListener('popstate', () => {
            this.activateTab(window.location.hash || '#overview');
        });
    }

    activateTab(hash) {
        const targetId = hash.substring(1);
        const id = (targetId === '' || targetId === 'overview') ? 'overview' : targetId;

        const tabBtn = document.querySelector(`button[data-bs-target="#${id}"]`);
        if (tabBtn) {
            const tab = new bootstrap.Tab(tabBtn);
            tab.show();
        }
    }

    updateActiveNavLink(hash) {
        const targetHash = (!hash || hash === '#') ? '#overview' : hash;
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('text-primary', 'font-bold');
            el.classList.add('text-gray-500', 'hover:text-gray-900', 'dark:text-gray-400', 'dark:hover:text-white');
            if (el.getAttribute('href') === targetHash) {
                el.classList.add('text-primary', 'font-bold');
                el.classList.remove('text-gray-500', 'hover:text-gray-900', 'dark:text-gray-400', 'dark:hover:text-white');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.premiumNav = new PremiumNavigation();
});

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    window.location.href = '/static/pages/login.html';
}
