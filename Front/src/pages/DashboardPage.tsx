import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DispositivoDashboard } from "../components/DispositivoDashboard";
import { VincularDispositivo } from "../components/VincularDispositivo";
import { DispositivosApi } from "../services/dispositivos.service";
import { mensajeError } from "../services/errors";
import type { Dispositivo } from "../types/api";

// Cada cuánto se refresca la lista (para el punto de en línea / desconectado).
// Cada pedido pasa por ngrok (20 000 peticiones por mes en el plan gratuito),
// así que es poco frecuente; el dispositivo abierto se actualiza en tiempo real.
const POLL_DISPOSITIVOS_MS = 60_000;

type Vista = number | "nuevo" | null;

export function DashboardPage() {
  const { cliente, logout } = useAuth();
  const navigate = useNavigate();
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [vista, setVista] = useState<Vista>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      if (document.visibilityState !== "visible") return;
      try {
        const data = await DispositivosApi.listar();
        if (cancelado) return;
        setDispositivos(data);
        setVista((actual) => actual ?? data[0]?.id_dispositivo ?? null);
        setError(null);
      } catch (err) {
        if (!cancelado) setError(mensajeError(err, "No se pudieron cargar los dispositivos"));
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargar();
    const intervalo = setInterval(cargar, POLL_DISPOSITIVOS_MS);
    document.addEventListener("visibilitychange", cargar);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", cargar);
    };
  }, []);

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function onVinculado(dispositivo: Dispositivo) {
    setDispositivos((prev) => [...prev, dispositivo]);
    setVista(dispositivo.id_dispositivo);
  }

  function onActualizado(actualizado: Dispositivo) {
    setDispositivos((prev) =>
      prev.map((d) => (d.id_dispositivo === actualizado.id_dispositivo ? actualizado : d))
    );
  }

  function onDesvinculado(id_dispositivo: number) {
    const restantes = dispositivos.filter((d) => d.id_dispositivo !== id_dispositivo);
    setDispositivos(restantes);
    setVista(restantes[0]?.id_dispositivo ?? null);
  }

  const inicial = cliente?.nombre?.charAt(0).toUpperCase() ?? "U";
  const seleccionado = dispositivos.find((d) => d.id_dispositivo === vista);

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">≈</div>
          <div>
            <strong>AquaControl</strong>
            <small>Mide. Controla. Ahorra.</small>
          </div>
        </div>

        <div className="sidebar-section">Dispositivos</div>
        <nav className="sidebar-nav">
          {dispositivos.map((d) => (
            <button
              key={d.id_dispositivo}
              className={d.id_dispositivo === vista ? "activa" : ""}
              title={`${d.nombre} · ${d.en_linea ? "en línea" : "desconectado"}`}
              onClick={() => setVista(d.id_dispositivo)}
            >
              <span className="sidebar-icon">
                <span className={`punto-estado ${d.en_linea ? "en-linea" : ""}`} />
              </span>
              <span>{d.nombre}</span>
            </button>
          ))}
          <button className={vista === "nuevo" ? "activa" : ""} onClick={() => setVista("nuevo")}>
            <span className="sidebar-icon">+</span>
            <span>Agregar dispositivo</span>
          </button>
          {cliente?.rol === "admin" && (
            <Link to="/admin" className="sidebar-admin">
              <span className="sidebar-icon">★</span>
              <span>Usuarios (admin)</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{inicial}</div>
            <div>
              <strong>{cliente?.nombre ?? "Usuario"}</strong>
              <small>{cliente?.rol === "admin" ? "Superadministrador" : "Cuenta activa"}</small>
            </div>
          </div>
          <button className="sidebar-logout" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <div className="dashboard-kicker">Dashboard</div>
            <h1>Monitor de agua</h1>
            <p>Caudal, sensor de agua, electroválvula y LED de cada dispositivo, en tiempo real.</p>
          </div>
          <div className="topbar-user">Hola, {cliente?.nombre ?? "Usuario"}</div>
        </header>

        <nav className="dashboard-tabs" aria-label="Dispositivos">
          {dispositivos.map((d) => (
            <button
              key={d.id_dispositivo}
              className={d.id_dispositivo === vista ? "activa" : ""}
              onClick={() => setVista(d.id_dispositivo)}
            >
              <span className={`punto-estado ${d.en_linea ? "en-linea" : ""}`} /> &nbsp;{d.nombre}
            </button>
          ))}
          <button className={vista === "nuevo" ? "activa" : ""} onClick={() => setVista("nuevo")}>
            + &nbsp;Agregar
          </button>
          {cliente?.rol === "admin" && <Link to="/admin" className="tab-admin">★ Usuarios</Link>}
        </nav>

        {error && <p className="auth-error">{error}</p>}

        <main>
          {vista === "nuevo" ? (
            <VincularDispositivo onVinculado={onVinculado} />
          ) : seleccionado ? (
            <DispositivoDashboard
              key={seleccionado.id_dispositivo}
              dispositivo={seleccionado}
              onActualizado={onActualizado}
              onDesvinculado={onDesvinculado}
            />
          ) : cargando ? (
            <p className="muted">Cargando...</p>
          ) : (
            <div className="estado-vacio">
              <div className="estado-vacio-icono">≈</div>
              <h2>Todavía no tenés dispositivos</h2>
              <p>
                Encendé tu ESP32, conectalo a tu Wi-Fi y escribí acá el código de 6 caracteres que muestra.
                No hace falta copiar ninguna clave al dispositivo.
              </p>
              <button type="button" className="btn-primary" onClick={() => setVista("nuevo")}>
                Vincular mi primer dispositivo
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
