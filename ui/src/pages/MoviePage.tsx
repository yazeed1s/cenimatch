import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MovieCard from "../components/MovieCard";
import { realApi as api } from "../api/realApi";
import type { MovieCrewMember } from "../api/realApi";
import { MOODS } from "../types/movie";
import type { Movie, GraphRelatedMovies } from "../types/movie";

export default function MoviePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [crew, setCrew] = useState<MovieCrewMember[]>([]);
  const [graphRelated, setGraphRelated] = useState<GraphRelatedMovies | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setRelatedLoading(true);
    setRating(0);
    setCrew([]);
    setGraphRelated(null);

    api.getMovieById(Number(id))
      .then((mv) => { if (cancelled) return; setMovie(mv); })
      .finally(() => { if (!cancelled) setLoading(false); });

    api.getMovieCrew(Number(id))
      .then((data) => { if (cancelled) return; setCrew(data.members ?? []); })
      .catch(() => { if (!cancelled) setCrew([]); });

    api.getGraphRelatedMovies(Number(id))
      .then((rel) => { if (cancelled) return; setGraphRelated(rel); })
      .finally(() => { if (!cancelled) setRelatedLoading(false); });

    api.getUserFeedback(Number(id))
      .then((fb) => {
        if (cancelled || !fb) return;
        if (fb.not_interested || fb.rating === null) {
          setRating(0);
          return;
        }
        setRating(Math.max(0, Math.min(5, Math.round(fb.rating))));
      });

    return () => { cancelled = true; };
  }, [id]);

  async function handleRate(val: number) {
    if (!id) return;
    const previous = rating;
    setRating(val);
    const res = await api.submitFeedback(Number(id), val);
    if (res.success) {
      showToast(`Rated ${val}/5 — similar-user recommendations will update.`, "success");
      return;
    }
    setRating(previous);
    showToast("Could not save rating. Please try again.", "error");
  }

  async function handleNotInterested() {
    if (!id) return;
    const res = await api.markNotInterested(Number(id));
    if (res.success) {
      setRating(0);
      showToast("Excluded from similar-user recommendations.", "info");
      return;
    }
    showToast("Could not update preference. Please try again.", "error");
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
  const directorCrew = crew.filter(m => m.role === "director");
  const producerCrew = crew.filter(m => m.role === "producer" || m.job?.toLowerCase().includes("producer") || m.job?.toLowerCase().includes("executive"));
  const otherCrew = crew.filter(m => m.role !== "actor" && m.role !== "director" && !(m.role === "producer" || m.job?.toLowerCase().includes("producer") || m.job?.toLowerCase().includes("executive")));
  const directorName = directorCrew.length > 0 ? directorCrew.map((d) => d.name).join(", ") : movie.director;

  function formatRoleString(role?: string | null) {
    if (!role) return "";
    try {
      const parsed = JSON.parse(role);
      if (Array.isArray(parsed)) return parsed.join(", ");
      return String(parsed);
    } catch {
      return role;
    }
  }

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
            <div className="movie-poster-lg">
              {movie.poster ? (
                <img src={movie.poster} alt={movie.title} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div style={{ width: "100%", aspectRatio: "2/3", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60 }}>🎬</div>
              )}
            </div>

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
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>{directorCrew.length > 1 ? "Directors" : "Director"}</div>
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
            <button className="btn btn-ghost btn-sm" onClick={handleNotInterested}>
              <XIcon /> Exclude from recs
            </button>
          </div>
        </div>

        {/* ── Cast & Crew ── */}
        <div className="cast-section">
          <div className="cast-columns">
            {(directorCrew.length > 0 || producerCrew.length > 0) && (
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Directors & Producers</div>
                <div className="cast-grid">
                  {directorCrew.map((member, i) => (
                    <div key={`dir-${member.name}-${i}`} className="cast-card fade-in" style={{ borderLeft: "3px solid var(--accent)" }}>
                      <img src={`https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(member.name)}&backgroundColor=transparent`} alt="" className="cast-avatar" />
                      <div className="cast-info">
                        <div className="cast-name">{member.name}</div>
                        <div className="cast-role">{formatRoleString(member.job || member.role)}</div>
                      </div>
                    </div>
                  ))}
                  {producerCrew.map((member, i) => (
                    <div key={`prod-${member.name}-${i}`} className="cast-card fade-in" style={{ borderLeft: "3px solid #a3e635" }}>
                      <img src={`https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(member.name)}&backgroundColor=transparent`} alt="" className="cast-avatar" />
                      <div className="cast-info">
                        <div className="cast-name">{member.name}</div>
                        <div className="cast-role">{formatRoleString(member.job || member.role)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {actorCrew.length > 0 && (
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Cast</div>
                <div className="cast-grid">
                  {actorCrew.map((member, i) => (
                    <div key={`act-${member.name}-${i}`} className="cast-card fade-in">
                      <img src={`https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(member.name)}&backgroundColor=transparent`} alt="" className="cast-avatar" />
                      <div className="cast-info">
                        <div className="cast-name">{member.name}</div>
                        <div className="cast-role">{formatRoleString(member.character) || "Actor"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {otherCrew.length > 0 && (
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Other Crew</div>
                <div className="cast-grid">
                  {otherCrew.map((member, i) => (
                    <div key={`oth-${member.name}-${i}`} className="cast-card fade-in">
                      <img src={`https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(member.name)}&backgroundColor=transparent`} alt="" className="cast-avatar" />
                      <div className="cast-info">
                        <div className="cast-name">{member.name}</div>
                        <div className="cast-role">{formatRoleString(member.job || member.role)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="divider" />

        {/* ── Related via Graph ── */}
        <div className="section-sm">
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>You Might Also Like</div>
            <div style={{ fontSize: 13, color: "var(--text3)" }}>
              Discovered via Apache AGE graph traversal
            </div>
          </div>
          {relatedLoading ? (
            <div style={{ fontSize: 13, color: "var(--text3)" }}>loading related movies...</div>
          ) : !graphRelated ? (
            <div style={{ fontSize: 13, color: "var(--text3)" }}>no related movies found yet.</div>
          ) : (
            <>
              {graphRelated.same_director && graphRelated.same_director.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 15, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--text2)" }}>Connected by Director</h3>
                  <div className="movie-scroller">
                    {graphRelated.same_director.map((m) => (
                      <MovieCard key={m.id} movie={m} onClick={(mv) => navigate(`/movie/${mv.id}`)} />
                    ))}
                  </div>
                </div>
              )}
              {graphRelated.same_actors && graphRelated.same_actors.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 15, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--text2)" }}>Connected by Cast</h3>
                  <div className="movie-scroller">
                    {graphRelated.same_actors.map((m) => (
                      <MovieCard key={m.id} movie={m} onClick={(mv) => navigate(`/movie/${mv.id}`)} />
                    ))}
                  </div>
                </div>
              )}
              {graphRelated.similar_theme && graphRelated.similar_theme.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 15, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--text2)" }}>Similar Themes & Genres</h3>
                  <div className="movie-scroller">
                    {graphRelated.similar_theme.map((m) => (
                      <MovieCard key={m.id} movie={m} onClick={(mv) => navigate(`/movie/${mv.id}`)} />
                    ))}
                  </div>
                </div>
              )}
            </>
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
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
