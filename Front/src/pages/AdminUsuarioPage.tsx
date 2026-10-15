import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DispositivoDashboard } from "../components/DispositivoDashboard";
import { AdminApi } from "../services/admin.service";
import { mensajeError } from "../services/errors";
import type { DispositivosDeUsuario } from "../types/api";

// El superadmin ve los dashboards de un usuario: mismos paneles, tiempo real y
// exportación a CSV, pero sin poder cambiar la válvula, el límite ni la configuración.
export function AdminUsuarioPage() {
  const { id } = useParams();
  const [datos, setDatos] = useState<DispositivosDeUsuario | null>(null);
  const [vista, setVista] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AdminApi.dispositivosDeUsuario(Number(id))
      .then((d) => {
        setDatos(d);
        setVista(d.dispositivos[0]?.id_dispositivo ?? null);
      })
      .catch((err) => setError(mensajeError(err, "No se pudieron cargar los dispositivos del usuario")));
  }, [id]);

  const seleccionado = datos?.dispositivos.find((d) => d.id_dispositivo === vista);

  return (
    <div className="admin-shell">
      <header className="dashboard-topbar">
        <div>
          <div className="dashboard-kicker">Superadministrador · dashboards de un usuario</div>
          <h1>{datos?.usuario.nombre ?? "Usuario"}</h1>
          <p>{datos?.usuario.email}</p>
        </div>
        <Link to="/admin" className="btn-secundario">← Volver a usuarios</Link>
      </header>

      {error && <p className="auth-error">{error}</p>}

      {datos && datos.dispositivos.length === 0 && (
        <div className="estado-vacio">
          <div className="estado-vacio-icono">≈</div>
          <h2>Este usuario no tiene dispositivos vinculados</h2>
        </div>
      )}

      {datos && datos.dispositivos.length > 0 && (
        <>
          <nav className="dashboard-tabs" aria-label="Dispositivos del usuario">
            {datos.dispositivos.map((d) => (
              <button
                key={d.id_dispositivo}
                className={d.id_dispositivo === vista ? "activa" : ""}
                onClick={() => setVista(d.id_dispositivo)}
              >
                <span className={`punto-estado ${d.en_linea ? "en-linea" : ""}`} /> &nbsp;{d.nombre}
              </button>
            ))}
          </nav>
          {seleccionado && (
            <DispositivoDashboard key={seleccionado.id_dispositivo} dispositivo={seleccionado} soloLectura />
          )}
        </>
      )}
    </div>
  );
}
