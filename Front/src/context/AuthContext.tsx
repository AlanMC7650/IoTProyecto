import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AuthApi } from "../services/auth.service";
import type { Cliente, LoginPayload, RegistroPayload } from "../types/api";

interface AuthContextValue {
  cliente: Cliente | null;
  cargando: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  registrar: (payload: RegistroPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setCargando(false);
      return;
    }
    AuthApi.perfil()
      .then(setCliente)
      .catch(() => {
        localStorage.removeItem("token");
        setCliente(null);
      })
      .finally(() => setCargando(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      cliente,
      cargando,
      async login(payload) {
        const { cliente, token } = await AuthApi.login(payload);
        localStorage.setItem("token", token);
        setCliente(cliente);
      },
      async registrar(payload) {
        const { cliente, token } = await AuthApi.registrar(payload);
        localStorage.setItem("token", token);
        setCliente(cliente);
      },
      logout() {
        localStorage.removeItem("token");
        setCliente(null);
      },
    }),
    [cliente, cargando]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
