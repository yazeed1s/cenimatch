import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./routes/AppRouter";
import type { User } from "./types/movie";

const USER_STORAGE_KEY = "cenimatch.user";

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => loadStoredUser());

  useEffect(() => {
    if (!user) {
      localStorage.removeItem(USER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  return (
    <BrowserRouter>
      <AppRouter user={user} onUserChange={setUser} />
    </BrowserRouter>
  );
}
