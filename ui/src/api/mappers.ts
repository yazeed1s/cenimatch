import type { Movie } from "../types/movie";


const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

export interface RawMovie {
  
  tmdb_id: number;
  imdb_id: string | null;
  title: string;
  original_title: string | null;
  release_date: string | null;       
  release_year: number | null;
  runtime_min: number | null;        
  original_lang: string | null;      
  overview: string | null;
  popularity: number | null;
  vote_avg: number | null;          
  vote_count: number | null;
  budget: number | null;
  revenue: number | null;
  mpaa_rating: string | null;
  poster_path: string | null;
  enriched: boolean;

  genres: string[];                 

  mood_tags: string[];              

  director_name: string | null;

  cast_names: string[];

  recommendation_score?: number;
  explanation?: string;
}

export interface RawUser {
  id: string;                       
  username: string;
  email: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;

  genre_weights: Record<string, number>;  
  runtime_pref: number | null;
  decade_low: number | null;
  decade_high: number | null;
  lang_openness: number;
  content_tol: Record<string, unknown>; 


  liked: number[];                  
  disliked: number[];                
  mood_attributes: Record<string, unknown>; 
}

export interface RawActivityEvent {
  city_state: string;
  movie_title: string;
  watch_count: number;
}


const MOOD_DISPLAY: Record<string, string> = {
  feel_good: "Feel-Good",
  tense: "Tense",
  thought_provoking: "Thought-Provoking",
  funny: "Funny",
  romantic: "Romantic",
  epic: "Epic",
};

function cleanNullableText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === "none" || lowered === "null") return null;
  return trimmed;
}

function normalizeMood(raw: string): string {
  return MOOD_DISPLAY[raw.toLowerCase()] ?? raw;
}

export function mapMovie(raw: RawMovie): Movie {
  const posterPath = cleanNullableText(raw.poster_path);
  const releaseDate = cleanNullableText(raw.release_date);
  const parsedYear = raw.release_year ?? (releaseDate ? new Date(releaseDate).getFullYear() : null);
  const year = Number.isFinite(parsedYear) ? (parsedYear as number) : 0;

  return {
    id: raw.tmdb_id,
    title: raw.title,
    year,
    genre: raw.genres ?? [],
    rating: raw.vote_avg ?? 0,
    runtime: raw.runtime_min ?? 0,
    language: cleanNullableText(raw.original_lang) ?? "Unknown",
    director: cleanNullableText(raw.director_name) ?? "Unknown",
    mood: (raw.mood_tags ?? []).map(normalizeMood),
    poster: posterPath
      ? posterPath.startsWith("http")
        ? posterPath
        : posterPath.startsWith("/")
          ? `${TMDB_IMAGE_BASE}${posterPath}`
          : ""
      : "",
    plot: cleanNullableText(raw.overview) ?? "",
    mpaa: cleanNullableText(raw.mpaa_rating) ?? "NR",
    cast: raw.cast_names ?? [],
    tmdbId: raw.tmdb_id,
    explanation: raw.explanation,
  };
}

export function mapMovies(raws: RawMovie[]): Movie[] {
  return raws.map(mapMovie);
}
