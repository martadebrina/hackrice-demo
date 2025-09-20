// src/lib/api.js
const API = import.meta.env.VITE_API_URL;

async function token(getAccessTokenSilently) {
  return getAccessTokenSilently({
    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
  });
}

async function apiFetch(getAccessTokenSilently, url, options = {}, retry = true) {
  const t = await token(getAccessTokenSilently);
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (res.ok) return res.json();

  // if 401 once, try forcing a new token and retry once
  if (retry && res.status === 401) {
    return apiFetch(getAccessTokenSilently, url, options, false);
  }

  let detail = "";
  try { const j = await res.json(); detail = j.detail || JSON.stringify(j); } catch {}
  const err = new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
  err.status = res.status; err.detail = detail;
  throw err;
}

export async function fetchMe(getAccessTokenSilently) {
  return apiFetch(getAccessTokenSilently, "/me");
}
export async function fetchOpenRequests(getAccessTokenSilently) {
  return apiFetch(getAccessTokenSilently, "/requests?status=open");
}
export async function fetchByStatus(getAccessTokenSilently, status) {
  return apiFetch(getAccessTokenSilently, `/requests?status=${status}`);
}
export async function createRequest(getAccessTokenSilently, payload) {
  return apiFetch(getAccessTokenSilently, "/requests", { method: "POST", body: JSON.stringify(payload) });
}
export async function acceptRequest(getAccessTokenSilently, id) {
  return apiFetch(getAccessTokenSilently, `/requests/${id}/accept`, { method: "POST" });
}
export async function completeRequest(getAccessTokenSilently, id) {
  return apiFetch(getAccessTokenSilently, `/requests/${id}/complete`, { method: "POST" });
}
