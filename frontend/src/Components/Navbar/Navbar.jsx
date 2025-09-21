// Components/Navbar/Navbar.jsx
import React, { useEffect, useRef, useState } from "react";
import "./Navbar.css";
import { Link } from "react-router-dom";

/**
 * Props:
 *  - name?: string
 *  - email?: string
 *  - avatarUrl?: string
 *  - points?: number
 *  - onLogout?: () => void
 *  - onOpenProfile?: () => void
 *  - onMyRequests?: () => void
 */
export default function Navbar({
  name: rawName,
  email,
  avatarUrl,
  points,
  onLogout = () => {},
  onOpenProfile = () => {},
  onMyRequests = () => {},
}) {
  const name = (rawName ?? "User").trim() || "User";
  const safePoints = Number.isFinite(points) && points >= 0 ? points : "—";

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const [acctOpen, setAcctOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const acctRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    const onDocDown = (e) => {
      if (acctOpen && acctRef.current && !acctRef.current.contains(e.target)) {
        if (!e.target.closest(".pf-avatar-btn")) setAcctOpen(false);
      }
      if (
        drawerOpen &&
        drawerRef.current &&
        !drawerRef.current.contains(e.target)
      ) {
        if (!e.target.closest(".pf-icon-btn")) setDrawerOpen(false);
      }
    };
    const onEsc = (e) =>
      e.key === "Escape" && (setAcctOpen(false), setDrawerOpen(false));
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [acctOpen, drawerOpen]);

  // NEW: helper to close the drawer when a nav link is clicked
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <header className="pf-navbar" role="banner">
        {/* LEFT: logo (click -> home) */}
        <Link to="/" className="logo-link" aria-label="Go to home">
          <img src="/logo.png" className="logo" alt="Peerfect" />
        </Link>

        {/* RIGHT */}
        <div className="pf-nav-right">
          <span className="pf-greeting">Hi, {name}</span>

          <div
            className="pf-points"
            title="Spend points to learn; earn by tutoring."
          >
            <span className="pf-dot" aria-hidden="true">
              ◎
            </span>
            <span className="pf-points-num">{safePoints}</span>
            <span className="pf-points-lbl">pts</span>
          </div>

          {/* Avatar → Account menu */}
          <button
            className="pf-avatar-btn"
            onClick={() => setAcctOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={acctOpen}
            aria-label="Account menu"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              <span className="pf-avatar-fallback">{initials}</span>
            )}
          </button>

          {/* Hamburger → Drawer */}
          <button
            className="pf-icon-btn"
            onClick={() => setDrawerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-label="Open menu"
          >
            <span className="pf-hamburger" />
          </button>
        </div>
      </header>

      {/* Account popover */}
      {acctOpen && (
        <div className="pf-acct-popover" ref={acctRef} role="menu">
          <div className="pf-acct-head">
            <div className="pf-acct-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <span className="pf-avatar-fallback">{initials}</span>
              )}
            </div>
            <div className="pf-acct-info">
              <div className="pf-acct-name">{name}</div>
              {email && <div className="pf-acct-email">{email}</div>}
            </div>
          </div>
          <div className="pf-menu">
            <button
              className="pf-menu-item"
              onClick={() => {
                setAcctOpen(false);
                onOpenProfile();
              }}
            >
              Account settings
            </button>
            <button
              className="pf-menu-item"
              onClick={() => {
                setAcctOpen(false);
                onMyRequests();
              }}
            >
              My requests
            </button>
            <hr className="pf-menu-sep" />
            <button className="pf-menu-item danger" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Drawer */}
      <div className={`pf-drawer-backdrop ${drawerOpen ? "show" : ""}`} />
      <aside
        className={`pf-drawer ${drawerOpen ? "open" : ""}`}
        ref={drawerRef}
        role="dialog"
        aria-label="Main menu"
      >
        <div className="pf-drawer-head">
          <span className="pf-drawer-title">Menu</span>
          <button
            className="pf-icon-btn small"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          >
            <span className="pf-close" />
          </button>
        </div>

        <nav className="pf-drawer-nav">
          {/* Each link closes the drawer after navigating */}
          <Link to="/requests" className="pf-drawer-link" onClick={closeDrawer}>
            Browse requests
          </Link>
          <Link to="/create" className="pf-drawer-link" onClick={closeDrawer}>
            Create request
          </Link>
          <Link to="/profile" className="pf-drawer-link" onClick={closeDrawer}>
            Profile
          </Link>
        </nav>

        <div className="pf-drawer-footer">
          <span className="pf-muted">v0.1 • Hackathon build</span>
        </div>
      </aside>
    </>
  );
}
