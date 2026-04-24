import type { Movie, User, AnalyticsData, UserOnboardingData, GraphRelatedMovies } from "../types/movie";
import { mapMovies, mapMovie } from "./mappers";
import type { RawMovie, RawActivityEvent } from "./mappers";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8080";

let _accessToken: string | null = localStorage.getItem("cenimatch.access");

export function setAccessToken(token: string) {
  _accessToken = token;
  localStorage.setItem("cenimatch.access", token);
}
export function clearAccessToken() {
  _accessToken = null;
  localStorage.removeItem("cenimatch.access");
}

export function setRefreshToken(token: string) { localStorage.setItem("cenimatch.refresh", token); }
export function getRefreshToken() { return localStorage.getItem("cenimatch.refresh"); }
export function clearRefreshToken() { localStorage.removeItem("cenimatch.refresh"); }

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string };
}

function unwrapEnvelope<T>(raw: unknown): T {
  if (!raw || typeof raw !== "object") return raw as T;

  const maybeEnvelope = raw as Partial<ApiEnvelope<T>>;
  if (typeof maybeEnvelope.success === "boolean") {
    if (!maybeEnvelope.success) {
      throw new Error(maybeEnvelope.error?.code ?? "request_failed");
    }
    return maybeEnvelope.data as T;
  }

  return raw as T;
}

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

  const raw = await res.json();
  return unwrapEnvelope<T>(raw);
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

export interface MovieCrewMember {
  name: string;
  role: string;
  job: string | null;
  character: string | null;
  ordering: number | null;
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
  refresh: (): Promise<{ access_token: string, refresh_token: string }> =>
    fetchJSON("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: getRefreshToken() })
    }),

  // POST /api/auth/logout
  logout: async (): Promise<void> => {
    const token = getRefreshToken();
    if (token) {
      await fetchJSON("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: token })
      }).catch(() => { });
    }
    clearAccessToken();
    clearRefreshToken();
  },
};


export const realApi = {
  listMovies: async (limit = 50, offset = 0, query?: string, genre?: string): Promise<Movie[]> => {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (query) params.append("q", query);
    if (genre) params.append("genre", genre);

    // Determine route based on search vs list
    const path = query ? `/api/movies/search?${params.toString()}` : `/api/movies?${params.toString()}`;
    const raw = await fetchJSON<RawMovie[]>(path);
    return mapMovies(raw);
  },

  getRecommendations: async (_userId: string | undefined, mood: string | null): Promise<Movie[]> => {
    const raws = await fetchJSON<RawMovie[]>("/api/movies?limit=50");
    const movies = mapMovies(raws);
    if (!mood) return movies.slice(0, 20);

    const moodKey = mood.toLowerCase().replace(/[\s-]/g, "_");
    const filtered = movies.filter((movie) =>
      movie.mood.some((value) => value.toLowerCase().replace(/[\s-]/g, "_") === moodKey),
    );
    return (filtered.length ? filtered : movies).slice(0, 20);
  },

  searchMovies: async (query: string, limit = 50, offset = 0): Promise<Movie[]> => {
    const trimmed = query.trim();
    const path = trimmed
      ? `/api/movies/search?q=${encodeURIComponent(trimmed)}&limit=${limit}&offset=${offset}`
      : `/api/movies?limit=${limit}&offset=${offset}`;
    const raws = await fetchJSON<RawMovie[]>(path);
    return mapMovies(raws);
  },

  getGraphUserRecommendations: async (): Promise<Movie[]> => {
    try {
      const raws = await fetchJSON<RawMovie[]>("/api/recommendations/graph");
      return mapMovies(raws);
    } catch {
      return [];
    }
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
      const raws = await fetchJSON<RawMovie[]>(`/api/movies/${movieId}/related?limit=4`);
      const related = mapMovies(raws);
      if (related.length > 0) return related;

      const fallbackRows = await fetchJSON<RawMovie[]>("/api/movies?limit=20");
      return mapMovies(fallbackRows).filter((movie) => movie.id !== movieId).slice(0, 4);
    } catch {
      try {
        const fallbackRows = await fetchJSON<RawMovie[]>("/api/movies?limit=20");
        return mapMovies(fallbackRows).filter((movie) => movie.id !== movieId).slice(0, 4);
      } catch {
        return [];
      }
    }
  },

  getGraphRelatedMovies: async (movieId: number): Promise<GraphRelatedMovies | null> => {
    try {
      const raw = await fetchJSON<{
        same_director: RawMovie[];
        same_actors: RawMovie[];
        similar_theme: RawMovie[];
      }>(`/api/movies/${movieId}/graph-related`);

      return {
        same_director: mapMovies(raw.same_director || []),
        same_actors: mapMovies(raw.same_actors || []),
        similar_theme: mapMovies(raw.similar_theme || []),
      };
    } catch {
      return null;
    }
  },

  getMovieCrew: (movieId: number): Promise<{ members: MovieCrewMember[] }> =>
    fetchJSON(`/api/movies/${movieId}/crew`),

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
    try {
      await fetchJSON("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ movie_id: movieId, rating }),
      });
    } catch {
      // keep ui usable until feedback endpoints are added
    }
    return { success: true };
  },

  markNotInterested: async (movieId: number): Promise<{ success: boolean }> => {
    try {
      await fetchJSON("/api/feedback/not-interested", {
        method: "POST",
        body: JSON.stringify({ movie_id: movieId }),
      });
    } catch {
      // keep ui usable until feedback endpoints are added
    }
    return { success: true };
  },


  onboardUser: async (data: UserOnboardingData): Promise<User> => {
    const moodKey = data.mood.toLowerCase().replace(/-/g, "_").replace(/\s/g, "_");

    // atomic signup — creates user + onboarding preferences in one tx
    const authRes = await fetchJSON<{
      user: { id: string; username: string; email: string; created_at: string };
      access_token: string;
      refresh_token: string;
    }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: data.name.toLowerCase().replace(/\s+/g, "_"),
        email: data.email,
        password: data.password,
        genres: data.genres,
        default_mood: moodKey,
        liked_ids: data.likedMovieIds,
        disliked_ids: data.dislikedMovieIds,
        runtime_pref: data.runtimePref ?? null,
        decade_low: data.decadeLow ?? null,
        decade_high: data.decadeHigh ?? null,
      }),
    });

    if (authRes.access_token) setAccessToken(authRes.access_token);
    if (authRes.refresh_token) setRefreshToken(authRes.refresh_token);

    return {
      id: authRes.user?.id,
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

  // POST /api/chat  body: { messages: [{role, content}] }
  // sends the full conversation history each turn so the llm has context.
  chatQuery: async (
    messages: { role: string; content: string }[]
  ): Promise<{ type: "movies" | "text"; movies?: RawMovie[]; rows?: Record<string, unknown>[]; columns?: string[]; sql: string; message: string }> =>
    fetchJSON("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),
};
