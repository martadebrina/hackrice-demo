// src/components/RequestsSection.jsx
import RequestCard from "./RequestCard";
export default function RequestsSection({
  items = [],
  onAccept,
  onComplete,
  disabled,
  renderExtra, // 👈 make sure this prop exists
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => (
        <div
          key={item._id}
          style={{
            border: "1px solid #222",
            borderRadius: 12,
            padding: 12,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {item.course} — {item.topic}
          </div>
          <div style={{ fontSize: 14, opacity: 0.8 }}>
            Offered: {item.pointsOffered} pts • Status: {item.status}
            {item.link ? (
              <>
                {" "}
                • <a href={item.link} target="_blank" rel="noreferrer">Join</a>
              </>
            ) : null}
          </div>

          {/* 👉 this is where the schedule UI hooks in */}
          {typeof renderExtra === "function" ? renderExtra(item) : null}

          <div style={{ display: "flex", gap: 8 }}>
            {onAccept && item.status === "open" && (
              <button disabled={disabled} onClick={() => onAccept(item._id)}>
                Accept
              </button>
            )}
            {onComplete && item.status === "accepted" && (
              <button disabled={disabled} onClick={() => onComplete(item._id)}>
                Complete
              </button>
            )}
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div style={{ opacity: 0.6, fontStyle: "italic" }}>No items.</div>
      )}
    </div>
  );
}
