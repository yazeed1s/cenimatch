import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MovieCard from "../components/MovieCard";
import { realApi as api } from "../api/realApi";
import type { MovieCrewMember } from "../api/realApi";
import { MOODS } from "../types/movie";
import type { Movie } from "../types/movie";

export default function MoviePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [crew, setCrew] = useState<MovieCrewMember[]>([]);
  const [related, setRelated] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [liked, setLiked] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setRelatedLoading(true);
    setRating(0);
    setLiked(false);
    setCrew([]);
    setRelated([]);

    api.getMovieById(Number(id))
      .then((mv) => {
        if (cancelled) return;
        setMovie(mv);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    api.getMovieCrew(Number(id))
      .then((data) => {
        if (cancelled) return;
        setCrew(data.members ?? []);
      })
      .catch(() => {
        if (!cancelled) setCrew([]);
      });

    api.getRelatedMovies(Number(id))
      .then((rel) => {
        if (cancelled) return;
        setRelated(rel);
      })
      .finally(() => {
        if (!cancelled) setRelatedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleRate(val: number) {
    setRating(val);
    await api.submitFeedback(Number(id), val);
    showToast(`Rated ${val}/5 — your recommendations will improve!`, "success");
  }

  function showToast(msg: string, type: string) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  if (loading) {
    return <div className="loading-center" style={{ paddingTop: 120 }}><div className="spinner" /></div>;
  }
  if (!movie) {
    return (
      <div className="empty-state" style={{ paddingTop: 120 }}>
        <div className="empty-title">Movie not found.</div>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>← Go back</button>
      </div>
    );
  }

  const displayRating = movie.rating.toFixed(1);

  const actorCrew = crew.filter((member) => member.role === "actor");
  const nonActorCrew = crew.filter((member) => member.role !== "actor");
  const directorName = crew.find((member) => member.role === "director")?.name || movie.director;

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── Cinematic hero ── */}
      <div className="movie-hero">
        <div className="movie-hero-bg">
          {movie.poster && <img src={movie.poster} alt="" />}
        </div>
        <div className="container" style={{ width: "100%" }}>
          <div className="movie-hero-content">
            {/* Poster */}
            <div className="movie-poster-lg">
              {movie.poster ? (
                <img src={movie.poster} alt={movie.title} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div style={{ width: "100%", aspectRatio: "2/3", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60 }}>🎬</div>
              )}
            </div>

            {/* Info */}
            <div className="movie-info-main">
              <div className="movie-meta-row">
                {movie.genre.map((g) => <span key={g} className="tag tag-accent">{g}</span>)}
              </div>
              <h1 className="movie-title-lg">{movie.title}</h1>
              <div className="movie-meta-row">
                <div className="movie-rating-lg">
                  <StarIcon filled size={22} /> {displayRating}
                  <small>/10</small>
                </div>
                <span className="meta-sep">·</span>
                <span>{movie.year}</span>
                <span className="meta-sep">·</span>
                <span>{movie.runtime} min</span>
                <span className="meta-sep">·</span>
                <span>{movie.language}</span>
                <span className="meta-sep">·</span>
                <span style={{ background: "var(--surface)", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{movie.mpaa}</span>
              </div>
              <p className="movie-plot">{movie.plot}</p>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>Director</div>
                <div style={{ fontSize: 15 }}>{directorName}</div>
              </div>
              {movie.mood.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  {movie.mood.map((m) => (
                    <span key={m} className="tag tag-accent">
                      {MOODS.find((x) => x.label === m)?.emoji} {m}
                    </span>
                  ))}
                </div>
              )}
              <div className="movie-actions">
                <button className="btn btn-primary"><PlayIcon /> Watch Trailer</button>
                <button className={`heart-btn ${liked ? "active" : ""}`} style={{ width: 40, height: 40 }} onClick={() => setLiked(!liked)}>
                  <HeartIcon filled={liked} />
                </button>
                <button className="btn btn-ghost btn-sm">+ Watchlist</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        {/* ── Feedback ── */}
        <div style={{ padding: "32px 0 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>Rate this film</div>
            <StarRating value={rating} onChange={handleRate} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>Not interested?</div>
            <button className="btn btn-ghost btn-sm" onClick={() => showToast("Got it — excluded from future recommendations.", "info")}>
              <XIcon /> Exclude from recs
            </button>
          </div>
        </div>

        {/* ── Cast ── */}
        <div className="cast-section">
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Cast</div>
          <div className="cast-grid">
            {actorCrew.map((member, i) => (
              <div key={`${member.name}-${i}`} className="cast-card fade-in">
                <div className="cast-avatar">{["🎭", "🎬", "⭐"][i % 3]}</div>
                <div className="cast-name">{member.name}</div>
                <div className="cast-role">{member.character || "Actor"}</div>
              </div>
            ))}
            {nonActorCrew.map((member, i) => (
              <div key={`${member.role}-${member.name}-${i}`} className="cast-card fade-in">
                <div className="cast-avatar">🎥</div>
                <div className="cast-name">{member.name}</div>
                <div className="cast-role">{member.job || member.role}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="divider" />

        {/* ── Related via Graph ── */}
        <div className="section-sm">
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>You Might Also Like</div>
            <div style={{ fontSize: 13, color: "var(--text3)" }}>
              Discovered via Apache AGE graph traversal — shared director, cast &amp; thematic similarity
            </div>
          </div>
          {relatedLoading ? (
            <div style={{ fontSize: 13, color: "var(--text3)" }}>loading related movies...</div>
          ) : related.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text3)" }}>no related movies found yet.</div>
          ) : (
            <div className="movie-scroller">
              {related.map((m) => (
                <MovieCard key={m.id} movie={m} onClick={(mv) => navigate(`/movie/${mv.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: string }) {
  return <div className={`toast toast-${type}`}>{msg}</div>;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`star ${i <= (hover || value) ? "filled" : ""}`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
        >★</span>
      ))}
    </div>
  );
}

// ── Inline icons ──────────────────────────────────────────────────────────────

function StarIcon({ filled, size = 16 }: { filled?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "#e85555" : "none"} stroke={filled ? "#e85555" : "currentColor"} strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
function PlayIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>;
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
