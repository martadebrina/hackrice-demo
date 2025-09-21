// src/Components/Requests/Requests.jsx
import React from "react";
import "./Requests.css";

function RequestCard({ r, onAccept, onComplete, disabled }) {
  const { course, topic, description, pointsOffered, status, link } = r;
  return (
    <article className={`req-card ${status}`}>
      <div className="req-card__main">
        <div className="req-card__line">
          <span className="req-card__subject">
            {course || "Untitled course"}
          </span>
        </div>
        <div className="req-card__line">
          <span className="label">Topic</span>
          <span className="value">{topic || "—"}</span>
        </div>
        {description && <div className="req-card__desc">{description}</div>}
      </div>

      <div className="req-card__side">
        <div className="points">{pointsOffered ?? 0} pts</div>
        <div className={`status pill ${status}`}>{status}</div>
        {link && (
          <a
            className="btn btn-join"
            href={link}
            target="_blank"
            rel="noreferrer"
          >
            Join
          </a>
        )}
        {status === "open" && (
          <button
            className="btn btn-accept"
            onClick={() => onAccept(r._id)}
            disabled={disabled}
          >
            Accept
          </button>
        )}
        {status === "accepted" && (
          <button
            className="btn btn-complete"
            onClick={() => onComplete(r._id)}
            disabled={disabled}
          >
            Complete
          </button>
        )}
      </div>
    </article>
  );
}

export default function Requests({
  items = [],
  onAccept = () => {},
  onComplete = () => {},
  disabled = false,
  onBack,
  onRefresh,
  activeTab = "open",
  onTabChange = () => {},
  mineOnly = false,
  onMineToggle = () => {},
}) {
  const goBack = () => (onBack ? onBack() : window.history.back());
  const tabs = ["open", "accepted", "completed"];

  return (
    <section className="reqs">
      {/* Box that owns its own scroll */}
      <div className="reqs-box">
        {/* Sticky toolbar inside the box */}
        <div className="reqs-toolbar">
          <button className="btn ghost small" onClick={goBack}>
            ← Back
          </button>

          <div className="reqs-tabs" role="tablist" aria-label="Request status">
            {tabs.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={activeTab === t}
                className={`tab ${activeTab === t ? "active" : ""}`}
                onClick={() => onTabChange(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 12 }}>
            <label style={{ fontSize: 12, color: '#666', marginRight: 8 }}>
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(e) => onMineToggle(e.target.checked)}
              />{' '}
              My requests
            </label>
          </div>
          <button
            className="btn ghost small"
            onClick={onRefresh}
            aria-label="Refresh list"
          >
            Refresh
          </button>
        </div>

        {/* Scrollable area */}
        <div className="reqs-scroll">
          {items.length === 0 ? (
            <div className="reqs-empty">
              <div className="empty-title">No items</div>
              <div className="empty-sub">
                Check back later or create a request.
              </div>
            </div>
          ) : (
            items.map((r) => (
              <RequestCard
                key={r._id}
                r={r}
                onAccept={onAccept}
                onComplete={onComplete}
                disabled={disabled}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
