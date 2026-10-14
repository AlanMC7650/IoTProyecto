import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children, soloAdmin = false }: { children: ReactNode; soloAdmin?: boolean }) {
  const { cliente, cargando } = useAuth();

  if (cargando) return <div className="page-loading">Cargando...</div>;
  if (!cliente) return <Navigate to="/login" replace />;
  if (soloAdmin && cliente.rol !== "admin") {
    return (
      <div className="page-loading">
        <p>Acceso denegado: esta página es solo para el administrador.</p>
        <a href="/dashboard">Volver al dashboard</a>
      </div>
    );
  }

  return <>{children}</>;
}
