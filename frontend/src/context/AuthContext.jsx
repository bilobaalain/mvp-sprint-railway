import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("rade_token")) return setReady(true);
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem("rade_token"))
      .finally(() => setReady(true));
  }, []);

  const saveSession = (data) => {
    localStorage.setItem("rade_token", data.token);
    setUser(data.user);
  };
  const logout = () => {
    localStorage.removeItem("rade_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ready, saveSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
