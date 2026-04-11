import { useState, useEffect } from "react";
import { mockApi } from "../api/mockApi";
// When ready: import { realApi as api } from "../api/realApi";
import type { AnalyticsData } from "../types/movie";

const api = mockApi; // ← swap to realApi when backend is ready

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nlQ, setNlQ] = useState("");
  const [nlResult, setNlResult] = useState<{ sql: string; summary: string } | null>(null);
  const [nlLoading, setNlLoading] = useState(false);

  useEffect(() => {
    api.getAnalytics().then((d) => { setData(d); setLoading(false); });
  }, []);

  async function handleNLAnalytics(e: React.FormEvent) {
    e.preventDefault();
    if (!nlQ.trim()) return;
    setNlLoading(true);
    const result = await api.naturalLanguageAnalytics(nlQ);
    setNlResult(result);
    setNlLoading(false);
  }

  if (loading || !data) {
    return <div className="loading-center" style={{ paddingTop: 120 }}><div className="spinner" /></div>;
  }

  const maxGenre = Math.max(...data.genreTrends.map((g) => g.count));
  const maxMood = Math.max(...data.moodPopularity.map((m) => m.count));

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 36 }}>
        <div className="hero-eyebrow">Analytics</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, letterSpacing: -1 }}>
          System Dashboard
        </h1>
        <p style={{ color: "var(--text2)", fontSize: 15, marginTop: 8 }}>
          Live analytics backed by pre-computed PostgreSQL views, refreshed every 60 seconds.
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="dash-grid fade-in" style={{ marginBottom: 28 }}>
        {([
          { label: "Total Films", value: "100K+", sub: "Indexed from TMDB & IMDb" },
          { label: "Enriched with AI", value: "98.3%", sub: "LLM-tagged mood & themes" },
          { label: "Graph Edges", value: "2.4M", sub: "Apache AGE connections" },
          { label: "Active Users", value: "1,240", sub: "Last 30 days" },
        ] as const).map((s) => (
          <div key={s.label} className="dash-card">
            <div className="dash-card-title">{s.label}</div>
            <div className="dash-stat-num">{s.value}</div>
            <div className="dash-stat-label">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Bar charts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 28 }}>
        <div className="dash-card fade-in fade-in-delay-1">
          <div className="dash-card-title">Genre Trends</div>
          <BarChart rows={data.genreTrends.map((g) => ({ label: g.genre, value: g.count, max: maxGenre }))} />
        </div>
        <div className="dash-card fade-in fade-in-delay-2">
          <div className="dash-card-title">Mood Tag Popularity</div>
          <BarChart rows={data.moodPopularity.map((m) => ({ label: m.mood, value: m.count, max: maxMood }))} />
        </div>
        <div className="dash-card fade-in fade-in-delay-3">
          <div className="dash-card-title">Avg Rating by Decade</div>
          <BarChart rows={data.ratingDist.map((r) => ({ label: r.decade, value: r.avg, max: 10, displayValue: String(r.avg) }))} />
        </div>
      </div>

      {/* ── City activity ── */}
      <div className="dash-card fade-in" style={{ marginBottom: 28 }}>
        <div className="dash-card-title">City-Level Activity Map — Top Films by Location</div>
        <div style={{ marginBottom: 16, fontSize: 13, color: "var(--text3)" }}>
          Materialized view · refreshes every 60s · rolling 10-minute window
        </div>
        <table className="activity-table">
          <thead>
            <tr>
              <th>City</th><th>Most Watched Film</th><th>Views</th><th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {data.cityActivity.map((c, i) => (
              <tr key={c.city}>
                <td style={{ color: "var(--text)", fontWeight: 500 }}>📍 {c.city}</td>
                <td style={{ color: "var(--text)" }}>{c.movie}</td>
                <td><span className="tag tag-accent">{c.count.toLocaleString()}</span></td>
                <td style={{ color: i < 2 ? "#4caf50" : "var(--text3)" }}>{i < 2 ? "↑ Trending" : "→ Stable"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── NL analytics ── */}
      <div className="dash-card fade-in">
        <div className="dash-card-title">Ask Your Data</div>
        <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 16, lineHeight: 1.6 }}>
          Type a question in plain English — we'll convert it to SQL and render the result.
        </p>
        <form onSubmit={handleNLAnalytics} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: "var(--radius)", padding: "11px 14px", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14, outline: "none" }}
            value={nlQ}
            onChange={(e) => setNlQ(e.target.value)}
            placeholder='e.g. "Which genres are most popular among users in the last 30 days?"'
          />
          <button className="btn btn-primary" type="submit" disabled={nlLoading}>
            {nlLoading ? "..." : "Run"}
          </button>
        </form>
        {nlResult && (
          <div className="fade-in">
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px", fontSize: 12, fontFamily: "monospace", color: "var(--accent)", marginBottom: 12 }}>
              <span style={{ color: "var(--text3)", marginRight: 8 }}>SQL:</span>{nlResult.sql}
            </div>
            <div className="explanation">{nlResult.summary}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bar chart sub-component ───────────────────────────────────────────────────

interface BarRow { label: string; value: number; max: number; displayValue?: string; }

function BarChart({ rows }: { rows: BarRow[] }) {
  return (
    <div className="bar-chart">
      {rows.map((r) => (
        <div key={r.label} className="bar-row">
          <div className="bar-label">{r.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(r.value / r.max) * 100}%` }} />
          </div>
          <div className="bar-value">{r.displayValue ?? r.value}</div>
        </div>
      ))}
    </div>
  );
}
