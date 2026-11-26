import axios from 'axios';

const rawApiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
export const API_BASE =
    rawApiBase && !rawApiBase.includes(':5173')
        ? rawApiBase
        : 'http://localhost:5000';

const LEGACY_ACCESS_TOKEN_KEY = 'simpro_access_token';
const LEGACY_TOKEN_KEY = 'token';
const USER_KEY = 'user';

// Access token disimpan di memori JavaScript untuk mengurangi risiko XSS
let inMemoryAccessToken = null;
let refreshPromise = null;

export function getAccessToken() {
    return inMemoryAccessToken;
}

export function getStoredUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export function setAuthSession({ accessToken, token, user }) {
    const finalToken = accessToken || token;
    if (finalToken) {
        inMemoryAccessToken = finalToken;
    }
    if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
}

export function clearAuthSession() {
    inMemoryAccessToken = null;
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

const apiClient = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
});

const refreshClient = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, newToken = null) {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(newToken);
        }
    });
    failedQueue = [];
}

function redirectToLogin() {
    clearAuthSession();
    if (window.location.pathname !== '/login') {
        window.location.replace('/login');
    }
}

apiClient.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error?.config;
        const status = error?.response?.status;

        if (!originalRequest || status !== 401) {
            return Promise.reject(error);
        }

        const reqUrl = String(originalRequest.url || '');
        const isAuthEndpoint =
            reqUrl.includes('/api/auth/login') ||
            reqUrl.includes('/api/auth/register') ||
            reqUrl.includes('/api/auth/refresh') ||
            reqUrl.includes('/api/auth/logout');

        if (isAuthEndpoint || originalRequest._retry) {
            if (reqUrl.includes('/api/auth/refresh') && !getStoredUser()) {
                redirectToLogin();
            }
            return Promise.reject(error);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({
                    resolve: (newToken) => {
                        originalRequest.headers = originalRequest.headers || {};
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        resolve(apiClient(originalRequest));
                    },
                    reject,
                });
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
            const { accessToken: newAccessToken } = await refreshAccessToken();

            processQueue(null, newAccessToken);

            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return apiClient(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError, null);
            if (!getStoredUser()) {
                redirectToLogin();
            }
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export async function refreshAccessToken() {
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = (async () => {
        const res = await refreshClient.post('/api/auth/refresh');
        const newAccessToken = res.data?.accessToken || res.data?.token;
        if (!newAccessToken) {
            throw new Error('Gagal memperbarui Access Token');
        }
        const nextUser = res.data?.user || getStoredUser();
        setAuthSession({
            accessToken: newAccessToken,
            user: nextUser,
        });
        return {
            accessToken: newAccessToken,
            user: nextUser,
        };
    })();

    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

export async function logoutRequest() {
    try {
        await apiClient.post('/api/auth/logout');
    } finally {
        clearAuthSession();
    }
}

export default apiClient;