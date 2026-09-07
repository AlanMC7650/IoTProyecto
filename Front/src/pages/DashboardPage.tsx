import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SerieDashboard } from "../components/SerieDashboard";
import type { TipoSerie } from "../types/api";

const TABS: { tipo: TipoSerie; label: string }[] = [
  { tipo: "leibniz", label: "Leibniz" },
  { tipo: "fibonacci", label: "Fibonacci" },
  { tipo: "taylor", label: "Taylor" },
];

export function DashboardPage() {
  const { cliente, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TipoSerie>("leibniz");

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="dashboard-screen">
      <header className="dashboard-header">
        <h1>Series Matemáticas</h1>
        <div className="dashboard-user">
          <span>{cliente?.nombre}</span>
          <button className="btn-secundario" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <nav className="dashboard-tabs">
        {TABS.map((t) => (
          <button
            key={t.tipo}
            className={t.tipo === tab ? "activa" : ""}
            onClick={() => setTab(t.tipo)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        <SerieDashboard key={tab} tipo={tab} />
      </main>
    </div>
  );
}
