// src/components/CreateRequest.jsx
import { useState } from "react";

export default function CreateRequest({ onSubmit }) {
  const [course, setCourse] = useState("");
  const [topic, setTopic] = useState("");
  const [points, setPoints] = useState(20);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ course, topic, pointsOffered: Number(points) });
        setCourse(""); setTopic(""); setPoints(20);
      }}
      style={card}
    >
      <h2>Create Request</h2>
      <input style={input} placeholder="Course (e.g., COMP 182)" value={course} onChange={(e)=>setCourse(e.target.value)} />
      <input style={input} placeholder="Topic (e.g., Recursion)" value={topic} onChange={(e)=>setTopic(e.target.value)} />
      <input style={input} type="number" value={points} onChange={(e)=>setPoints(e.target.value)} />
      <button style={btn} type="submit">Post</button>
    </form>
  );
}

const card = { border:"1px solid #eee", borderRadius:12, padding:16, margin:"16px auto", maxWidth:720 };
const input = { display:"block", width:"100%", padding:"10px 12px", margin:"8px 0", borderRadius:8, border:"1px solid #ddd" };
const btn = { padding:"8px 14px", borderRadius:12, border:"1px solid #222", background:"#111", color:"#fff", cursor:"pointer" };
