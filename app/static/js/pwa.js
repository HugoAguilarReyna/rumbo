// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('../sw.js') // Adjusted path relative to js folder
            .then(registration => {
                console.log('✅ ServiceWorker registered:', registration.scope);

                // Check for updates every hour
                setInterval(() => {
                    registration.update();
                }, 3600000);
            })
            .catch(error => {
                console.error('ServiceWorker registration failed:', error);
            });
    });
}

// Request notification permission
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('✅ Notification permission granted');
        }
    }
}

// Install prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show custom install button
    showInstallPromotion();
});

function showInstallPromotion() {
    const installBanner = document.createElement('div');
    installBanner.className = 'install-banner glass-card';
    installBanner.innerHTML = `
        <div class="install-content">
            <svg class="install-icon" viewBox="0 0 24 24" width="24" height="24">
                <path d="M4 16L4 17C4 18.6569 5.34315 20 7 20H17C18.6569 20 20 18.6569 20 17V16M16 12L12 16M12 16L8 12M12 16V4" 
                      stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
            <div>
                <strong>Install RUMBO</strong>
                <p>Access faster and work offline</p>
            </div>
        </div>
        <div class="install-actions">
            <button class="btn-secondary btn-sm" onclick="dismissInstall()">Not now</button>
            <button class="btn-primary btn-sm" onclick="installPWA()">Install</button>
        </div>
        <button class="install-close" onclick="dismissInstall()">×</button>
    `;

    document.body.appendChild(installBanner);

    setTimeout(() => {
        installBanner.classList.add('visible');
    }, 100);
}

async function installPWA() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`Install outcome: ${outcome}`);
    deferredPrompt = null;
    dismissInstall();
}

function dismissInstall() {
    const banner = document.querySelector('.install-banner');
    if (banner) {
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 300);
    }
}

// Check if installed
window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installed successfully');
    deferredPrompt = null;
});
