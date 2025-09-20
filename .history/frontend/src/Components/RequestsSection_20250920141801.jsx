// src/components/RequestsSection.jsx
import RequestCard from "./RequestCard";
export default function RequestsSection({ items, onAccept, onComplete, disabled }) {
  return (
    <section style={card}>
      <h2>Requests</h2>
      {items.length === 0 && <p>No items.</p>}
      {items.map((r) => (
        <RequestCard key={r._id} r={r} onAccept={onAccept} onComplete={onComplete} disabled={disabled} />
      ))}
    </section>
  );
}
const card = { border:"1px solid #eee", borderRadius:12, padding:16, margin:"16px auto", maxWidth:720 };
