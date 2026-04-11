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

function normalizeMood(raw: string): string {
  return MOOD_DISPLAY[raw.toLowerCase()] ?? raw;
}

export function mapMovie(raw: RawMovie): Movie {
  return {
    id: raw.tmdb_id,
    title: raw.title,
    year: raw.release_year ?? new Date(raw.release_date ?? "").getFullYear() ?? 0,
    genre: raw.genres ?? [],
    rating: raw.vote_avg ?? 0,
    runtime: raw.runtime_min ?? 0,
    language: raw.original_lang ?? "Unknown",
    director: raw.director_name ?? "Unknown",
    mood: (raw.mood_tags ?? []).map(normalizeMood),
    poster: raw.poster_path
      ? raw.poster_path.startsWith("http")
        ? raw.poster_path
        : `${TMDB_IMAGE_BASE}${raw.poster_path}`
      : "",
    plot: raw.overview ?? "",
    mpaa: raw.mpaa_rating ?? "NR",
    cast: raw.cast_names ?? [],
    tmdbId: raw.tmdb_id,
    explanation: raw.explanation,
  };
}

export function mapMovies(raws: RawMovie[]): Movie[] {
  return raws.map(mapMovie);
}
