// src/components/RequestCard.jsx
export default function RequestCard({ r, onAccept, onComplete }) {
  return (
    <div style={row}>
      <div>
        <b>{r.course}</b> — {r.topic} · <i>{r.pointsOffered} pts</i>
        {r.link && <> · <a href={r.link} target="_blank" rel="noreferrer">Join session</a></>}
      </div>
      <div>
        {r.status === "open" && <button style={btn} onClick={() => onAccept(r._id)}>Accept</button>}
        {r.status === "accepted" && <button style={btn} onClick={() => onComplete(r._id)}>Complete</button>}
      </div>
    </div>
  );
}

const row  = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderBottom:"1px solid #f3f3f3" };
const btn = { padding:"6px 10px", borderRadius:10, border:"1px solid #222", background:"#111", color:"#fff", cursor:"pointer" };
