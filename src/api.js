// Base URL for the backend. In dev this is your local server;
// once deployed, set VITE_API_URL in a .env file to the live backend URL.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const TOKEN_KEY = "ledger_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Thrown specifically on 401s so the UI can distinguish "you're logged out"
// from a generic failure, and react accordingly (e.g. show the login modal).
export class AuthError extends Error {}

async function request(path, options = {}, { auth = false } = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response wasn't JSON, keep the generic message
    }
    if (res.status === 401) {
      clearToken();
      throw new AuthError(message);
    }
    throw new Error(message);
  }

  // DELETE returns 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getTrades: () => request("/trades"),

  login: (password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  createTrade: (trade) =>
    request(
      "/trades",
      { method: "POST", body: JSON.stringify(trade) },
      { auth: true }
    ),

  importTrades: (trades) =>
    request(
      "/trades/import",
      { method: "POST", body: JSON.stringify({ trades }) },
      { auth: true }
    ),

  updateTrade: (id, updates) =>
    request(
      `/trades/${id}`,
      { method: "PUT", body: JSON.stringify(updates) },
      { auth: true }
    ),

  deleteTrade: (id) =>
    request(`/trades/${id}`, { method: "DELETE" }, { auth: true }),

  checkHealth: () => request("/health"),
};

