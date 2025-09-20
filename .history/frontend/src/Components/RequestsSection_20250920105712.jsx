// src/components/RequestsSection.jsx
import RequestCard from "./RequestCard";

export default function RequestsSection({ items, onAccept, onComplete }) {
  return (
    <section style={card}>
      <h2>Open Requests</h2>
      {items.length === 0 && <p>No open requests yet.</p>}
      {items.map((r) => (
        <RequestCard key={r._id} r={r} onAccept={onAccept} onComplete={onComplete} />
      ))}
    </section>
  );
}

const card = { border:"1px solid #eee", borderRadius:12, padding:16, margin:"16px auto", maxWidth:720 };
