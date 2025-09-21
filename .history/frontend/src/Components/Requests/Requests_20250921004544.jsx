// src/Components/Requests/Requests.jsx
import React from "react";
import RequestCard from "../RequestCard/RequestCard";
import "./Requests.css";

export default function Requests({
  title = "Requests",
  items = [],
  activeTab = "open",            // "open" | "accepted" | "completed"
  onTabChange = () => {},
  onBack,
  onRefresh,
  onAccept,
  onComplete,
  disabled = false,
  // new props for view logic
  openView = "others",           // "others" | "mine"
  onOpenViewChange = () => {},
  acceptedView = "mine",         // "mine" | "tutored"
  onAcceptedViewChange = () => {},
  meId,
  completedMine = [],
  completedTutored = [],
}) {
  const tabs = ["open", "accepted", "completed"];

  return (
    <section className="reqs">
      {/* Toolbar */}
      <div className="reqs-toolbar">
        <button className="btn ghost small" onClick={onBack || (() => window.history.back())}>
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

        <button className="btn ghost small" onClick={onRefresh}>
          ↻ Refresh
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

      {/* Content */}
      {activeTab !== "completed" ? (
        <div className="reqs-list">
          {items.length === 0 ? (
            <div className="muted" style={{ padding: "12px 8px" }}>
              No items to show.
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
      ) : (
        // Completed: no toggle, show two sections
        <div className="reqs-list">
          <h3 style={{ marginTop: 12 }}>My requests (completed)</h3>
          {completedMine.length === 0 ? (
            <div className="muted" style={{ padding: "8px 8px 16px" }}>
              None yet.
            </div>
          ) : (
            completedMine.map((r) => (
              <RequestCard
                key={r._id}
                r={r}
                onAccept={onAccept}
                onComplete={onComplete}
                disabled={true}
              />
            ))
          )}

          <h3 style={{ marginTop: 20 }}>I tutored (completed)</h3>
          {completedTutored.length === 0 ? (
            <div className="muted" style={{ padding: "8px 8px 16px" }}>
              None yet.
            </div>
          ) : (
            completedTutored.map((r) => (
              <RequestCard
                key={r._id}
                r={r}
                onAccept={onAccept}
                onComplete={onComplete}
                disabled={true}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
