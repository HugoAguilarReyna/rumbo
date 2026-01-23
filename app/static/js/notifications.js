
// ----------------------------------------------------
// NOTIFICATION LOGIC
// ----------------------------------------------------

async function loadNotifications() {
    try {
        const response = await ApiClient.get('/notifications?unread_only=true');
        if (response.ok) {
            const notifications = await response.json();
            const badge = document.getElementById('notification-count');
            if (badge) {
                badge.innerText = notifications.length;
                badge.style.display = notifications.length > 0 ? 'inline-block' : 'none';
            }
        }
    } catch (e) { console.error('Notif Load Error', e); }
}

// Initial load invoked by dashboard.js or DOMContentLoaded
document.getElementById('notification-bell')?.addEventListener('click', async () => {
    const dropdown = document.getElementById('notification-dropdown');
    // It's a bootstrap dropdown, but we need to populate it content on click
    dropdown.innerHTML = '<div class="p-3 text-center text-muted">Loading...</div>';

    try {
        const response = await ApiClient.get('/notifications');
        if (response.ok) {
            const notifications = await response.json();
            dropdown.innerHTML = `
                <div class="d-flex justify-content-between p-2 border-bottom align-items-center bg-light">
                    <h6 class="mb-0 small fw-bold text-uppercase">Notifications</h6>
                    <button class="btn btn-sm btn-link p-0 text-decoration-none" onclick="markAllRead()" style="font-size:12px;">Mark all read</button>
                </div>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${notifications.length === 0 ? '<div class="p-3 text-center small text-muted">No notifications</div>' : ''}
                    ${notifications.map(n => `
                        <div class="notification-item p-2 border-bottom ${n.read ? 'bg-white opacity-75' : 'bg-highlight'}" onclick="readNotif('${n._id}', '${n.link || ''}')">
                            <div class="d-flex w-100 justify-content-between">
                                <small class="fw-bold d-block text-dark">${n.title}</small>
                                <small class="text-muted" style="font-size:10px;">${timeAgo(n.created_at)}</small>
                            </div>
                            <small class="text-secondary d-block lh-sm mt-1">${n.message}</small>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (e) {
        dropdown.innerHTML = '<div class="p-3 text-danger">Error loading notifications</div>';
    }
});

async function markAllRead() {
    try {
        await ApiClient.post('/notifications/mark-all-read');
        loadNotifications(); // Update badge
        // Reload dropdown usually requires re-opening, but we can verify
    } catch (e) { }
}

async function readNotif(id, link) {
    try {
        await ApiClient.patch(`/notifications/${id}/read`);
        loadNotifications();
        if (link && link !== 'null' && link !== 'undefined') {
            // If link is internal hash or path
            window.location.href = link;
        }
    } catch (e) { }
}
