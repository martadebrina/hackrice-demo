// src/components/HeaderBar.jsx
export default function HeaderBar({ name, points, onLogout }) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: 720,
        margin: "2rem auto",
        fontFamily: "system-ui",
      }}
    >
      <h1>Peerfect</h1>
      <div>
        <span style={{ marginRight: 12 }}>
          Hi {name} · Points: <b>{points ?? "…"}</b>
        </span>
        <button style={btnGhost} onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
const btnGhost = {
  padding: "8px 14px",
  borderRadius: 12,
  border: "1px solid #222",
  background: "transparent",
  color: "#111",
  cursor: "pointer",
};
