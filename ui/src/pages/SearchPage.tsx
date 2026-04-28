import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MovieCard from "../components/MovieCard";
import { realApi as api } from "../api/realApi";
import { GENRES } from "../types/movie";
import type { Movie } from "../types/movie";

const PAGE_SIZE = 50;

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [genreFilter, setGenreFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // NL search state
  const [nlQuery, setNlQuery] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    runSearch(initialQuery, 1);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      runSearch(query, 1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, genreFilter, yearFilter]);

  async function runSearch(q: string, pageNumber: number) {
    setLoading(true);
    const offset = (pageNumber - 1) * PAGE_SIZE;
    const raw = await api.searchMovies(q, PAGE_SIZE, offset);
    setHasMore(raw.length === PAGE_SIZE);
    let data = raw;
    if (genreFilter) data = data.filter((m) => m.genre.includes(genreFilter));
    if (yearFilter) data = data.filter((m) => String(m.year).startsWith(yearFilter));
    setResults(data);
    setLoading(false);
  }

  async function handleNL(e: React.FormEvent) {
    e.preventDefault();
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    const { sql, results: nlResults } = await api.naturalLanguageSearch(nlQuery);
    setGeneratedSQL(sql);
    setResults(nlResults);
    setHasMore(false);
    setNlLoading(false);
  }

  async function goToPage(nextPage: number) {
    if (nextPage < 1) return;
    setPage(nextPage);
    await runSearch(query, nextPage);
  }

  return (
    <div>
      {/* ── Search hero ── */}
      <div className="search-hero">
        <div className="container">
          <div style={{ maxWidth: 720 }}>
            <div className="hero-eyebrow">Natural Language Search</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, letterSpacing: -1, marginBottom: 8 }}>
              Find your next favourite film
            </h1>
            <p style={{ color: "var(--text2)", fontSize: 15, marginBottom: 24 }}>
              Try plain English:{" "}
              <em style={{ color: "var(--accent)" }}>"something like Interstellar but less confusing"</em>
              {" "}— we'll convert it to SQL.
            </p>

            <form onSubmit={handleNL} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div className="search-wrap-lg" style={{ flex: 1 }}>
                <SearchIcon size={20} />
                <input
                  className="search-input-lg"
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  placeholder="Describe what you want to watch..."
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={nlLoading}>
                {nlLoading ? "..." : "Ask AI"}
              </button>
            </form>

            {generatedSQL && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px", fontSize: 12, fontFamily: "monospace", color: "var(--accent)" }}>
                <span style={{ color: "var(--text3)", marginRight: 8 }}>Generated SQL:</span>
                {generatedSQL}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container">
        {/* ── Filter bar ── */}
        <div className="filter-bar">
          <div className="search-wrap" style={{ flex: 1, maxWidth: 340 }}>
            <SearchIcon size={15} />
            <input
              style={{ paddingLeft: 34, width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "9px 12px 9px 34px", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14, outline: "none" }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter results..."
            />
          </div>

          <select className="filter-select" value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
            <option value="">All genres</option>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          <select className="filter-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">All years</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="202">2020s</option>
            <option value="201">2010s</option>
            <option value="200">2000s</option>
            <option value="199">1990s</option>
          </select>
        </div>

        {/* ── Results ── */}
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-title">No results found</div>
            <div className="empty-desc">Try adjusting your query or filters.</div>
          </div>
        ) : (
          <>
            <div className="results-count">{results.length} film{results.length !== 1 ? "s" : ""} found</div>
            <div className="results-grid">
              {results.map((m) => (
                <MovieCard key={m.id} movie={m} onClick={(mv) => navigate(`/movie/${mv.id}`)} />
              ))}
            </div>
            {!generatedSQL && (
              <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <button className="btn btn-ghost btn-sm" disabled={page === 1 || loading} onClick={() => goToPage(page - 1)}>
                  ← Previous
                </button>
                <div style={{ fontSize: 13, color: "var(--text3)" }}>Page {page}</div>
                <button className="btn btn-ghost btn-sm" disabled={!hasMore || loading} onClick={() => goToPage(page + 1)}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}
