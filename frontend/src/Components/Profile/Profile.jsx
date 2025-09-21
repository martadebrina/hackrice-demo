import React, { useState } from "react";
import "./Profile.css";

/**
 * Props:
 *  - name?: string
 *  - email?: string
 *  - avatarUrl?: string
 *  - points?: number
 *  - onLogout?: () => void
 *  - onBack?: () => void
 *  - onSaveProfile?: ({ name, avatarUrl }: {name:string, avatarUrl:string}) => Promise<void> | void
 */
export default function Profile({
  name: rawName = "User",
  email = "",
  avatarUrl: rawAvatar = "",
  points = 0,
  onLogout = () => {},
  onBack = () => window.history.back(),
  onSaveProfile = async () => {}, // optional: wire to API later
}) {
  const [name, setName] = useState(rawName);
  const [avatarUrl, setAvatarUrl] = useState(rawAvatar);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const initials = (name || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  async function handleSave(e) {
    e.preventDefault();
    setMsg("");
    try {
      setSaving(true);
      await onSaveProfile({
        name: name.trim() || "User",
        avatarUrl: avatarUrl.trim(),
      });
      setMsg("Saved!");
    } catch (err) {
      console.error(err);
      setMsg("Could not save.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 1800);
    }
  }

  return (
    <section className="acct">
      <div className="acct-box">
        {/* Sticky header inside panel */}
        <div className="acct-toolbar">
          <button className="btn ghost small" onClick={onBack}>
            ← Back
          </button>
          <h2 className="acct-title">Account Settings</h2>
          <div />
        </div>

        <div className="acct-content">
          {/* Avatar */}
          <div className="acct-avatar-block">
            <div className="acct-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar preview" />
              ) : (
                <span className="acct-avatar-fallback">{initials}</span>
              )}
            </div>
          </div>

          {/* Form */}
          <form className="acct-form" onSubmit={handleSave}>
            <label className="field">
              <span className="field-label">Display name</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={60}
              />
            </label>

            <label className="field">
              <span className="field-label">Email</span>
              <input className="input" value={email} readOnly />
            </label>

            <label className="field">
              <span className="field-label">Avatar URL</span>
              <input
                className="input"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>

            <div className="field grid">
              <div>
                <div className="field-label">Points</div>
                <div className="points-pill">
                  {Number.isFinite(points) ? points : "—"} pts
                </div>
              </div>
            </div>

            <div className="acct-actions">
              <button
                className="btn danger ghost"
                type="button"
                onClick={onLogout}
              >
                Logout
              </button>
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>

            {msg && <div className="acct-msg">{msg}</div>}
          </form>
        </div>
      </div>
    </section>
  );
}
