import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import HomePage from "../pages/HomePage";
import SearchPage from "../pages/SearchPage";
import MoviePage from "../pages/MoviePage";
import DashboardPage from "../pages/DashboardPage";
import ChatPage from "../pages/ChatPage";
import OnboardingPage from "../pages/OnboardingPage";
import Navbar from "../components/Navbar";
import type { User } from "../types/movie";
import { authApi } from "../api/realApi";

interface AppRouterProps {
  user: User | null;
  onUserChange: (user: User | null) => void;
}

function SignupRoute({ onComplete }: { onComplete: (user: User) => void }) {
  const navigate = useNavigate();

  return (
    <OnboardingPage
      onComplete={(user) => {
        onComplete(user);
        navigate("/");
      }}
    />
  );
}

export default function AppRouter({ user, onUserChange }: AppRouterProps) {
  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // ignore
    }
    onUserChange(null);
  };

  return (
    <div className="app">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="main-content">
        <Routes>
          <Route path="/"           element={<HomePage user={user} />} />
          <Route path="/search"     element={<SearchPage />} />
          <Route path="/movie/:id"  element={<MoviePage />} />
          <Route path="/dashboard"  element={<DashboardPage />} />
          <Route path="/chat"       element={<ChatPage />} />
          <Route
            path="/signup"
            element={user ? <Navigate to="/" replace /> : <SignupRoute onComplete={onUserChange} />}
          />
          {/* Catch-all → home */}
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
