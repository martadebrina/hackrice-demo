// src/lib/api.js
const API = import.meta.env.VITE_API_URL;

export async function withToken(getAccessTokenSilently) {
  const token = await getAccessTokenSilently({
    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
  });
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

export async function fetchMe(getAccessTokenSilently) {
  const opts = await withToken(getAccessTokenSilently);
  const res = await fetch(`${API}/me`, opts);
  return res.json();
}

export async function fetchOpenRequests(getAccessTokenSilently) {
  const opts = await withToken(getAccessTokenSilently);
  const res = await fetch(`${API}/requests?status=open`, opts);
  return res.json();
}

export async function createRequest(getAccessTokenSilently, payload) {
  const opts = await withToken(getAccessTokenSilently);
  const res = await fetch(`${API}/requests`, {
    method: "POST",
    ...opts,
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function acceptRequest(getAccessTokenSilently, id) {
  const opts = await withToken(getAccessTokenSilently);
  const res = await fetch(`${API}/requests/${id}/accept`, {
    method: "POST",
    headers: opts.headers,
  });
  return res.json();
}

export async function completeRequest(getAccessTokenSilently, id) {
  const opts = await withToken(getAccessTokenSilently);
  const res = await fetch(`${API}/requests/${id}/complete`, {
    method: "POST",
    headers: opts.headers,
  });
  return res.json();
}
