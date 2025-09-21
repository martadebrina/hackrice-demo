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
  scheduleRequest,
  confirmSchedule,
  cancelSchedule,
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

  // helper: convert <input type="datetime-local"> to UTC ISO string
function localToUtcIso(value) {
  // value like "2025-09-20T14:30"
  const d = new Date(value); // interpreted as local
  return d.toISOString();    // UTC ISO with Z
}

function ScheduleForm({ onSubmit, disabled }) {
  const [dtLocal, setDtLocal] = useState("");
  const [duration, setDuration] = useState(60);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!dtLocal) return;
      await onSubmit({ dtLocal, duration });
    }} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="datetime-local"
        value={dtLocal}
        onChange={(e) => setDtLocal(e.target.value)}
        disabled={disabled}
        style={{ padding: 6 }}
      />
      <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} disabled={disabled} style={{ padding: 6 }}>
        {[30,45,60,90].map(m => <option key={m} value={m}>{m} min</option>)}
      </select>
      <button type="submit" disabled={disabled} style={{ padding: "6px 10px" }}>Propose</button>
    </form>
  );
}


const myTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
    renderExtra={(item) => {
      const isStudent = me && item.studentId === me._id;
      const isTutor   = me && item.tutorId === me._id;
      const isParticipant = isStudent || isTutor;

      const amProposer = me && item.scheduledBy === me._id;
      const s = item.scheduleStatus;

      return (
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Status pill */}
          {s && s !== "unset" && (
            <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #999", fontSize: 12 }}>
              {s === "proposed" ? "Proposed" : s === "confirmed" ? "Confirmed" : "Cancelled"}
            </span>
          )}

          {/* Show scheduled time if present */}
          {item.scheduledAt && (
            <span style={{ fontSize: 14 }}>
              {new Date(item.scheduledAt).toLocaleString()} ({item.durationMin || 60} min)
            </span>
          )}

          {/* Only participants can propose a schedule */}
          {isParticipant && (!s || s === "unset" || s === "cancelled") && (
            <ScheduleForm
              disabled={busy}
              onSubmit={async ({ dtLocal, duration }) => {
                try {
                  const body = {
                    scheduledAtISO: localToUtcIso(dtLocal),
                    durationMin: duration,
                    scheduledTz: myTz,
                  };
                  await scheduleRequest(getAccessTokenSilently, item._id, body);
                  // optimistic: refresh so the pill/time appear immediately
                  await refetchAll();
                  alert("Schedule proposed ✅");
                } catch (e) {
                  console.error(e);
                  alert(e?.message || "Failed to propose schedule.");
                }
              }}
            />
          )}

          {/* Confirm / Cancel (only the other participant can confirm) */}
          {s === "proposed" && isParticipant && !amProposer && (
            <>
              <button
                disabled={busy}
                onClick={async () => {
                  try {
                    await confirmSchedule(getAccessTokenSilently, item._id);
                    await refetchAll();
                    alert("Schedule confirmed ✅");
                  } catch (e) {
                    console.error(e);
                    alert(e?.message || "Failed to confirm.");
                  }
                }}
              >
                Confirm
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  try {
                    await cancelSchedule(getAccessTokenSilently, item._id);
                    await refetchAll();
                    alert("Schedule cancelled.");
                  } catch (e) {
                    console.error(e);
                    alert(e?.message || "Failed to cancel.");
                  }
                }}
              >
                Cancel
              </button>
            </>
          )}

          {/* Proposer can withdraw */}
          {s === "proposed" && amProposer && (
            <button
              disabled={busy}
              onClick={async () => {
                try {
                  await cancelSchedule(getAccessTokenSilently, item._id);
                  await refetchAll();
                  alert("Proposal withdrawn.");
                } catch (e) {
                  console.error(e);
                  alert(e?.message || "Failed to withdraw.");
                }
              }}
            >
              Withdraw
            </button>
          )}
        </div>
      );
    }}
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
