function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/static/pages/login.html';
        return false;
    }
    return true;
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '/static/pages/login.html';
}

function getUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
    return null;
}

function displayUserInfo() {
    const user = getUser();
    if (user && document.getElementById('user-name')) {
        document.getElementById('user-name').textContent = user.username;
        // Admin link or other logic
    }
}
