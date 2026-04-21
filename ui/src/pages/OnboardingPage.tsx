import { useEffect, useState } from "react";
import { realApi } from "../api/realApi";
import { GENRES, MOODS } from "../types/movie";
import type { Movie, User } from "../types/movie";

interface OnboardingPageProps {
  onComplete: (user: User) => void;
}

const RUNTIME_OPTIONS = [
  { label: "Any length", value: 0 },
  { label: "Under 90 min", value: 80 },
  { label: "90 – 120 min", value: 105 },
  { label: "120 – 150 min", value: 135 },
  { label: "150 min +", value: 170 },
];

const DECADE_OPTIONS = [
  { label: "Classic (pre-1980)", low: 1900, high: 1979 },
  { label: "80s – 90s", low: 1980, high: 1999 },
  { label: "2000s", low: 2000, high: 2009 },
  { label: "2010s", low: 2010, high: 2019 },
  { label: "2020s", low: 2020, high: 2029 },
];

const TOTAL_STEPS = 5;

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

  // step 2 — film anchors (now stores full Movie objects for display)
  const [likedMovies, setLikedMovies] = useState<Movie[]>([]);
  const [dislikedMovies, setDislikedMovies] = useState<Movie[]>([]);
  const [likedQuery, setLikedQuery] = useState("");
  const [dislikedQuery, setDislikedQuery] = useState("");
  const [likedOptions, setLikedOptions] = useState<Movie[]>([]);
  const [dislikedOptions, setDislikedOptions] = useState<Movie[]>([]);
  const [loadingLiked, setLoadingLiked] = useState(false);
  const [loadingDisliked, setLoadingDisliked] = useState(false);

  // step 3 — preferences
  const [runtimePref, setRuntimePref] = useState(0);
  const [selectedDecades, setSelectedDecades] = useState<number[]>([]);

  // step 4 — mood
  const [mood, setMood] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function toggleGenre(g: string) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  function toggleDecade(idx: number) {
    setSelectedDecades((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  }

  function validateStep0() {
    if (!name.trim() || !email.trim() || !password) return false;
    if (password !== confirm) { setPwError("Passwords don't match."); return false; }
    if (password.length < 8) { setPwError("Password must be at least 8 characters."); return false; }
    setPwError("");
    return true;
  }

  // debounced search for liked movies
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!likedQuery.trim()) { setLikedOptions([]); return; }
      setLoadingLiked(true);
      const selectedIds = new Set(likedMovies.map((m) => m.id));
      realApi.searchMovies(likedQuery)
        .then((movies) => setLikedOptions(movies.filter((m) => !selectedIds.has(m.id)).slice(0, 8)))
        .finally(() => setLoadingLiked(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [likedQuery, likedMovies]);

  // debounced search for disliked movies
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!dislikedQuery.trim()) { setDislikedOptions([]); return; }
      setLoadingDisliked(true);
      const selectedIds = new Set(dislikedMovies.map((m) => m.id));
      realApi.searchMovies(dislikedQuery)
        .then((movies) => setDislikedOptions(movies.filter((m) => !selectedIds.has(m.id)).slice(0, 8)))
        .finally(() => setLoadingDisliked(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [dislikedQuery, dislikedMovies]);

  function addMovie(target: "liked" | "disliked", movie: Movie) {
    if (target === "liked") {
      if (likedMovies.some((m) => m.id === movie.id) || likedMovies.length >= 3) return;
      setLikedMovies((prev) => [...prev, movie]);
      setLikedQuery("");
      setLikedOptions([]);
    } else {
      if (dislikedMovies.some((m) => m.id === movie.id) || dislikedMovies.length >= 3) return;
      setDislikedMovies((prev) => [...prev, movie]);
      setDislikedQuery("");
      setDislikedOptions([]);
    }
  }

  function removeMovie(target: "liked" | "disliked", id: number) {
    if (target === "liked") {
      setLikedMovies((prev) => prev.filter((m) => m.id !== id));
    } else {
      setDislikedMovies((prev) => prev.filter((m) => m.id !== id));
    }
  }

  async function finish() {
    setSubmitting(true);
    setSubmitError("");
    try {
      // compute decade range from selected decades
      let decadeLow: number | undefined;
      let decadeHigh: number | undefined;
      if (selectedDecades.length > 0) {
        const decades = selectedDecades.map((i) => DECADE_OPTIONS[i]);
        decadeLow = Math.min(...decades.map((d) => d.low));
        decadeHigh = Math.max(...decades.map((d) => d.high));
      }

      const user = await realApi.onboardUser({
        name,
        email,
        password,
        genres,
        mood,
        likedMovieIds: likedMovies.map((m) => m.id),
        dislikedMovieIds: dislikedMovies.map((m) => m.id),
        runtimePref: runtimePref || undefined,
        decadeLow,
        decadeHigh,
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
      <div className="onboard-card fade-in">
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
            <div className="onboard-title">Pick films you have opinions about</div>
            <div className="onboard-subtitle">
              Search our catalog and select movies you loved or didn't enjoy.
            </div>

            {/* liked movies */}
            <div style={{ marginBottom: 24 }}>
              <div className="form-label" style={{ marginBottom: 12, color: "var(--accent)" }}>✦ Movies you loved (up to 3)</div>
              <div className="form-group">
                <input
                  className="form-input"
                  value={likedQuery}
                  placeholder={likedMovies.length >= 3 ? "max 3 selected" : "search by movie title…"}
                  onChange={(e) => setLikedQuery(e.target.value)}
                  disabled={likedMovies.length >= 3}
                />
              </div>
              {loadingLiked && likedQuery && <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>searching…</div>}
              {likedOptions.length > 0 && (
                <div className="picker-grid" style={{ marginBottom: 12 }}>
                  {likedOptions.map((movie) => (
                    <button key={`liked-opt-${movie.id}`} className="picker-card" onClick={() => addMovie("liked", movie)}>
                      {movie.poster ? (
                        <img src={movie.poster} alt={movie.title} className="picker-poster" />
                      ) : (
                        <div className="picker-poster-placeholder">🎬</div>
                      )}
                      <div className="picker-info">
                        <div className="picker-title">{movie.title}</div>
                        <div className="picker-year">{movie.year || "—"}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="picked-row">
                {likedMovies.map((movie) => (
                  <div key={`liked-${movie.id}`} className="picked-chip" onClick={() => removeMovie("liked", movie.id)}>
                    {movie.poster ? (
                      <img src={movie.poster} alt={movie.title} className="picked-poster" />
                    ) : (
                      <div className="picked-poster-placeholder">🎬</div>
                    )}
                    <span className="picked-title">{movie.title}</span>
                    <span className="picked-remove">×</span>
                  </div>
                ))}
              </div>
            </div>

            {/* disliked movies */}
            <div style={{ marginBottom: 24 }}>
              <div className="form-label" style={{ marginBottom: 12, color: "var(--red)" }}>✦ Movies you didn't enjoy (up to 3)</div>
              <div className="form-group">
                <input
                  className="form-input"
                  value={dislikedQuery}
                  placeholder={dislikedMovies.length >= 3 ? "max 3 selected" : "search by movie title…"}
                  onChange={(e) => setDislikedQuery(e.target.value)}
                  disabled={dislikedMovies.length >= 3}
                />
              </div>
              {loadingDisliked && dislikedQuery && <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>searching…</div>}
              {dislikedOptions.length > 0 && (
                <div className="picker-grid" style={{ marginBottom: 12 }}>
                  {dislikedOptions.map((movie) => (
                    <button key={`disliked-opt-${movie.id}`} className="picker-card" onClick={() => addMovie("disliked", movie)}>
                      {movie.poster ? (
                        <img src={movie.poster} alt={movie.title} className="picker-poster" />
                      ) : (
                        <div className="picker-poster-placeholder">🎬</div>
                      )}
                      <div className="picker-info">
                        <div className="picker-title">{movie.title}</div>
                        <div className="picker-year">{movie.year || "—"}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="picked-row">
                {dislikedMovies.map((movie) => (
                  <div key={`disliked-${movie.id}`} className="picked-chip picked-chip-disliked" onClick={() => removeMovie("disliked", movie.id)}>
                    {movie.poster ? (
                      <img src={movie.poster} alt={movie.title} className="picked-poster" />
                    ) : (
                      <div className="picked-poster-placeholder">🎬</div>
                    )}
                    <span className="picked-title">{movie.title}</span>
                    <span className="picked-remove">×</span>
                  </div>
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

        {/* ── step 3 — preferences ── */}
        {step === 3 && (
          <>
            <div className="onboard-title">Fine-tune your taste</div>
            <div className="onboard-subtitle">
              These help us filter better — skip anything you don't care about.
            </div>

            <div style={{ marginBottom: 28 }}>
              <div className="form-label" style={{ marginBottom: 12 }}>Preferred runtime</div>
              <div className="pref-options">
                {RUNTIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`pref-chip ${runtimePref === opt.value ? "sel" : ""}`}
                    onClick={() => setRuntimePref(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <div className="form-label" style={{ marginBottom: 12 }}>Favorite eras</div>
              <div className="pref-options">
                {DECADE_OPTIONS.map((opt, idx) => (
                  <button
                    key={opt.label}
                    className={`pref-chip ${selectedDecades.includes(idx) ? "sel" : ""}`}
                    onClick={() => toggleDecade(idx)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setStep(4)}>
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ── step 4 — mood ── */}
        {step === 4 && (
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
            {submitError && (
              <div style={{ fontSize: 13, color: "var(--red)", marginBottom: 12, padding: "10px 14px", background: "rgba(232,85,85,0.08)", borderRadius: "var(--radius)", border: "1px solid rgba(232,85,85,0.2)" }}>
                {submitError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(3)}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
                disabled={submitting || !mood}
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
