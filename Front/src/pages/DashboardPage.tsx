import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SerieDashboard } from "../components/SerieDashboard";
import type { TipoSerie } from "../types/api";

const TABS: { tipo: TipoSerie; label: string; icon: string }[] = [
  { tipo: "leibniz", label: "Leibniz", icon: "π" },
  { tipo: "fibonacci", label: "Fibonacci", icon: "φ" },
  { tipo: "taylor", label: "Taylor", icon: "Σ" },
];

export function DashboardPage() {
  const { cliente, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TipoSerie>("leibniz");

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const inicial = cliente?.nombre?.charAt(0).toUpperCase() ?? "U";

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">Σ</div>
          <div>
            <strong>SeriesLab</strong>
            <small>Panel matemático</small>
          </div>
        </div>

        <div className="sidebar-section">Análisis</div>
        <nav className="sidebar-nav">
          {TABS.map((t) => (
            <button key={t.tipo} className={t.tipo === tab ? "activa" : ""} onClick={() => setTab(t.tipo)}>
              <span className="sidebar-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{inicial}</div>
            <div>
              <strong>{cliente?.nombre ?? "Usuario"}</strong>
              <small>Cuenta activa</small>
            </div>
          </div>
          <button className="sidebar-logout" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <div className="dashboard-kicker">Dashboard</div>
            <h1>Series matemáticas</h1>
            <p>Explorá convergencia, error y comportamiento de cada serie.</p>
          </div>
          <div className="topbar-user">Hola, {cliente?.nombre ?? "Usuario"}</div>
        </header>

        <nav className="dashboard-tabs" aria-label="Series disponibles">
          {TABS.map((t) => (
            <button key={t.tipo} className={t.tipo === tab ? "activa" : ""} onClick={() => setTab(t.tipo)}>
              {t.icon} &nbsp;{t.label}
            </button>
          ))}
        </nav>

        <main>
          <SerieDashboard key={tab} tipo={tab} />
        </main>
      </div>
    </div>
  );
}
