// src/lib/api.js
const API = import.meta.env.VITE_API_URL;

async function withToken(getAccessTokenSilently) {
  const token = await getAccessTokenSilently({
    authorizationParams: {
      audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      scope: "openid profile email",
    },
  });
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

async function handle(res) {
  let data;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export async function fetchMe(getAccessTokenSilently) {
  const opts = await withToken(getAccessTokenSilently);
  return handle(await fetch(`${API}/me`, opts));
}

export async function fetchOpenRequests(getAccessTokenSilently) {
  const opts = await withToken(getAccessTokenSilently);
  return handle(await fetch(`${API}/requests?status=open`, opts));
}

export async function createRequest(getAccessTokenSilently, payload) {
  const opts = await withToken(getAccessTokenSilently);
  return handle(
    await fetch(`${API}/requests`, {
      method: "POST",
      ...opts,
      body: JSON.stringify(payload),
    }),
  );
}

export async function acceptRequest(getAccessTokenSilently, id) {
  const opts = await withToken(getAccessTokenSilently);
  return handle(
    await fetch(`${API}/requests/${id}/accept`, {
      method: "POST",
      headers: opts.headers,
    }),
  );
}

export async function completeRequest(getAccessTokenSilently, id) {
  const opts = await withToken(getAccessTokenSilently);
  return handle(
    await fetch(`${API}/requests/${id}/complete`, {
      method: "POST",
      headers: opts.headers,
    }),
  );
}
