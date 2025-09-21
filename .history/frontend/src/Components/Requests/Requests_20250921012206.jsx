// src/Components/Requests/Requests.jsx
import React from "react";
import "./Requests.css";
import { Video } from "lucide-react";

function RequestCard({ r, onAccept, onComplete, disabled }) {
  const { course, topic, description, pointsOffered, status, link } = r;
  return (
    <article className={`req-card ${status}`}>
      <div className="req-card__main">
        <div className="req-card__line">
          <span className="req-card__subject">{course || "Untitled course"}</span>
        </div>
        <div className="req-card__line">
          <span className="label">Topic</span>
          <span className="value">{topic || "—"}</span>
        </div>
        {description && <div className="req-card__desc">{description}</div>}
      </div>

      <div className="req-card__side">
        <div className="points">{pointsOffered ?? 0} pts</div>
        {/* <div className={`status pill ${status}`}>{status}</div> */}
        {link && (
          <a className="btn-join" href={link} target="_blank" rel="noreferrer">
            Join
          </a>
        )}
        {status === "open" && (
          <button className="btn btn-accept" onClick={() => onAccept(r._id)} disabled={disabled}>
            Accept
          </button>
        )}
        {status === "accepted" && (
          <button className="btn btn-complete" onClick={() => onComplete(r._id)} disabled={disabled}>
            Complete
          </button>
        )}
      </div>
    </article>
  );
}

export default function Requests({
  // data
  items = [],
  completedMine = [],          // NEW: my completed (I’m the student)
  completedTutored = [],      // NEW: completed I tutored (I’m the tutor)

  // actions
  onAccept = () => {},
  onComplete = () => {},
  onBack,
  onRefresh,

  // tabs
  activeTab = "open",
  onTabChange = () => {},

  // view toggles
  openView = "others",                // NEW: "others" | "mine"
  onOpenViewChange = () => {},        // NEW
  acceptedView = "mine",              // NEW: "mine" | "tutored"
  onAcceptedViewChange = () => {},    // NEW

  // misc
  disabled = false,
}) {
  const goBack = () => (onBack ? onBack() : window.history.back());
  const tabs = ["open", "accepted", "completed"];

  return (
    <section className="reqs">
      <div className="reqs-box">
        {/* Sticky toolbar */}
        <div className="reqs-toolbar">
          <button className="btn ghost small" onClick={goBack}>← Back</button>

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

          <button className="btn ghost small" onClick={onRefresh} aria-label="Refresh list">
            Refresh
          </button>
        </div>

        {/* Secondary controls per tab */}
        {activeTab === "open" && (
          <div className="segmented">
            <button
              className={`chip ${openView === "others" ? "active" : ""}`}
              onClick={() => onOpenViewChange("others")}
            >
              Others’ requests
            </button>
            <button
              className={`chip ${openView === "mine" ? "active" : ""}`}
              onClick={() => onOpenViewChange("mine")}
            >
              My requests
            </button>
          </div>
        )}

        {activeTab === "accepted" && (
          <div className="segmented">
            <button
              className={`chip ${acceptedView === "mine" ? "active" : ""}`}
              onClick={() => onAcceptedViewChange("mine")}
            >
              My requests
            </button>
            <button
              className={`chip ${acceptedView === "tutored" ? "active" : ""}`}
              onClick={() => onAcceptedViewChange("tutored")}
            >
              Accepted by me
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="reqs-scroll">
          {activeTab !== "completed" ? (
            items.length === 0 ? (
              <div className="reqs-empty">
                <div className="empty-title">No items</div>
                <div className="empty-sub">Check back later or create a request.</div>
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
            )
          ) : (
            // Completed: show two sections; no toggle
            <>
              <h3 className="reqs-section-title">My requests (completed)</h3>
              {completedMine.length === 0 ? (
                <div className="reqs-empty small">None yet.</div>
              ) : (
                completedMine.map((r) => (
                  <RequestCard key={r._id} r={r} onAccept={onAccept} onComplete={onComplete} disabled />
                ))
              )}

              <h3 className="reqs-section-title" style={{ marginTop: 18 }}>I tutored (completed)</h3>
              {completedTutored.length === 0 ? (
                <div className="reqs-empty small">None yet.</div>
              ) : (
                completedTutored.map((r) => (
                  <RequestCard key={r._id} r={r} onAccept={onAccept} onComplete={onComplete} disabled />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
