import type { Movie, User, AnalyticsData, UserOnboardingData } from "../types/movie";
import { mapMovies, mapMovie } from "./mappers";
import type { RawMovie, RawActivityEvent } from "./mappers";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8080";

let _accessToken: string | null = null;

export function setAccessToken(token: string) { _accessToken = token; }
export function clearAccessToken() { _accessToken = null; }


async function fetchJSON<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }

  if (res.status === 204) return {} as T;

  return res.json() as Promise<T>;
}


export interface LoginResponse {
  access_token: string;
  user_id: string;
  username: string;
  email: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export const authApi = {
  // POST /api/auth/register
  register: (data: RegisterPayload): Promise<LoginResponse> =>
    fetchJSON("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),

  // POST /api/auth/login
  login: (email: string, password: string): Promise<LoginResponse> =>
    fetchJSON("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  // POST /api/auth/refresh  
  refresh: (): Promise<{ access_token: string }> =>
    fetchJSON("/api/auth/refresh", { method: "POST" }),

  // POST /api/auth/logout
  logout: (): Promise<void> =>
    fetchJSON("/api/auth/logout", { method: "POST" }),
};


export const realApi = {
  getRecommendations: async (_userId: string | undefined, mood: string | null): Promise<Movie[]> => {
    const params = new URLSearchParams({ limit: "20" });
    
    if (mood) {
      const dbMood = mood.toLowerCase().replace("-", "_").replace(" ", "_");
      params.set("mood", dbMood);
    }
    const raws = await fetchJSON<RawMovie[]>(`/api/recommendations?${params}`);
    return mapMovies(raws);
  },

  searchMovies: async (query: string): Promise<Movie[]> => {
    if (!query.trim()) {
      const raws = await fetchJSON<RawMovie[]>("/api/movies?limit=50");
      return mapMovies(raws);
    }
    const params = new URLSearchParams({ q: query });
    const raws = await fetchJSON<RawMovie[]>(`/api/movies/search?${params}`);
    return mapMovies(raws);
  },


  getMovieById: async (id: number): Promise<Movie | null> => {
    try {
      const raw = await fetchJSON<RawMovie>(`/api/movies/${id}`);
      return mapMovie(raw);
    } catch {
      return null;
    }
  },

  getRelatedMovies: async (movieId: number): Promise<Movie[]> => {
    try {
      const raws = await fetchJSON<RawMovie[]>(`/api/movies/${movieId}/related`);
      return mapMovies(raws);
    } catch {
      return [];
    }
  },

  getAnalytics: async (): Promise<AnalyticsData> => {

    const raw = await fetchJSON<{
      genre_trends: { genre: string; count: number }[];
      rating_dist: { decade: string; avg: number }[];
      city_activity: RawActivityEvent[];
      mood_popularity: { mood: string; count: number }[];
    }>("/api/analytics/overview");

    return {
      genreTrends: raw.genre_trends,
      ratingDist: raw.rating_dist,
      cityActivity: raw.city_activity.map((c) => ({
        city: c.city_state,
        movie: c.movie_title,
        count: c.watch_count,
      })),
      moodPopularity: raw.mood_popularity.map((m) => ({
        mood: m.mood.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        count: m.count,
      })),
    };
  },

 
  submitFeedback: async (movieId: number, rating: number): Promise<{ success: boolean }> => {
    await fetchJSON("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ movie_id: movieId, rating }),
    });
    return { success: true };
  },

  markNotInterested: async (movieId: number): Promise<{ success: boolean }> => {
    await fetchJSON("/api/feedback/not-interested", {
      method: "POST",
      body: JSON.stringify({ movie_id: movieId }),
    });
    return { success: true };
  },


  onboardUser: async (data: UserOnboardingData): Promise<User> => {
    const payload = {
      username: data.name.toLowerCase().replace(/\s+/g, "_"),
      email: data.email,
      password: data.password ?? "changeme123",   // collected in onboarding form
      genre_weights: Object.fromEntries(data.genres.map((g) => [g, 1.0])),
      default_mood: data.mood.toLowerCase().replace(/-/g, "_").replace(/\s/g, "_"),
      liked_titles: data.likedMovies,
      disliked_titles: data.dislikedMovies,
    };

    const res = await fetchJSON<LoginResponse & { user: User }>(
      "/api/users/onboard",
      { method: "POST", body: JSON.stringify(payload) }
    );

    if (res.access_token) setAccessToken(res.access_token);

    return res.user ?? {
      name: data.name,
      email: data.email,
      avatar: null,
      preferences: { genres: data.genres, mood: data.mood },
      watchedCount: 0,
      memberSince: new Date().getFullYear().toString(),
    };
  },


  naturalLanguageSearch: async (query: string): Promise<{ sql: string; results: Movie[] }> => {
    const res = await fetchJSON<{ sql: string; results: RawMovie[] }>(
      "/api/search/nl",
      { method: "POST", body: JSON.stringify({ query }) }
    );
    return { sql: res.sql, results: mapMovies(res.results) };
  },

  // POST /api/analytics/nl   body: { query }
  naturalLanguageAnalytics: async (query: string): Promise<{ sql: string; summary: string }> =>
    fetchJSON("/api/analytics/nl", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
};
