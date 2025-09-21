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

export async function createRequest(getToken, payload) {
  const token = await getToken({ audience: import.meta.env.VITE_AUTH0_AUDIENCE });
  const res = await fetch(`${import.meta.env.VITE_API_URL}/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      course: payload.course,
      topic: payload.topic,
      description: payload.description ?? "",   // <— ensure it's sent
      pointsOffered: payload.pointsOffered,
    }),
  });
  if (!res.ok) throw new Error("Create failed");
  return res.json();
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

