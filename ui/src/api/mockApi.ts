import type { Movie, User, AnalyticsData, UserOnboardingData, GraphRelatedMovies } from "../types/movie";

export const MOCK_MOVIES: Movie[] = [
  {
    id: 1, title: "Dune: Part Two", year: 2024, genre: ["Sci-Fi", "Adventure"], rating: 8.5,
    runtime: 166, language: "English", director: "Denis Villeneuve",
    mood: ["Epic", "Thought-Provoking"],
    poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    plot: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
    mpaa: "PG-13", cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson"], tmdbId: 693134,
  },
  {
    id: 2, title: "Oppenheimer", year: 2023, genre: ["Drama", "History"], rating: 8.9,
    runtime: 180, language: "English", director: "Christopher Nolan",
    mood: ["Thought-Provoking", "Tense"],
    poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    plot: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II.",
    mpaa: "R", cast: ["Cillian Murphy", "Emily Blunt", "Matt Damon"], tmdbId: 872585,
  },
  {
    id: 3, title: "The Holdovers", year: 2023, genre: ["Drama", "Comedy"], rating: 7.9,
    runtime: 133, language: "English", director: "Alexander Payne",
    mood: ["Feel-Good", "Funny"],
    poster: "https://image.tmdb.org/t/p/w500/VHSzNBTubHCQmUEHEUi3VhFhxV.jpg",
    plot: "A curmudgeonly instructor at a New England prep school is forced to remain on campus over the holidays with a troublemaker student.",
    mpaa: "R", cast: ["Paul Giamatti", "Da'Vine Joy Randolph", "Dominic Sessa"], tmdbId: 840430,
  },
  {
    id: 4, title: "Past Lives", year: 2023, genre: ["Drama", "Romance"], rating: 7.8,
    runtime: 106, language: "English", director: "Celine Song",
    mood: ["Romantic", "Thought-Provoking"],
    poster: "https://image.tmdb.org/t/p/w500/k3waqVXsnäFTkBMFkO1s9esqDpI.jpg",
    plot: "Two childhood sweethearts separated by immigration reconnect across continents over the decades.",
    mpaa: "PG-13", cast: ["Greta Lee", "Teo Yoo", "John Magaro"], tmdbId: 1008042,
  },
  {
    id: 5, title: "Poor Things", year: 2023, genre: ["Comedy", "Fantasy", "Romance"], rating: 8.0,
    runtime: 141, language: "English", director: "Yorgos Lanthimos",
    mood: ["Funny", "Thought-Provoking"],
    poster: "https://image.tmdb.org/t/p/w500/kCGlIMHnOm8JPXIbkf2JUQS6sGN.jpg",
    plot: "The incredible tale of Bella Baxter, a young woman brought back to life by a brilliant and unorthodox scientist.",
    mpaa: "R", cast: ["Emma Stone", "Mark Ruffalo", "Willem Dafoe"], tmdbId: 792307,
  },
  {
    id: 6, title: "Killers of the Flower Moon", year: 2023, genre: ["Crime", "Drama", "History"], rating: 7.7,
    runtime: 206, language: "English", director: "Martin Scorsese",
    mood: ["Tense", "Thought-Provoking"],
    poster: "https://image.tmdb.org/t/p/w500/dB6nXNBNr5QE8R9nIpYsUVLhivf.jpg",
    plot: "Members of the Osage Nation are murdered under mysterious circumstances in 1920s Oklahoma.",
    mpaa: "R", cast: ["Leonardo DiCaprio", "Lily Gladstone", "Robert De Niro"], tmdbId: 466420,
  },
  {
    id: 7, title: "Saltburn", year: 2023, genre: ["Thriller", "Drama"], rating: 7.1,
    runtime: 131, language: "English", director: "Emerald Fennell",
    mood: ["Tense", "Thought-Provoking"],
    poster: "https://image.tmdb.org/t/p/w500/qjhahqSdHUzsOB2CIcqrSJzCGjN.jpg",
    plot: "A student at Oxford University becomes fixated on a charismatic classmate and his aristocratic family.",
    mpaa: "R", cast: ["Barry Keoghan", "Jacob Elordi", "Rosamund Pike"], tmdbId: 1014590,
  },
  {
    id: 8, title: "American Fiction", year: 2023, genre: ["Comedy", "Drama"], rating: 7.6,
    runtime: 117, language: "English", director: "Cord Jefferson",
    mood: ["Funny", "Thought-Provoking"],
    poster: "https://image.tmdb.org/t/p/w500/lGVqjWMTHMUBLvFUXYRGlL5FhXE.jpg",
    plot: "A fed-up writer pens a satirical novel that accidentally becomes a bestseller.",
    mpaa: "R", cast: ["Jeffrey Wright", "Tracee Ellis Ross", "Sterling K. Brown"], tmdbId: 1056360,
  },
  {
    id: 9, title: "The Substance", year: 2024, genre: ["Horror", "Sci-Fi"], rating: 7.3,
    runtime: 141, language: "English", director: "Coralie Fargeat",
    mood: ["Tense", "Thought-Provoking"],
    poster: "https://image.tmdb.org/t/p/w500/lqoMzCcZYEFK729d6qzt349fB4o.jpg",
    plot: "A fading celebrity uses a black-market drug to create a younger, better version of herself.",
    mpaa: "R", cast: ["Demi Moore", "Margaret Qualley", "Dennis Quaid"], tmdbId: 933260,
  },
  {
    id: 10, title: "Challengers", year: 2024, genre: ["Drama", "Romance", "Sport"], rating: 7.5,
    runtime: 131, language: "English", director: "Luca Guadagnino",
    mood: ["Tense", "Romantic"],
    poster: "https://image.tmdb.org/t/p/w500/H0dJDHcxkWknZZiIOgCgVR0IIAJ.jpg",
    plot: "A tennis champion's life becomes complicated when she comes face to face with the men who were once her best friend and her boyfriend.",
    mpaa: "R", cast: ["Zendaya", "Josh O'Connor", "Mike Faist"], tmdbId: 693134,
  },
  {
    id: 11, title: "Conclave", year: 2024, genre: ["Drama", "Thriller", "Mystery"], rating: 7.4,
    runtime: 120, language: "English", director: "Edward Berger",
    mood: ["Tense", "Thought-Provoking"],
    poster: "https://image.tmdb.org/t/p/w500/m5x8D0bZ3U4zGBcJCOEG5tWKtlb.jpg",
    plot: "A cardinal oversees the conclave to elect a new Pope and uncovers deep secrets.",
    mpaa: "PG", cast: ["Ralph Fiennes", "Stanley Tucci", "John Lithgow"], tmdbId: 974453,
  },
  {
    id: 12, title: "Interstellar", year: 2014, genre: ["Sci-Fi", "Adventure", "Drama"], rating: 8.6,
    runtime: 169, language: "English", director: "Christopher Nolan",
    mood: ["Epic", "Thought-Provoking"],
    poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    plot: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    mpaa: "PG-13", cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"], tmdbId: 157336,
  },
];

export const MOCK_USER: User = {
  name: "Alex Rivera",
  email: "alex@example.com",
  avatar: null,
  preferences: { genres: ["Sci-Fi", "Drama", "Thriller"], mood: "Thought-Provoking" },
  watchedCount: 47,
  memberSince: "2024",
};

export const MOCK_ANALYTICS: AnalyticsData = {
  genreTrends: [
    { genre: "Drama", count: 34 }, { genre: "Sci-Fi", count: 28 }, { genre: "Thriller", count: 22 },
    { genre: "Comedy", count: 19 }, { genre: "Horror", count: 14 }, { genre: "Romance", count: 11 },
  ],
  ratingDist: [
    { decade: "1980s", avg: 7.2 }, { decade: "1990s", avg: 7.6 }, { decade: "2000s", avg: 7.4 },
    { decade: "2010s", avg: 7.8 }, { decade: "2020s", avg: 8.1 },
  ],
  cityActivity: [
    { city: "New York", movie: "Oppenheimer", count: 1240 },
    { city: "Los Angeles", movie: "Dune: Part Two", count: 980 },
    { city: "Chicago", movie: "The Holdovers", count: 670 },
    { city: "Houston", movie: "Poor Things", count: 540 },
    { city: "Phoenix", movie: "Saltburn", count: 430 },
  ],
  moodPopularity: [
    { mood: "Thought-Provoking", count: 42 }, { mood: "Feel-Good", count: 38 },
    { mood: "Tense", count: 31 }, { mood: "Funny", count: 27 },
    { mood: "Epic", count: 23 }, { mood: "Romantic", count: 18 },
  ],
};


const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const mockApi = {
  getRecommendations: async (userId: string | undefined, mood: string | null): Promise<Movie[]> => {
    await delay(600);
    const base = mood ? MOCK_MOVIES.filter((m) => m.mood.includes(mood)) : MOCK_MOVIES;
    return base.slice(0, 10).map((m) => ({
      ...m,
      explanation: `Recommended because it matches your ${m.genre[0]} preference and ${m.mood[0]} mood.`,
    }));
  },

  getGraphUserRecommendations: async (): Promise<Movie[]> => {
    await delay(600);
    return MOCK_MOVIES.slice(2, 10);
  },

  searchMovies: async (query: string): Promise<Movie[]> => {
    await delay(350);
    if (!query.trim()) return MOCK_MOVIES;
    const q = query.toLowerCase();
    return MOCK_MOVIES.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.genre.some((g) => g.toLowerCase().includes(q)) ||
        m.director.toLowerCase().includes(q) ||
        m.cast.some((c) => c.toLowerCase().includes(q))
    );
  },

  getMovieById: async (id: number): Promise<Movie | null> => {
    await delay(200);
    return MOCK_MOVIES.find((m) => m.id === id) ?? null;
  },

  getRelatedMovies: async (movieId: number): Promise<Movie[]> => {
    await delay(300);
    return MOCK_MOVIES.filter((m) => m.id !== movieId).slice(0, 4);
  },

  getGraphRelatedMovies: async (movieId: number): Promise<GraphRelatedMovies | null> => {
    await delay(400);
    const others = MOCK_MOVIES.filter((m) => m.id !== movieId);
    return {
      same_director: others.slice(0, 4),
      same_actors: others.slice(4, 8),
      similar_theme: others.slice(8, 12),
    };
  },

  getAnalytics: async (): Promise<AnalyticsData> => {
    await delay(500);
    return MOCK_ANALYTICS;
  },

  submitFeedback: async (_movieId: number, _rating: number): Promise<{ success: boolean }> => {
    await delay(200);
    return { success: true };
  },

  onboardUser: async (data: UserOnboardingData): Promise<User> => {
    await delay(300);
    return {
      ...MOCK_USER,
      name: data.name,
      email: data.email,
      preferences: { genres: data.genres, mood: data.mood },
    };
  },


  naturalLanguageSearch: async (query: string): Promise<{ sql: string; results: Movie[] }> => {
    await delay(900);
    const sql = `SELECT * FROM movies WHERE genre @> ARRAY['Sci-Fi'] AND rating > 8.0 ORDER BY rating DESC LIMIT 20;`;
    const results = await mockApi.searchMovies(query);
    return { sql, results };
  },

  naturalLanguageAnalytics: async (_query: string): Promise<{ sql: string; summary: string }> => {
    await delay(800);
    return {
      sql: `SELECT genre, COUNT(*) AS views FROM watch_history wh JOIN movie_genres mg ON wh.movie_id = mg.movie_id GROUP BY genre ORDER BY views DESC LIMIT 10;`,
      summary: "Drama and Sci-Fi dominate your watch history, with a sharp uptick in Thriller content over the last 30 days.",
    };
  },
};
