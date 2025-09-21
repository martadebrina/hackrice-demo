// src/Components/Requests/Requests.jsx
import React from "react";
import "./Requests.css";
import { Video } from "lucide-react";

function SchedulePanel({ r, meId, onPropose, onDecide }) {
  const [start, setStart] = React.useState("");
  const [minutes, setMinutes] = React.useState(60); // duration in minutes
  const [note, setNote] = React.useState("");

  const isParticipant = r.studentId === meId || r.tutorId === meId;
  const canSchedule = isParticipant && (r.status === "open" || r.status === "accepted");
  if (!canSchedule) return null;

  const schedules = r.schedules ?? [];

  const toIso = (local) => (local ? new Date(local).toISOString() : "");
  const endFrom = (localStart, mins) =>
    localStart ? new Date(new Date(localStart).getTime() + mins * 60000).toISOString() : "";

  return (
    <div className="sched">
      <div className="sched-row">
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>1 hour</option>
          <option value={90}>1.5 hours</option>
          <option value={120}>2 hours</option>
        </select>
      </div>

      <div className="sched-row">
        <input
          className="input"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          className="btn small"
          onClick={() =>
            onPropose({
              start: toIso(start),
              end: endFrom(start, minutes),
              note,
            })
          }
          disabled={!start}
        >
          Propose
        </button>
      </div>

      {schedules.length > 0 && (
        <div className="sched-list">
          {schedules
            .slice()
            .reverse()
            .map((s) => (
              <div key={s._id} className={`sched-item ${s.status}`}>
                <div className="sched-time">
                  {new Date(s.start).toLocaleString()} – {new Date(s.end).toLocaleString()}
                </div>
                {s.note && <div className="sched-note">{s.note}</div>}
                <div className="sched-status">{s.status}</div>
                {s.status === "proposed" && s.proposerId !== meId && (
                  <div className="sched-actions">
                    <button className="btn small btn-accept" onClick={() => onDecide(s._id, "accept")}>
                      Accept
                    </button>
                    <button className="btn small btn-ghost" onClick={() => onDecide(s._id, "decline")}>
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}


/* --- Card --- */
function RequestCard({
  r,
  onAccept,
  onComplete,
  disabled,
  meId,
  onRefresh,
  proposeSchedule,
  decideSchedule,
}) {
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

        {link && (
          <a className="btn-join" href={link} target="_blank" rel="noreferrer">
            <Video size={16} style={{ marginRight: 6 }} />
            Join Session
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

      {/* Scheduling UI */}
      <SchedulePanel
        r={r}
        meId={meId}
        onPropose={async ({ start, end, note }) => {
          await proposeSchedule(r._id, { start, end, note });
          await onRefresh?.();
        }}
        onDecide={async (sid, action) => {
          await decideSchedule(r._id, sid, action);
          await onRefresh?.();
        }}
      />
    </article>
  );
}

/* --- List / Tabs --- */
export default function Requests({
  // data
  items = [],
  completedMine = [],
  completedTutored = [],

  // actions
  onAccept = () => {},
  onComplete = () => {},
  onBack,
  onRefresh = () => {},
  proposeSchedule = () => Promise.resolve(),
  decideSchedule = () => Promise.resolve(),

  // tabs
  activeTab = "open",
  onTabChange = () => {},

  // view toggles
  openView = "others",
  onOpenViewChange = () => {},
  acceptedView = "mine",
  onAcceptedViewChange = () => {},

  // misc
  disabled = false,
  meId,
}) {
  const goBack = () => (onBack ? onBack() : window.history.back());
  const tabs = ["open", "accepted", "completed"];

  return (
    <section className="reqs">
      <div className="reqs-box">
        {/* Sticky toolbar */}
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
              aria-pressed={openView === "others"}
            >
              Others’ requests
            </button>
            <button
              className={`chip ${openView === "mine" ? "active" : ""}`}
              onClick={() => onOpenViewChange("mine")}
              aria-pressed={openView === "mine"}
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
              aria-pressed={acceptedView === "mine"}
            >
              My requests
            </button>
            <button
              className={`chip ${acceptedView === "tutored" ? "active" : ""}`}
              onClick={() => onAcceptedViewChange("tutored")}
              aria-pressed={acceptedView === "tutored"}
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
                  meId={meId}
                  onRefresh={onRefresh}
                  proposeSchedule={(rid, data) => proposeSchedule(rid, data)}
                  decideSchedule={(rid, sid, action) => decideSchedule(rid, sid, action)}
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
                  <RequestCard
                    key={r._id}
                    r={r}
                    onAccept={onAccept}
                    onComplete={onComplete}
                    disabled
                    meId={meId}
                    onRefresh={onRefresh}
                    proposeSchedule={(rid, data) => proposeSchedule(rid, data)}
                    decideSchedule={(rid, sid, action) => decideSchedule(rid, sid, action)}
                  />
                ))
              )}

              <h3 className="reqs-section-title" style={{ marginTop: 18 }}>
                I tutored (completed)
              </h3>
              {completedTutored.length === 0 ? (
                <div className="reqs-empty small">None yet.</div>
              ) : (
                completedTutored.map((r) => (
                  <RequestCard
                    key={r._id}
                    r={r}
                    onAccept={onAccept}
                    onComplete={onComplete}
                    disabled
                    meId={meId}
                    onRefresh={onRefresh}
                    proposeSchedule={(rid, data) => proposeSchedule(rid, data)}
                    decideSchedule={(rid, sid, action) => decideSchedule(rid, sid, action)}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
