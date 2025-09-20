// src/App.jsx
import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";
import Hero from "./Components/Hero";
import HeaderBar from "./Components/HeaderBar";
import CreateRequest from "./Components/CreateRequest";
import RequestsSection from "./Components/RequestsSection";
import {
  fetchMe, fetchOpenRequests, createRequest,
  acceptRequest, completeRequest,
} from "./lib/api";

export default function App() {
  const { isAuthenticated, loginWithRedirect, logout, user, getAccessTokenSilently, isLoading } = useAuth0();
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState([]);


  if (isLoading) return <div style={{maxWidth:720, margin:"2rem auto", fontFamily:"system-ui"}}>Loading…</div>;
  if (!isAuthenticated) return <Hero onLogin={() => loginWithRedirect()} />;

  return (
    <div>
      <HeaderBar
        name={user?.name}
        points={me?.points}
        onLogout={() => logout({ returnTo: window.location.origin })}
      />

      <CreateRequest onSubmit={async (payload) => {
        await createRequest(payload, getAccessTokenSilently);
        const list = await fetchOpenRequests(getAccessTokenSilently);
        setOpen(list);
        const meData = await fetchMe(getAccessTokenSilently);
        setMe(meData);
      }} />

      <div style={{maxWidth:720, margin:"0 auto"}}>
        <RequestsSection
          items={open}
          onAccept={async (id) => {
            await acceptRequest(getAccessTokenSilently, id);
            const list = await fetchOpenRequests(getAccessTokenSilently);
            setOpen(list);
          }}
          onComplete={async (id) => {
            await completeRequest(getAccessTokenSilently, id);
            const list = await fetchOpenRequests(getAccessTokenSilently);
            setOpen(list);
            const meData = await fetchMe(getAccessTokenSilently);
            setMe(meData);
          }}
        />
      </div>
    </div>
  );
}
