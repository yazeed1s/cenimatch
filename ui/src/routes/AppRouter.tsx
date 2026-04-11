import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "../pages/HomePage";
import SearchPage from "../pages/SearchPage";
import MoviePage from "../pages/MoviePage";
import DashboardPage from "../pages/DashboardPage";
import Navbar from "../components/Navbar";
import type { User } from "../types/movie";

interface AppRouterProps {
  user: User | null;
}

export default function AppRouter({ user }: AppRouterProps) {
  return (
    <div className="app">
      <Navbar user={user} />
      <main className="main-content">
        <Routes>
          <Route path="/"           element={<HomePage user={user} />} />
          <Route path="/search"     element={<SearchPage />} />
          <Route path="/movie/:id"  element={<MoviePage />} />
          <Route path="/dashboard"  element={<DashboardPage />} />
          {/* Catch-all → home */}
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
