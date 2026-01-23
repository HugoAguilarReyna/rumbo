class PremiumNavigation {
    constructor() {
        this.init();
    }

    init() {
        this.createNavbar();
        this.setupDarkModeToggle();
        this.setupUserMenu();
        this.setupSearch();
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
                        <svg class="logo-icon" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2"/>
                            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
                            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span class="logo-text">🚀 ProjectHub</span>
                    </div>
                </div>

                <!-- Navigation Links -->
                <div class="nav-links" style="display: none; gap: 1.5rem; margin-right: auto; margin-left: 2rem;">
                </div>
                
                <!-- Search Bar -->
                <div class="navbar-search" style="flex: 0 1 300px;">
                    <div class="search-wrapper">
                        <svg class="search-icon" viewBox="0 0 24 24">
                            <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <input type="text" 
                               id="global-search" 
                               placeholder="Search... (Ctrl+K)"
                               class="search-input"
                               autocomplete="off">
                        <kbd class="search-kbd">⌘K</kbd>
                    </div>
                </div>
                
                <!-- Right Actions -->
                <div class="navbar-actions">
                    <button class="action-btn" id="quick-add" title="Quick Add (Ctrl+N)" onclick="const modal = new bootstrap.Modal(document.getElementById('addTaskModal')); modal.show();">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    
                    <button class="action-btn" id="notifications-btn">
                        <svg viewBox="0 0 24 24">
                            <path d="M15 17H20L18.5951 15.5951C18.2141 15.2141 18 14.6973 18 14.1585V11C18 8.38757 16.3304 6.16509 14 5.34142V5C14 3.89543 13.1046 3 12 3C10.8954 3 10 3.89543 10 5V5.34142C7.66962 6.16509 6 8.38757 6 11V14.1585C6 14.6973 5.78595 15.2141 5.40493 15.5951L4 17H9M15 17V18C15 19.6569 13.6569 21 12 21C10.3431 21 9 19.6569 9 18V17M15 17H9" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span class="notification-badge" id="notif-count">3</span>
                    </button>
                    
                    <button class="action-btn" id="theme-toggle" title="Toggle Theme">
                        <svg class="sun-icon" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
                            <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <svg class="moon-icon hidden" viewBox="0 0 24 24">
                            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    
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

    setupDarkModeToggle() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        const sunIcon = toggle.querySelector('.sun-icon');
        const moonIcon = toggle.querySelector('.moon-icon');

        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');

        document.documentElement.setAttribute('data-theme', currentTheme);

        if (currentTheme === 'dark') {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }

        toggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);

            sunIcon.classList.toggle('hidden');
            moonIcon.classList.toggle('hidden');
        });
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

    setupSearch() {
        const searchInput = document.getElementById('global-search');
        if (!searchInput) return;

        // Ctrl + K Focus
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
        });

        // Basic Search Action
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            console.log('🔍 Global Search:', query);
            // Future implementation: real-time filtering
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
    new PremiumNavigation();
});

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    window.location.href = '/static/pages/login.html';
}
