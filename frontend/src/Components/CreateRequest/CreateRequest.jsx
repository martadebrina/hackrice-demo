import React, { useState } from "react";
import "./CreateRequest.css";

/**
 * Props:
 *  - onSubmit: ({ course, topic, description?, pointsOffered }) => Promise|void
 *  - disabled?: boolean
 *  - defaultPoints?: number
 */
export default function CreateRequest({
  onSubmit,
  disabled = false,
  defaultPoints = 20,
}) {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(defaultPoints);

  const MAX_DESC = 300;
  const valid = subject.trim() && topic.trim() && Number(points) > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid || disabled) return;

    await onSubmit({
      course: subject.trim(), // backend expects "course"
      topic: topic.trim(),
      description: description.trim(), // backend can ignore if not stored yet
      pointsOffered: Number(points),
    });

    setSubject("");
    setTopic("");
    setDescription("");
    setPoints(defaultPoints);
  }

  return (
    <form className="crx" onSubmit={handleSubmit}>
      <h2 className="crx-title">Create Request</h2>

      <div className="field">
        <label htmlFor="crx-subject">Subject</label>
        <input
          id="crx-subject"
          className="input"
          placeholder="e.g., Data Structures"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          disabled={disabled}
        />
      </div>

      <div className="field">
        <label htmlFor="crx-topic">Topic</label>
        <input
          id="crx-topic"
          className="input"
          placeholder="e.g., Recursion / Hash tables / DP"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          required
          disabled={disabled}
        />
      </div>

      <div className="field">
        <label htmlFor="crx-desc">
          Description <span className="muted">(optional)</span>
        </label>
        <textarea
          id="crx-desc"
          className="textarea"
          rows={5}
          maxLength={MAX_DESC}
          placeholder="Add context: what you’ve tried, where you’re stuck, links, etc."
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
          disabled={disabled}
        />
        <div className="meta">
          <span className="char">
            {description.length}/{MAX_DESC}
          </span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="crx-points">Offer points</label>
        <div className="points-row">
          <input
            id="crx-points"
            className="slider"
            type="range"
            min={5}
            max={200}
            step={5}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            disabled={disabled}
          />
          <input
            className="points-input"
            type="number"
            min={1}
            max={999}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            disabled={disabled}
          />
        </div>
        <div className="hint">
          Earned by tutoring; spend them to request help.
        </div>
      </div>

      <div className="actions">
        <button
          className="btn-primary"
          type="submit"
          disabled={!valid || disabled}
        >
          Post request
        </button>
        <button
          className="btn-ghost"
          type="button"
          onClick={() => {
            setSubject("");
            setTopic("");
            setDescription("");
            setPoints(defaultPoints);
          }}
          disabled={disabled}
        >
          Clear
        </button>
      </div>
    </form>
  );
}
