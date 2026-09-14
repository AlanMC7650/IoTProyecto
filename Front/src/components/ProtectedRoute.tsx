import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { cliente, cargando } = useAuth();

  if (cargando) return <div className="page-loading">Cargando...</div>;
  if (!cliente) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
