import { useEffect, useState } from "react";
import { mockApi } from "../api/mockApi";
import { realApi } from "../api/realApi";
import { GENRES, MOODS } from "../types/movie";
import type { Movie, User } from "../types/movie";

const api = mockApi; // ← swap to realApi when backend is ready

interface OnboardingPageProps {
  onComplete: (user: User) => void;
}

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [likedMovies, setLikedMovies] = useState<string[]>([]);
  const [dislikedMovies, setDislikedMovies] = useState<string[]>([]);
  const [likedQuery, setLikedQuery] = useState("");
  const [dislikedQuery, setDislikedQuery] = useState("");
  const [likedOptions, setLikedOptions] = useState<Movie[]>([]);
  const [dislikedOptions, setDislikedOptions] = useState<Movie[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [mood, setMood] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleGenre(g: string) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  function validateStep0() {
    if (!name.trim() || !email.trim() || !password) return false;
    if (password !== confirm) { setPwError("Passwords don't match."); return false; }
    if (password.length < 8) { setPwError("Password must be at least 8 characters."); return false; }
    setPwError("");
    return true;
  }

  async function finish() {
    setSubmitting(true);
    try {
      const user = await api.onboardUser({
        name, email, password, genres, mood,
        likedMovies,
        dislikedMovies,
      });
      onComplete(user);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!likedQuery.trim()) {
        setLikedOptions([]);
        return;
      }
      setLoadingOptions(true);
      realApi.searchMovies(likedQuery)
        .then((movies) => {
          setLikedOptions(movies.filter((movie) => !likedMovies.includes(movie.title)).slice(0, 8));
        })
        .finally(() => setLoadingOptions(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [likedQuery, likedMovies]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!dislikedQuery.trim()) {
        setDislikedOptions([]);
        return;
      }
      setLoadingOptions(true);
      realApi.searchMovies(dislikedQuery)
        .then((movies) => {
          setDislikedOptions(movies.filter((movie) => !dislikedMovies.includes(movie.title)).slice(0, 8));
        })
        .finally(() => setLoadingOptions(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [dislikedQuery, dislikedMovies]);

  function addMovie(target: "liked" | "disliked", title: string) {
    if (target === "liked") {
      if (likedMovies.includes(title) || likedMovies.length >= 3) return;
      setLikedMovies((prev) => [...prev, title]);
      setLikedQuery("");
      setLikedOptions([]);
      return;
    }
    if (dislikedMovies.includes(title) || dislikedMovies.length >= 2) return;
    setDislikedMovies((prev) => [...prev, title]);
    setDislikedQuery("");
    setDislikedOptions([]);
  }

  function removeMovie(target: "liked" | "disliked", title: string) {
    if (target === "liked") {
      setLikedMovies((prev) => prev.filter((item) => item !== title));
      return;
    }
    setDislikedMovies((prev) => prev.filter((item) => item !== title));
  }

  return (
    <div className="onboard-wrap">
      <div className="onboard-card fade-in">
        <div className="progress-dots">
          {[0, 1, 2, 3].map((i) => <div key={i} className={`dot ${i <= step ? "active" : ""}`} />)}
        </div>

        {/* ── Step 0 — Account ── */}
        {step === 0 && (
          <>
            <div className="onboard-title">Welcome to CineMatch</div>
            <div className="onboard-subtitle">
              Create your account so we can personalise recommendations from day one.
            </div>
            <div className="form-group">
              <label className="form-label">Your name</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" />
            </div>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <input className="form-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" />
              {pwError && <div style={{ fontSize: 13, color: "var(--red)", marginTop: 6 }}>{pwError}</div>}
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => { if (validateStep0()) setStep(1); }}
            >
              Continue →
            </button>
          </>
        )}

        {/* ── Step 1 — Genres ── */}
        {step === 1 && (
          <>
            <div className="onboard-title">What genres do you love?</div>
            <div className="onboard-subtitle">Pick all that apply — we use this to tune your recommendations.</div>
            <div className="genre-picker">
              {GENRES.map((g) => (
                <button key={g} className={`genre-chip ${genres.includes(g) ? "sel" : ""}`} onClick={() => toggleGenre(g)}>{g}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={genres.length === 0} onClick={() => setStep(2)}>
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2 — Film anchors ── */}
        {step === 2 && (
          <>
            <div className="onboard-title">Pick films you have opinions about</div>
            <div className="onboard-subtitle">
              Search our catalog and pick titles directly from your dataset.
            </div>
            <div style={{ marginBottom: 24 }}>
              <div className="form-label" style={{ marginBottom: 12, color: "var(--accent)" }}>✦ Movies you loved</div>
              <div className="form-group">
                <input
                  className="form-input"
                  value={likedQuery}
                  placeholder={likedMovies.length >= 3 ? "max 3 selected" : "search by movie title"}
                  onChange={(e) => setLikedQuery(e.target.value)}
                  disabled={likedMovies.length >= 3}
                />
              </div>
              {likedOptions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {likedOptions.map((movie) => (
                    <button
                      key={`liked-${movie.id}`}
                      className="btn btn-ghost btn-sm"
                      style={{ justifyContent: "space-between" }}
                      onClick={() => addMovie("liked", movie.title)}
                    >
                      <span>{movie.title} ({movie.year})</span>
                      <span>add</span>
                    </button>
                  ))}
                </div>
              )}
              {loadingOptions && likedQuery && <div style={{ fontSize: 12, color: "var(--text3)" }}>searching...</div>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {likedMovies.map((title) => (
                  <button key={title} className="tag tag-accent" onClick={() => removeMovie("liked", title)}>
                    {title} ×
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div className="form-label" style={{ marginBottom: 12, color: "var(--red)" }}>✦ Movies you didn't enjoy</div>
              <div className="form-group">
                <input
                  className="form-input"
                  value={dislikedQuery}
                  placeholder={dislikedMovies.length >= 2 ? "max 2 selected" : "search by movie title"}
                  onChange={(e) => setDislikedQuery(e.target.value)}
                  disabled={dislikedMovies.length >= 2}
                />
              </div>
              {dislikedOptions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {dislikedOptions.map((movie) => (
                    <button
                      key={`disliked-${movie.id}`}
                      className="btn btn-ghost btn-sm"
                      style={{ justifyContent: "space-between" }}
                      onClick={() => addMovie("disliked", movie.title)}
                    >
                      <span>{movie.title} ({movie.year})</span>
                      <span>add</span>
                    </button>
                  ))}
                </div>
              )}
              {loadingOptions && dislikedQuery && <div style={{ fontSize: 12, color: "var(--text3)" }}>searching...</div>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {dislikedMovies.map((title) => (
                  <button key={title} className="tag" onClick={() => removeMovie("disliked", title)}>
                    {title} ×
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setStep(3)}>
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ── Step 3 — Mood ── */}
        {step === 3 && (
          <>
            <div className="onboard-title">What's your current vibe?</div>
            <div className="onboard-subtitle">
              Sets your default mood for recommendations. You can always change this later.
            </div>
            <div className="mood-pills" style={{ flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {MOODS.map((m) => (
                <button
                  key={m.label}
                  className={`mood-pill ${mood === m.label ? "active" : ""}`}
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => setMood(m.label)}
                >
                  <span className="mood-pill-emoji">{m.emoji}</span> {m.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
                disabled={submitting || !mood}
                onClick={finish}
              >
                {submitting ? "Setting up..." : "Get My Recommendations ✦"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
