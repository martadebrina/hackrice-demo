// src/App.jsx
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

// ⬇️ your components (capital C to match your folder)
import Hero from "./Components/Hero";
import HeaderBar from "./Components/HeaderBar";
import CreateRequest from "./Components/CreateRequest";
import RequestsSection from "./Components/RequestsSection";

// ⬇️ API helpers
import {
  fetchMe,
  fetchOpenRequests,
  fetchByStatus,
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

  // (Optional) Debug auth state in the console
  useEffect(() => {
    // console.log("Auth0:", { isLoading, isAuthenticated, user, error });
  }, [isLoading, isAuthenticated, user, error]);

  // Helper: fetch list by status
  async function loadByStatus(status) {
    return fetchByStatus(getAccessTokenSilently, status);
  }

  // Initial load after login (and after SDK finishes)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let cancelled = false;

    (async () => {
      try {
        // Warm token to avoid race on hard refresh
        await getAccessTokenSilently({
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        });

        const [meData, openL, accL, compL] = await Promise.all([
          fetchMe(getAccessTokenSilently),
          fetchOpenRequests(getAccessTokenSilently),
          loadByStatus("accepted"),
          loadByStatus("completed"),
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

  // Loading gates
  if (isLoading) {
    return <div style={loadingShell}>Loading…</div>;
  }
  if (!isAuthenticated) {
    return <Hero onLogin={() => loginWithRedirect()} />;
  }
  if (!me) {
    return <div style={loadingShell}>Loading profile…</div>;
  }

  return (
    <div>
      <HeaderBar
        name={user?.name}
        points={me?.points}
        onLogout={() => logout({ returnTo: window.location.origin })}
      />

      {/* Create a new request */}
      <CreateRequest
        onSubmit={async (payload) => {
          try {
            setBusy(true);
            // Ensure profile exists
            if (!me) {
              const meData = await fetchMe(getAccessTokenSilently);
              setMe(meData);
            }
            // Create
            const created = await createRequest(
              getAccessTokenSilently,
              payload,
            );
            // Optimistic add
            setOpen((prev) => [
              { _id: created._id, ...payload, status: "open" },
              ...prev,
            ]);
            // Canonical refresh
            const [openL, meData] = await Promise.all([
              fetchOpenRequests(getAccessTokenSilently),
              fetchMe(getAccessTokenSilently),
            ]);
            setOpen(openL);
            setMe(meData);
          } catch (e) {
            console.error("Create failed:", e);
            alert("Could not create request.");
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
                  fetchOpenRequests(getAccessTokenSilently),
                  loadByStatus("accepted"),
                  loadByStatus("completed"),
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

        {/* Open */}
        {tab === "open" && (
          <RequestsSection
            items={open}
            onAccept={async (id) => {
              try {
                setBusy(true);
                const updated = await acceptRequest(getAccessTokenSilently, id); // backend returns the updated doc
                // Move from open → accepted
                setOpen((prev) => prev.filter((x) => x._id !== id));
                setAccepted((prev) => [updated, ...prev]);
                alert("Accepted! Join link is under the Accepted tab.");
                setTab("accepted");
              } catch (e) {
                console.error("Accept failed:", e);
                alert(e.message || "Cannot accept this request.");
              } finally {
                // Keep lists canonical
                const [openL, accL] = await Promise.all([
                  fetchOpenRequests(getAccessTokenSilently),
                  loadByStatus("accepted"),
                ]);
                setOpen(openL);
                setAccepted(accL);
                setBusy(false);
              }
            }}
            onComplete={() => {}}
            disabled={busy}
          />
        )}

        {/* Accepted */}
        {tab === "accepted" && (
          <RequestsSection
            items={accepted}
            onAccept={() => {}}
            onComplete={async (id) => {
              try {
                setBusy(true);
                const updated = await completeRequest(
                  getAccessTokenSilently,
                  id,
                ); // updated doc
                setAccepted((prev) => prev.filter((x) => x._id !== id));
                setCompleted((prev) => [updated, ...prev]);
                const meData = await fetchMe(getAccessTokenSilently);
                setMe(meData); // points refresh
                alert("Completed! Points updated.");
                setTab("completed");
              } catch (e) {
                console.error("Complete failed:", e);
                alert(e.message || "Cannot complete this request.");
              } finally {
                const [accL, compL] = await Promise.all([
                  loadByStatus("accepted"),
                  loadByStatus("completed"),
                ]);
                setAccepted(accL);
                setCompleted(compL);
                setBusy(false);
              }
            }}
            disabled={busy}
          />
        )}

        {/* Completed */}
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

// tiny style
const loadingShell = {
  maxWidth: 720,
  margin: "2rem auto",
  fontFamily: "system-ui",
};
