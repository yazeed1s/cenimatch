import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MovieCard from "../components/MovieCard";
import MoodSelector from "../components/MoodSelector";
import { mockApi } from "../api/mockApi";
// When ready: import { realApi as api } from "../api/realApi";
import type { Movie, User } from "../types/movie";
import { MOCK_MOVIES } from "../api/mockApi";

const api = mockApi; // ← swap to realApi when backend is ready

const TRENDING = MOCK_MOVIES.slice(0, 5);
const TOP_RATED = [...MOCK_MOVIES].sort((a, b) => b.rating - a.rating).slice(0, 6);

interface HomePageProps {
  user: User | null;
}

export default function HomePage({ user }: HomePageProps) {
  const [mood, setMood] = useState<string | null>(null);
  const [recs, setRecs] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.getRecommendations(undefined, mood).then((data) => {
      setRecs(data);
      setLoading(false);
    });
  }, [mood]);

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
                <SearchIcon size={15} /> Search Movies
              </button>
              <button className="btn btn-ghost" onClick={() => navigate("/dashboard")}>
                View Analytics
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
            <div className="results-grid">
              {recs.map((m, i) => (
                <MovieCard
                  key={m.id}
                  movie={m}
                  onClick={(mv) => navigate(`/movie/${mv.id}`)}
                  showExplanation={i < 5}
                />
              ))}
            </div>
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
          <div className="movie-scroller">
            {TRENDING.map((m) => (
              <MovieCard key={m.id} movie={m} onClick={(mv) => navigate(`/movie/${mv.id}`)} />
            ))}
          </div>
        </div>

        <div className="divider" />

        {/* ── Top Rated ── */}
        <div className="section-sm">
          <div className="row-header">
            <div className="row-title fade-in">Top Rated All Time</div>
          </div>
          <div className="movie-scroller">
            {TOP_RATED.map((m) => (
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
