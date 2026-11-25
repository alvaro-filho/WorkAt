import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, type ApiUser } from "@/lib/api";

export type User = ApiUser;

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    fullName: string,
    username: string,
    email: string,
    password: string,
    role: "ARTIST" | "COMPANY",
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("authToken");
    const storedUser = window.localStorage.getItem("userProfile");
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as User);
      } catch {
        window.localStorage.removeItem("authToken");
        window.localStorage.removeItem("userProfile");
      }
    } else {
      window.localStorage.removeItem("authToken");
      window.localStorage.removeItem("userProfile");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const persistSession = (data: { token: string; user: User }) => {
    if (typeof window === "undefined") throw new Error("A sessão só pode ser salva no navegador.");
    window.localStorage.setItem("authToken", data.token);
    window.localStorage.setItem("userProfile", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const login = async (email: string, password: string) => {
    if (!email.trim() || !password) throw new Error("E-mail e senha são obrigatórios.");
    setIsLoading(true);
    try {
      persistSession(await api.login(email, password));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    fullName: string,
    username: string,
    email: string,
    password: string,
    role: "ARTIST" | "COMPANY",
  ) => {
    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      throw new Error("Nome completo, usuário, e-mail e senha são obrigatórios.");
    }
    setIsLoading(true);
    try {
      persistSession(await api.register({ fullName, username, email, password, role }));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("authToken");
      window.localStorage.removeItem("userProfile");
    }
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!token, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
