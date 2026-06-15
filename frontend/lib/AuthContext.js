import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearStoredAuth, fetchSession, getStoredUser, getToken, logoutUser, persistAuth } from "../services/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      const token = getToken();
      const storedUser = getStoredUser();
      if (!token) {
        if (active) setIsLoading(false);
        return;
      }
      if (storedUser?.token === token && active) setUser(storedUser);
      try {
        const sessionUser = await fetchSession(token);
        const restoredUser = {
          ...storedUser,
          ...sessionUser,
          name: sessionUser.name || storedUser?.name || sessionUser.email?.split("@")[0] || "",
        };
        persistAuth(restoredUser);
        if (active) setUser(restoredUser);
      } catch {
        clearStoredAuth();
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    restoreSession();
    return () => { active = false; };
  }, []);

  function login(userData) {
    persistAuth(userData);
    setUser(userData);
  }

  async function logout() {
    await logoutUser();
    setUser(null);
  }

  async function refreshSession() {
    const token = getToken();
    if (!token) return;
    try {
      const sessionUser = await fetchSession(token);
      const updated = {
        ...user,
        ...sessionUser,
        name: sessionUser.name || user?.name || sessionUser.email?.split("@")[0] || "",
      };
      persistAuth(updated);
      setUser(updated);
    } catch {
      // session refresh failed silently — don't log out
    }
  }

  const value = useMemo(
    () => ({ user, login, logout, refreshSession, isLoading }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}