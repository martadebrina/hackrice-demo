// src/App.jsx
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

// your components (make sure the folder name matches your project: Components vs components)
import Hero from "./Components/Hero/Hero";
import HeaderBar from "./Components/HeaderBar";
import CreateRequest from "./Components/CreateRequest";
import RequestsSection from "./Components/RequestsSection";

// API helpers you already have
import {
  fetchMe,
  createRequest,
  acceptRequest,
  completeRequest,
} from "./lib/api";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const {
    isAuthenticated,
    loginWithRedirect,
    logout,
    user,
    getAccessTokenSilently,
    isLoading,
    error,
  } = useAuth0();

  const [me, setMe] = useState(null);
  const [open, setOpen] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [tab, setTab] = useState("open");
  const [busy, setBusy] = useState(false);

  // 🔎 Debug log – helps us see auth state in DevTools
  useEffect(() => {
    console.log("Auth0 state:", { isLoading, isAuthenticated, user, error });
  }, [isLoading, isAuthenticated, user, error]);

  // helper to fetch by status
  async function fetchByStatus(status, mine = false) {
    const token = await getAccessTokenSilently({
      audience: import.meta.env.VITE_AUTH0_AUDIENCE,
    });
    const url = `${API}/requests?status=${status}${mine ? "&mine=1" : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  }

  async function refetchAll() {
    const [meData, openL, accL, compL] = await Promise.all([
      fetchMe(getAccessTokenSilently),
      fetchByStatus("open"),
      fetchByStatus("accepted"),
      fetchByStatus("completed"),
    ]);
    setMe(meData);
    setOpen(openL);
    setAccepted(accL);
    setCompleted(compL);
  }

  // Load data after login (and after SDK finishes loading)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let es;
    let cancelled = false;

    (async () => {
      try {
        // Get a token to pass as query param (EventSource can't send headers)
        const token = await getAccessTokenSilently({
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        });

        es = new EventSource(
          `${API}/events?access_token=${encodeURIComponent(token)}`,
        );

        es.onmessage = async (e) => {
          if (cancelled) return;
          if (!e.data) return;
          try {
            const evt = JSON.parse(e.data);
            // React only to interesting events
            if (
              evt?.type === "request:created" ||
              evt?.type === "request:accepted" ||
              evt?.type === "request:completed" ||
              evt?.type === "user:points_changed"
            ) {
              await refetchAll();
            }
          } catch {
            // some events (like hello/ping) might be "{}"
          }
        };

        es.onerror = (err) => {
          // Let the browser auto-reconnect; just log it
          console.warn("SSE error:", err);
        };
      } catch {
        console.error("Failed to start SSE:");
      }
    })();

    return () => {
      cancelled = true;
      if (es) es.close();
    };
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

  if (isLoading) {
    return (
      <div
        style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui" }}
      >
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Hero onLogin={() => loginWithRedirect()} />;
  }

  return (
    <div>
      <HeaderBar
        name={user?.name}
        points={me?.points}
        onLogout={() => logout({ returnTo: window.location.origin })}
      />

      {/* Create new request (disabled while busy) */}
      <CreateRequest
        onSubmit={async (payload) => {
          try {
            setBusy(true);
            if (!me) {
              const meData = await fetchMe(getAccessTokenSilently);
              setMe(meData);
            }
            await createRequest(getAccessTokenSilently, payload);
            setOpen(await fetchByStatus("open"));
          } catch (e) {
            console.error("Create failed:", e);
            alert("Could not create request. Check console for details.");
          } finally {
            setBusy(false);
          }
        }}
      />

      {/* Tabs */}
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
          {["open", "accepted", "completed"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #222",
                background: tab === t ? "#111" : "transparent",
                color: tab === t ? "#fff" : "#111",
                cursor: "pointer",
              }}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button
            onClick={async () => {
              try {
                setBusy(true);
                await refetchAll();
              } catch (e) {
                console.error("Refresh failed:", e);
              } finally {
                setBusy(false);
              }
            }}
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #222",
              background: "transparent",
              color: "#111",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {/* Open tab */}
        {tab === "open" && (
          <RequestsSection
            items={open}
            onAccept={async (id) => {
              try {
                const item = open.find((x) => x._id === id);
                if (me && item && item.studentId === me._id) {
                  alert("You can’t accept your own request.");
                  return;
                }

                setBusy(true);
                await acceptRequest(getAccessTokenSilently, id);

                const [openL, accL] = await Promise.all([
                  fetchByStatus("open"),
                  fetchByStatus("accepted", true), // if you added mine=1 earlier
                ]);
                setOpen(openL);
                setAccepted(accL);
                alert("Accepted! Join link added under the Accepted tab.");
                setTab("accepted");
              } catch (e) {
                console.error("Accept failed:", e);
                alert(e?.message || "Cannot accept this request.");
              } finally {
                setBusy(false);
              }
            }}
            onComplete={() => {}}
            disabled={busy}
          />
        )}

        {/* Accepted tab */}
        {tab === "accepted" && (
          <RequestsSection
            items={accepted}
            onAccept={() => {}}
            onComplete={async (id) => {
              try {
                setBusy(true);
                const data = await completeRequest(getAccessTokenSilently, id);

                // optimistic UI using server's fresh number
                if (data?.callerPoints != null) {
                  setMe((m) => (m ? { ...m, points: data.callerPoints } : m));
                }

                // then re-fetch lists (and me as you already do)
                const [accL, compL, meData] = await Promise.all([
                  fetchByStatus("accepted"),
                  fetchByStatus("completed"),
                  fetchMe(getAccessTokenSilently),
                ]);
                setAccepted(accL);
                setCompleted(compL);
                setMe(meData);

                alert("Completed! Points transferred.");
                setTab("completed");
              } catch (e) {
                console.error("Complete failed:", e);
                alert("Cannot complete.");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          />
        )}

        {/* Completed tab */}
        {tab === "completed" && (
          <RequestsSection
            items={completed}
            onAccept={() => {}}
            onComplete={() => {}}
            disabled={busy}
          />
        )}
      </div>
    </div>
  );
}
