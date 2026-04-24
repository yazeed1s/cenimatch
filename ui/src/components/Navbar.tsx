import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { User } from "../types/movie";

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  const initials = user?.name?.split(" ").map((w) => w[0]).join("") ?? "?";
  const active = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <a className="navbar-logo" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
          Cine<span>Match</span>
        </a>

        <div className="navbar-nav">
          <button className={`nav-link ${active("/") ? "active" : ""}`} onClick={() => navigate("/")}>
            <HomeIcon /> Home
          </button>
          <button className={`nav-link ${active("/search") ? "active" : ""}`} onClick={() => navigate("/search")}>
            Search
          </button>
          <button className={`nav-link ${active("/chat") ? "active" : ""}`} onClick={() => navigate("/chat")}>
            <SparkleIcon /> Ask AI
          </button>
          <button className={`nav-link ${active("/dashboard") ? "active" : ""}`} onClick={() => navigate("/dashboard")}>
            <BarIcon /> Analytics
          </button>
        </div>

        <div className="navbar-search">
          <form onSubmit={handleSearch}>
            <div className="search-wrap">
              <SearchIcon size={15} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search movies, directors, actors..."
              />
            </div>
          </form>
        </div>

        <div className="navbar-actions">
          {user ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={onLogout}>
                Log out
              </button>
              <button className="avatar-btn" title={user.name}>
                {initials}
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/signup")}>
              Sign up
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}


function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function BarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
      <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5z" />
    </svg>
  );
}
