import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MovieCard from "../components/MovieCard";
import MoodSelector from "../components/MoodSelector";
import { realApi as api } from "../api/realApi";
import type { Movie, User } from "../types/movie";


interface HomePageProps {
  user: User | null;
}

export default function HomePage({ user }: HomePageProps) {
  const [mood, setMood] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Movie[]>([]);
  const [graphRecs, setGraphRecs] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    let catalogPromise = api.listMovies(50).then(movies => setCatalog(movies)).catch(() => setCatalog([]));

    // Only fetch graph recommendations if a user exists
    if (user) {
      api.getGraphUserRecommendations()
        .then(recs => setGraphRecs(recs))
        .catch(() => setGraphRecs([]))
        .finally(() => setLoading(false));
    } else {
      catalogPromise.finally(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLocation({ lat, lon });
        api.sendLocation(lat, lon);
      },
      (error) => {
        console.warn("Location permission denied or unavailable:", error.message);
      }
    );
  }, []);

const trending = useMemo(() => catalog, [catalog]);
const topRated = useMemo(() => [...catalog].sort((a, b) => b.rating - a.rating), [catalog]);
  const recs = useMemo(() => {
    if (!mood) return catalog.slice(0, 20);
    const moodKey = mood.toLowerCase().replace(/[\s-]/g, "_");
    const filtered = catalog.filter((movie) =>
      movie.mood.some((value) => value.toLowerCase().replace(/[\s-]/g, "_") === moodKey),
    );
    return (filtered.length ? filtered : catalog).slice(0, 20);
  }, [catalog, mood]);

  return (
    <div>
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="container" style={{ width: "100%" }}>
          <div className="hero-content fade-in">
            <div className="hero-eyebrow">Personalized for you</div>
            <h1 className="hero-title">
              Films that <em>find</em>
              <br />
              you first.
            </h1>
            <p className="hero-subtitle">
              CineMatch learns your taste from day one — through your mood, your history, and the
              films you already love. No cold starts, no generic suggestions.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => navigate("/search")}>
                <SearchIcon size={15} /> Discover Films
              </button>
              
            </div>
                      </div>
          <div className="hero-stats fade-in fade-in-delay-2">
            <div>
              <div className="hero-stat-num">100K+</div>
              <div className="hero-stat-label">Films indexed</div>
            </div>
            <div>
              <div className="hero-stat-num">4</div>
              <div className="hero-stat-label">Data sources</div>
            </div>
            <div>
              <div className="hero-stat-num">AI</div>
              <div className="hero-stat-label">Powered ranking</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mood bar ── */}
      <MoodSelector activeMood={mood} onChange={setMood} />

      <div className="container">
        {/* ── Recommendations ── */}
        <div className="section">
          <div className="row-header fade-in">
            <div>
              <div className="row-title">
                {mood ? `${mood} Picks for You` : "Recommended for You"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
                Ranked by XGBoost · personalised to your profile
                {mood && ` · filtered by mood: ${mood}`}
              </div>
            </div>
            {mood && (
              <button className="btn btn-ghost btn-sm" onClick={() => setMood(null)}>
                <XIcon /> Clear mood
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : (
            <>
              {user && graphRecs.length > 0 && (
                <div style={{ marginBottom: 40 }}>
                  <div className="row-title" style={{ marginBottom: 12, fontSize: 18, color: "var(--accent)" }}>
                    Discovered via Graph Traversal
                  </div>
                  <div className="movie-scroller">
                    {graphRecs.map((m) => (
                      <MovieCard key={`graph-${m.id}`} movie={m} onClick={(mv) => navigate(`/movie/${mv.id}`)} />
                    ))}
                  </div>
                </div>
              )}

              <div className="row-title" style={{ marginBottom: 12, fontSize: 18 }}>
                General Recommendations
              </div>
              <div className="results-grid">
                {recs.map((m, i) => (
                  <MovieCard
                    key={`gen-${m.id}`}
                    movie={m}
                    onClick={(mv) => navigate(`/movie/${mv.id}`)}
                    showExplanation={i < 5}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="divider" />

        {/* ── Trending ── */}
        <div className="section-sm">
          <div className="row-header">
            <div className="row-title fade-in">Trending This Week</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/search")}>
              View all <ChevronRight />
            </button>
          </div>
          <div className="movie-scroller">   {/* was movie-scroller */}
            {trending.map((m) => (
              <MovieCard key={m.id} movie={m} onClick={(mv) => navigate(`/movie/${mv.id}`)} />
            ))}
          </div>
        </div>

        {/* ── Top Rated ── */}
        <div className="section-sm">
          <div className="row-header">
            <div className="row-title fade-in">Top Rated All Time</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/search")}>
              View all <ChevronRight />
            </button>
          </div>
          <div className="movie-scroller">   {/* was movie-scroller */}
            {topRated.map((m) => (
              <MovieCard key={m.id} movie={m} onClick={(mv) => navigate(`/movie/${mv.id}`)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline icons ──────────────────────────────────────────────────────────────

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
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
