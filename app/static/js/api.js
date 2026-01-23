const API_BASE = '/api';

class ApiClient {
    static async request(endpoint, options = {}) {
        const token = localStorage.getItem('access_token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };

        // If body is FormData, delete Content-Type to let browser set boundary
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }

        const config = {
            ...options,
            headers,
            credentials: 'include' // Mission Requirement: Standarize with project session logic
        };

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);

            if (response.status === 401) {
                // Try refresh
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    // Retry original request
                    config.headers['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
                    return fetch(`${API_BASE}${endpoint}`, config);
                } else {
                    window.location.href = '/static/pages/login.html';
                    throw new Error('Unauthorized');
                }
            }

            return response;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async refreshToken() {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) return false;

        try {
            const response = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('access_token', data.access_token);
                return true;
            }
        } catch (e) {
            console.error('Refresh failed', e);
        }

        localStorage.clear();
        return false;
    }

    static async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: data instanceof FormData ? data : JSON.stringify(data)
        });
    }
}
