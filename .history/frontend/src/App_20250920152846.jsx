// src/App.jsx
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

// your components (make sure the folder name matches your project: Components vs components)
import Hero from "./Components/Hero";
import HeaderBar from "./Components/HeaderBar";
import CreateRequest from "./Components/CreateRequest";
import RequestsSection from "./Components/RequestsSection";

// API helpers you already have
import {
  fetchMe,
  fetchOpenRequests,
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

  // Load data after login (and after SDK finishes loading)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let cancelled = false;

    (async () => {
      try {
        // warm token first (prevents “token not ready” races on refresh)
        await getAccessTokenSilently({
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        });

        const [meData, openL, accL, compL] = await Promise.all([
          fetchMe(getAccessTokenSilently),
          fetchByStatus("open"),
          fetchByStatus("accepted"),
          fetchByStatus("completed"),
        ]);

        if (!cancelled) {
          setMe(meData);
          setOpen(openL);
          setAccepted(accL);
          setCompleted(compL);
        }
      } catch (e) {
        console.error("Initial load failed:", e);
      }
    })();

    return () => {
      cancelled = true;
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
                setBusy(true);
                await acceptRequest(getAccessTokenSilently, id);
                // move item out of open and into accepted
                const [openL, accL] = await Promise.all([
                  fetchByStatus("open"),
                  fetchByStatus("accepted"),
                ]);
                setOpen(openL);
                setAccepted(accL);
                alert("Accepted! Join link added under the Accepted tab.");
                setTab("accepted");
              } catch (e) {
                console.error("Accept failed:", e);
                alert("Cannot accept this request (maybe already accepted).");
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
                alert("Cannot complete (must be in accepted state).");
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
