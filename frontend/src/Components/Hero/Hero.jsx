// src/components/Hero.jsx
import "./Hero.css";

export default function Hero({ onLogin }) {
  // Create a few decorative "stars" with varied positions/timings
  const stars = Array.from({ length: 28 }).map((_, i) => {
    const left = Math.random() * 100; // 0–100vw
    const size = 1 + Math.random() * 2; // 1–3px
    const delay = Math.random() * 6; // 0–6s
    const duration = 6 + Math.random() * 8; // 6–14s
    const offsetX = (Math.random() - 0.5) * 200; // slight diagonal drift

    return (
      <span
        key={i}
        className="star"
        style={{
          left: `${left}vw`,
          width: `${size}px`,
          height: `${size}px`,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          "--driftX": `${offsetX}px`,
        }}
      />
    );
  });

  return (
    <section className="hero" aria-label="Peerfect hero section">
      {/* Animated background gradient lives on the section via CSS */}
      {/* Decorative falling stars */}
      <div className="stars" aria-hidden="true">
        {stars}
      </div>

      {/* Content */}
      <div className="hero__content">
        <img
          src="/logo.png"
          alt="Peerfect rocket logo"
          className="hero__logo"
          width={180}
          height={180}
          decoding="async"
        />

        <h1 className="hero__title">
          Peer-to-peer tutoring:{" "}
          <span className="hero__accent">no money, just points</span>
        </h1>

        <p className="hero__subtitle">
          Help your classmates, earn credits, and redeem them when you need
          support.
        </p>

        <button className="btn btn--primary" onClick={onLogin} type="button">
          Get Started
        </button>
      </div>
    </section>
  );
}
