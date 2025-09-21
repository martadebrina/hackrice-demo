import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { proposeSchedule, decideSchedule } from "./lib/api";

import Hero from "./Components/Hero/Hero";
import Navbar from "./Components/Navbar/Navbar";
import CreateRequest from "./Components/CreateRequest/CreateRequest";
import Requests from "./Components/Requests/Requests"; // <-- NEW
import Home from "./Components/Home/Home";
import Profile from "./Components/Profile/Profile";

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
  const [openView, setOpenView] = useState("others");   // "others" | "mine"
  const [acceptedView, setAcceptedView] = useState("mine"); // "mine" | "tutored"
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log("Auth0 state:", { isLoading, isAuthenticated, user, error });
  }, [isLoading, isAuthenticated, user, error]);

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
      fetchByStatus("accepted", true),   // only mine (as student or tutor)
      fetchByStatus("completed", true),  // only mine (as student or tutor)
    ]);
    setMe(meData);
    setOpen(openL);
    setAccepted(accL);
    setCompleted(compL);
  }

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let es;
    let cancelled = false;

    (async () => {
      try {
        const token = await getAccessTokenSilently({
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        });
        await refetchAll(); // initial load
        es = new EventSource(
          `${API}/events?access_token=${encodeURIComponent(token)}`,
        );
        es.onmessage = async (e) => {
          if (cancelled || !e.data) return;
          try {
            const evt = JSON.parse(e.data);
            if (
              [
                "request:created",
                "request:accepted",
                "request:completed",
                "user:points_changed",
              ].includes(evt?.type)
            ) {
              await refetchAll();
            }
          } catch {
            /* ignore parse */
          }
        };
        es.onerror = (err) => console.warn("SSE error:", err);
      } catch {
        console.error("Failed to start SSE:");
      }
    })();

    return () => {
      cancelled = true;
      if (es) es.close();
    };
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

  if (isLoading)
    return <div style={{ maxWidth: 720, margin: "2rem auto" }}>Loading…</div>;
  if (!isAuthenticated) return <Hero onLogin={() => loginWithRedirect()} />;

  // Helpers for Requests component
  function itemsFor(tabName) {
   if (!me) return [];
   if (tabName === "open") {
     const mine = open.filter((x) => x.studentId === me._id);
     const others = open.filter((x) => x.studentId !== me._id);
     return openView === "mine" ? mine : others;
   }
   if (tabName === "accepted") {
     const mine = accepted.filter((x) => x.studentId === me._id);
     const tutored = accepted.filter((x) => x.tutorId === me._id);
     return acceptedView === "tutored" ? tutored : mine;
   }
   // completed is rendered as two sections in <Requests/>, but we still return something
   return completed;
  }

  async function handleAccept(id) {
    try {
      const item = open.find((x) => x._id === id);
      if (me && item && item.studentId === me._id) {
        alert("You can’t accept your own request.");
        return;
      }
      setBusy(true);
      await acceptRequest(getAccessTokenSilently, id);
      await refetchAll();
      alert("Accepted! Join link is in Accepted tab.");
      setTab("accepted");
    } catch (e) {
      console.error("Accept failed:", e);
      alert(e?.message || "Cannot accept this request.");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete(id) {
    try {
      setBusy(true);
      const data = await completeRequest(getAccessTokenSilently, id);
      if (data?.callerPoints != null) {
        setMe((m) => (m ? { ...m, points: data.callerPoints } : m));
      }
      await refetchAll();
      alert("Completed! Points transferred.");
      setTab("completed");
    } catch (e) {
      console.error("Complete failed:", e);
      alert("Cannot complete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Navbar
        name={
          me?.name || user?.name || user?.nickname || user?.email?.split("@")[0]
        }
        email={user?.email}
        avatarUrl={user?.picture}
        points={me?.points}
        onLogout={() => logout({ returnTo: window.location.origin })}
        onOpenProfile={() => navigate("/profile")}
        onMyRequests={() => navigate("/requests")}
      />

      <Routes>
        {/* HOME */}
        <Route
          path="/"
          element={
            <Home
              name={
                me?.name ||
                user?.name ||
                user?.nickname ||
                user?.email?.split("@")[0]
              }
              points={me?.points}
              onCreateRequest={() => navigate("/create")}
              onBrowseRequests={() => navigate("/requests")}
              showHistory={true}
            />
          }
        />

        {/* CREATE REQUEST PAGE */}
        <Route
          path="/create"
          element={
            <div style={{ padding: "0 20px" }}>
              <div style={{ maxWidth: 980, margin: "12px auto" }}>
                <button
                  className="btn ghost"
                  onClick={() => navigate(-1)}
                  style={{ marginBottom: 10 }}
                >
                  ← Back
                </button>
              </div>
              <CreateRequest
                disabled={busy}
                onSubmit={async (payload) => {
                  try {
                    setBusy(true);
                    if (!me) setMe(await fetchMe(getAccessTokenSilently));
                    await createRequest(getAccessTokenSilently, payload);
                    await refetchAll();
                    navigate("/requests");
                    setTab("open");
                  } catch (e) {
                    console.error("Create failed:", e);
                    alert("Could not create request.");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </div>
          }
        />

        {/* REQUESTS / ACTIVITY PAGE */}
        <Route
          path="/requests"
          element={
            <Requests
              title="Requests List"
  items={itemsFor(tab)}
  activeTab={tab}
  onTabChange={setTab}
  onBack={() => navigate(-1)}
  onRefresh={refetchAll}
  onAccept={handleAccept}
  onComplete={handleComplete}
  disabled={busy}
  openView={openView}
  onOpenViewChange={setOpenView}
  acceptedView={acceptedView}
  onAcceptedViewChange={setAcceptedView}
  completedMine={completed.filter((x) => x.studentId === me?._id)}
  completedTutored={completed.filter((x) => x.tutorId === me?._id)}
  meId={me?._id}
  onRefresh={refetchAll}  {/* <-- remove this line */}
  proposeSchedule={(rid, data) => proposeSchedule(getAccessTokenSilently, rid, data)}
  decideSchedule={(rid, sid, action) => decideSchedule(getAccessTokenSilently, rid, sid, action)}
/>
          }
        />

        {/* (optional) future pages */}
        {/* <Route path="/profile" element={<Profile />} /> */}
        <Route
          path="/profile"
          element={
            <Profile
              name={
                me?.name ||
                user?.name ||
                user?.nickname ||
                user?.email?.split("@")[0]
              }
              email={user?.email}
              avatarUrl={user?.picture}
              points={me?.points}
              onLogout={() => logout({ returnTo: window.location.origin })}
              onBack={() => navigate(-1)}
              onSaveProfile={async ({ name, avatarUrl }) => {
                // TODO: sambungkan ke API backend kalau sudah ada.
                // Untuk sekarang cukup update state lokal biar Navbar ikut berubah.
                setMe((m) =>
                  m
                    ? { ...m, name, avatarUrl }
                    : { name, avatarUrl, points: me?.points ?? 0 },
                );
              }}
            />
          }
        />
      </Routes>
    </div>
  );
}
