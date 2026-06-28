// Base URL for the backend. In dev this is your local server;
// once deployed, set VITE_API_URL in a .env file to the live backend URL.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new Error(message);
  }

  // DELETE returns 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getTrades: () => request("/trades"),

  createTrade: (trade) =>
    request("/trades", {
      method: "POST",
      body: JSON.stringify(trade),
    }),

  importTrades: (trades) =>
    request("/trades/import", {
      method: "POST",
      body: JSON.stringify({ trades }),
    }),

  updateTrade: (id, updates) =>
    request(`/trades/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  deleteTrade: (id) =>
    request(`/trades/${id}`, {
      method: "DELETE",
    }),

  checkHealth: () => request("/health"),
};
