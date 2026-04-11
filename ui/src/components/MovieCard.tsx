import { useState } from "react";
import type { Movie } from "../types/movie";

interface MovieCardProps {
  movie: Movie;
  onClick: (movie: Movie) => void;
  showExplanation?: boolean;
}

export default function MovieCard({ movie, onClick, showExplanation = false }: MovieCardProps) {
  const [liked, setLiked] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="movie-card fade-in" onClick={() => onClick(movie)}>
      {movie.poster && !imgError ? (
        <img
          className="movie-card-poster"
          src={movie.poster}
          alt={movie.title}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="movie-card-poster-placeholder">🎬</div>
      )}

      <div className="movie-card-overlay">
        <div className="movie-card-overlay-title">{movie.title}</div>
        <div className="movie-card-overlay-genres">
          {movie.genre.slice(0, 2).map((g) => (
            <span key={g} className="tag">{g}</span>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="rating-badge">
            <StarIcon filled size={13} /> {movie.rating}
          </span>
          <button
            className={`heart-btn ${liked ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
          >
            <HeartIcon filled={liked} />
          </button>
        </div>
      </div>

      <div className="movie-card-body">
        <div className="movie-card-title">{movie.title}</div>
        <div className="movie-card-meta">
          <span className="rating-badge"><StarIcon filled size={12} /> {movie.rating}</span>
          <span>{movie.year}</span>
        </div>
      </div>

      {showExplanation && movie.explanation && (
        <div style={{ padding: "0 12px 12px" }}>
          <div className="explanation">{movie.explanation}</div>
        </div>
      )}
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
