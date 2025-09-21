// src/Components/Home/Home.jsx
import React from "react";
import "./Home.css";

/**
 * Props:
 *  - name: string
 *  - points?: number
 *  - onCreateRequest: () => void     // e.g. scroll to CreateRequest
 *  - onBrowseRequests: () => void    // e.g. reveal Activity area
 *  - historyItems?: Array<{id,type,course,topic,points,when}>
 *  - showHistory?: boolean           // default true
 *  - onSeeAllHistory?: () => void
 */
export default function Home({
  name = "User",
  onCreateRequest,
  onBrowseRequests,
}) {
  const firstName = String(name).split(" ")[0];

  return (
    <div className="hero">
      <h1 className="hero-title">Welcome back, {firstName}!</h1>
      <p className="hero-sub">What would you like to do today?</p>

      <div className="cta-grid">
        <div className="card">
          <h3>I want to learn</h3>
          <p className="muted">Post a request and offer points.</p>
          <button className="btn" onClick={onCreateRequest}>
            Create Request
          </button>
        </div>

        <div className="card">
          <h3>I want to tutor</h3>
          <p className="muted">Accept a request and earn points.</p>
          <button className="btn" onClick={onBrowseRequests}>
            Browse Requests
          </button>
        </div>
      </div>
    </div>
  );
}
