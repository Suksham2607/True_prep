import axios from "axios";

// One shared axios instance for the whole app. Every page imports this
// instead of calling axios directly, so the base URL and auth handling
// only have to be set up once.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

// --- Token storage -----------------------------------------------------
// The backend gives us a JWT on login (see POST /api/auth/login). We keep
// it in localStorage so the user stays logged in across page refreshes,
// under one constant key so nothing else in the app has to remember the
// exact string.
const TOKEN_KEY = "trueprep_token";

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// --- Request interceptor ------------------------------------------------
// Attaches "Authorization: Bearer <token>" to every outgoing request
// automatically, so individual pages never have to set that header
// themselves when calling a protected route.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Response interceptor ------------------------------------------------
// If the backend ever says our token is invalid or expired (401), there's
// no point holding onto it - clear it and send the user back to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      clearToken();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
