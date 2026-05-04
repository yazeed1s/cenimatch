import { useEffect, useState } from "react";
import { realApi } from "../api/realApi";
import { GENRES } from "../types/movie";
import type { Movie, User } from "../types/movie";

interface OnboardingPageProps {
  onComplete: (user: User) => void;
}

const TOTAL_STEPS = 3;
const DEFAULT_ONBOARDING_MOOD = "Thought-Provoking";

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState(0);

  // step 0 — account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState("");

  // step 1 — genres
  const [genres, setGenres] = useState<string[]>([]);

  // step 2 — film anchors
  const [likedMovies, setLikedMovies] = useState<Movie[]>([]);
  const [dislikedMovies, setDislikedMovies] = useState<Movie[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  // --- step 2 filtering & pagination ---
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pickerGenre, setPickerGenre] = useState("");
  const [pickerOffset, setPickerOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(pickerQuery), 300);
    return () => clearTimeout(timer);
  }, [pickerQuery]);

  async function loadMovies(reset: boolean) {
    if (step !== 2) return;
    setLoadingPopular(true);
    const targetOffset = reset ? 0 : pickerOffset;

    try {
      const movies = await realApi.listMovies(24, targetOffset, debouncedQuery, pickerGenre);
      setHasMore(movies.length === 24);
      if (reset) {
        setPopularMovies(movies);
        setPickerOffset(movies.length);
      } else {
        setPopularMovies((prev) => {
          const existingIds = new Set(prev.map(m => m.id));
          const additions = movies.filter(m => !existingIds.has(m.id));
          return [...prev, ...additions];
        });
        setPickerOffset(targetOffset + movies.length);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPopular(false);
    }
  }

  useEffect(() => {
    if (step === 2) {
      loadMovies(true);
    }
  }, [step, debouncedQuery, pickerGenre]);

  function setMovieOpinion(movie: Movie, opinion: "like" | "dislike") {
    if (opinion === "like") {
      setDislikedMovies(prev => prev.filter(m => m.id !== movie.id));
      setLikedMovies(prev => {
        if (prev.some(m => m.id === movie.id)) return prev.filter(m => m.id !== movie.id);
        if (prev.length >= 10) return prev;
        return [...prev, movie];
      });
    } else {
      setLikedMovies(prev => prev.filter(m => m.id !== movie.id));
      setDislikedMovies(prev => {
        if (prev.some(m => m.id === movie.id)) return prev.filter(m => m.id !== movie.id);
        if (prev.length >= 10) return prev;
        return [...prev, movie];
      });
    }
  }

  async function finish() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const user = await realApi.onboardUser({
        name,
        email,
        password,
        genres,
        mood: DEFAULT_ONBOARDING_MOOD,
        likedMovieIds: likedMovies.map((m) => m.id),
        dislikedMovieIds: dislikedMovies.map((m) => m.id),
      });
      onComplete(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "something went wrong";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="onboard-wrap">
      <div className={`onboard-card fade-in ${step === 2 ? "wide" : ""}`}>
        <div className="progress-dots">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className={`dot ${i <= step ? "active" : ""}`} />
          ))}
        </div>

        {/* ── step 0 — account ── */}
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

        {/* ── step 1 — genres ── */}
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

        {/* ── step 2 — film anchors with poster picker ── */}
        {step === 2 && (
          <>
            <div className="onboard-title">Pick films you love (or hate)</div>
            <div className="onboard-subtitle">
              Select movies to jumpstart your recommendations. Hover over a poster to like (👍) or dislike (👎).
            </div>

            <div className="picker-toolbar">
              <input 
                className="picker-toolbar-input" 
                placeholder="Search movies by title..." 
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
              />
              <div className="picker-genres">
                <button 
                  className={`picker-genre ${pickerGenre === "" ? "active" : ""}`}
                  onClick={() => setPickerGenre("")}
                >All</button>
                {GENRES.map(g => (
                  <button 
                    key={`filt-${g}`}
                    className={`picker-genre ${pickerGenre === g ? "active" : ""}`}
                    onClick={() => setPickerGenre(g)}
                  >{g}</button>
                ))}
              </div>
            </div>

            <div className="picker-grid" style={{ marginBottom: 24, maxHeight: "560px", overflowY: "auto", padding: "4px" }}>
              {popularMovies.map((movie) => {
                const isLiked = likedMovies.some((m) => m.id === movie.id);
                const isDisliked = dislikedMovies.some((m) => m.id === movie.id);
                
                let cardClass = "";
                if (isLiked) cardClass = "liked";
                else if (isDisliked) cardClass = "disliked";

                return (
                  <div key={`pop-${movie.id}`} className={`picker-card ${cardClass}`}>
                    <div className="picker-actions">
                      <button className="picker-btn btn-like" onClick={() => setMovieOpinion(movie, "like")}>👍</button>
                      <button className="picker-btn btn-dislike" onClick={() => setMovieOpinion(movie, "dislike")}>👎</button>
                    </div>
                    {movie.poster ? (
                      <img src={movie.poster} alt={movie.title} className="picker-poster" />
                    ) : (
                      <div className="picker-poster-placeholder">🎬</div>
                    )}
                    <div className="picker-info">
                      <div className="picker-title">{movie.title}</div>
                      <div className="picker-year">{movie.year || "—"}</div>
                    </div>
                  </div>
                );
              })}
              
              {loadingPopular && (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)", gridColumn: "1 / -1" }}>
                  Loading movies...
                </div>
              )}
              
              {hasMore && !loadingPopular && popularMovies.length > 0 && (
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", padding: "20px 0" }}>
                  <button className="btn btn-ghost" onClick={() => loadMovies(false)}>Load More</button>
                </div>
              )}
            </div>

            {submitError && (
              <div style={{ fontSize: 13, color: "var(--red)", marginBottom: 12, padding: "10px 14px", background: "rgba(232,85,85,0.08)", borderRadius: "var(--radius)", border: "1px solid rgba(232,85,85,0.2)" }}>
                {submitError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
                disabled={submitting}
                onClick={finish}
              >
                {submitting ? "Setting up…" : "Get My Recommendations ✦"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
