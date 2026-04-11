import { useState } from "react";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./routes/AppRouter";
import OnboardingPage from "./pages/OnboardingPage";
import type { User } from "./types/movie";

export default function App() {
  // In production: load from JWT / session / localStorage
  const [user, setUser] = useState<User | null>(null);

  if (!user) {
    return <OnboardingPage onComplete={(u) => setUser(u)} />;
  }

  return (
    <BrowserRouter>
      <AppRouter user={user} />
    </BrowserRouter>
  );
}
