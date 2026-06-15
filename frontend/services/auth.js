const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const TOKEN_KEY = "token";
const USER_KEY = "auth_user";

function isBrowser() {
    return typeof window !== "undefined";
}

export async function loginUser({ email, password}){
    const res = await fetch(`${API_URL}/auth/login`,{
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Invalid credentials");
    }

    return res.json();
}

export async function googleLogin(credential) {
    const res = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Google login failed");
    }
    return res.json();
}

export async function signupUser({ email, password, name }) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Signup failed");
  }
  return res.json();
}

export function getToken(){
    if (!isBrowser()) return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        clearStoredAuth();
        return null;
    }
}

export function persistAuth(user) {
    if (!isBrowser()) return;
    if (user?.token) {
        localStorage.setItem(TOKEN_KEY, user.token);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function fetchSession(token = getToken()) {
    if (!token) throw new Error("Missing token");

    const res = await fetch(`${API_URL}/auth/session`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Session lookup failed");

    const data = await res.json();
    return { ...data, token };
}

export function clearStoredAuth() {
    if (!isBrowser()) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export async function logoutUser(token = getToken()) {
    if (token) {
        await fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
    }
    clearStoredAuth();
}

export async function refreshToken(token = getToken()) {
    if (!token) throw new Error("Missing token");
    const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Refresh failed");
    return res.json();
}
