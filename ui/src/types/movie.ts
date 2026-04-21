// ─────────────────────────────────────────────────────────────────────────────
// TYPES — all shapes used across the UI
// Enum values match schema-01.sql exactly
// ─────────────────────────────────────────────────────────────────────────────

export interface Movie {
  id: number;           // = tmdb_id in DB
  title: string;
  year: number;
  genre: string[];
  rating: number;       
  runtime: number;      
  language: string;     
  director: string;
  mood: string[];       
  poster: string;      
  plot: string;         
  mpaa: string;         
  cast: string[];
  tmdbId: number;
  explanation?: string; 
}

export interface User {
  id?: string;         
  name: string;        
  email: string;
  avatar: string | null;
  preferences: {
    genres: string[];
    mood: string;
  };
  watchedCount: number;
  memberSince: string;
}

// sent to POST /api/auth/register, then POST /api/users/onboard
export interface UserOnboardingData {
  name: string;
  email: string;
  password: string;
  genres: string[];
  mood: string;
  likedMovieIds: number[];    // tmdb_ids from the db
  dislikedMovieIds: number[]; // tmdb_ids from the db
  runtimePref?: number;
  decadeLow?: number;
  decadeHigh?: number;
}

export interface AnalyticsData {
  genreTrends: { genre: string; count: number }[];
  ratingDist: { decade: string; avg: number }[];
  cityActivity: { city: string; movie: string; count: number }[];
  moodPopularity: { mood: string; count: number }[];
}



export interface MoodOption {
  label: string;    
  dbValue: string;  
  emoji: string;
}

export const MOODS: MoodOption[] = [
  { label: "Feel-Good", dbValue: "feel_good", emoji: "😊" },
  { label: "Tense", dbValue: "tense", emoji: "😰" },
  { label: "Thought-Provoking", dbValue: "thought_provoking", emoji: "🤔" },
  { label: "Funny", dbValue: "funny", emoji: "😂" },
  { label: "Romantic", dbValue: "romantic", emoji: "💕" },
  { label: "Epic", dbValue: "epic", emoji: "⚡" },
];

export type CrewRole = "director" | "actor" | "writer" | "producer";

export type TagSource = "llm" | "manual";

export const GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime",
  "Drama", "Fantasy", "Horror", "History", "Mystery",
  "Romance", "Science Fiction", "Sport", "Thriller", "Western",
];
