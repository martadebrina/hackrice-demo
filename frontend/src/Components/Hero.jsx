// src/components/Hero.jsx
export default function Hero({ onLogin }) {
  return (
    <div style={shell}>
      <h1>Peerfect</h1>
      <p>Earn points by teaching, spend points by learning.</p>
      <button style={btn} onClick={onLogin}>
        Log in with Google
      </button>
    </div>
  );
}

const shell = { maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui" };
const btn = {
  padding: "8px 14px",
  borderRadius: 12,
  border: "1px solid #222",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};
