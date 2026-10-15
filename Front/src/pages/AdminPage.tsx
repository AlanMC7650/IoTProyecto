import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AdminApi } from "../services/admin.service";
import { mensajeError } from "../services/errors";
import type { UsuarioAdmin } from "../types/api";
import { haceCuanto } from "../utils/tiempo";

export function AdminPage() {
  const { cliente } = useAuth();
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [filtro, setFiltro] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      setUsuarios(await AdminApi.usuarios());
      setError(null);
    } catch (err) {
      setError(mensajeError(err, "No se pudieron cargar los usuarios"));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function onCambiarActivo(u: UsuarioAdmin) {
    const accion = u.activo ? "suspender" : "reactivar";
    if (!window.confirm(`¿${accion[0].toUpperCase() + accion.slice(1)} la cuenta de ${u.nombre}?`)) return;
    try {
      await AdminApi.cambiarActivo(u.id_cliente, !u.activo);
      await cargar();
    } catch (err) {
      setError(mensajeError(err, `No se pudo ${accion} la cuenta`));
    }
  }

  const texto = filtro.trim().toLowerCase();
  const visibles = usuarios.filter((u) =>
    !texto || [u.nombre, u.email, u.identificador].some((v) => v.toLowerCase().includes(texto))
  );
  const activos = usuarios.filter((u) => u.activo).length;
  const conDispositivo = usuarios.filter((u) => u.dispositivos > 0).length;

  return (
    <div className="admin-shell">
      <header className="dashboard-topbar">
        <div>
          <div className="dashboard-kicker">Superadministrador</div>
          <h1>Usuarios registrados</h1>
          <p>Cuentas creadas en AquaControl. Desde “Ver dashboards” podés mirar y exportar los datos de cada usuario.</p>
        </div>
        <Link to="/dashboard" className="btn-secundario">← Volver al dashboard</Link>
      </header>

      <div className="tarjetas">
        <div className="tarjeta"><span className="tarjeta-titulo">Usuarios</span><strong>{usuarios.length}</strong></div>
        <div className="tarjeta"><span className="tarjeta-titulo">Cuentas activas</span><strong>{activos}</strong></div>
        <div className="tarjeta"><span className="tarjeta-titulo">Con algún dispositivo</span><strong>{conDispositivo}</strong></div>
      </div>

      <div className="panel">
        <input className="buscador" placeholder="Buscar por nombre, email o identificador" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        {error && <p className="auth-error">{error}</p>}
        {cargando ? (
          <p className="muted">Cargando...</p>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla-usuarios">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Identificador</th>
                  <th>Rol</th>
                  <th>Registro</th>
                  <th>Dispositivos</th>
                  <th>Último dato</th>
                  <th>Dashboards</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((u) => (
                  <tr key={u.id_cliente} className={u.activo ? "" : "suspendido"}>
                    <td>{u.nombre}</td>
                    <td>{u.email}</td>
                    <td>{u.identificador}</td>
                    <td>{u.rol === "admin" ? "Admin" : "Usuario"}</td>
                    <td>{new Date(u.fecha_registro).toLocaleDateString()}</td>
                    <td>{u.dispositivos}</td>
                    <td>{u.ultima_conexion ? haceCuanto(u.ultima_conexion) : "—"}</td>
                    <td>
                      {u.dispositivos > 0 ? (
                        <button type="button" className="btn-secundario" onClick={() => navigate(`/admin/usuarios/${u.id_cliente}`)}>
                          Ver dashboards
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {u.rol === "admin" || u.id_cliente === cliente?.id_cliente ? (
                        <span className="muted">Activo</span>
                      ) : (
                        <button type="button" className={u.activo ? "btn-peligro" : "btn-secundario"} onClick={() => onCambiarActivo(u)}>
                          {u.activo ? "Suspender" : "Reactivar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibles.length === 0 && <p className="muted">Ningún usuario coincide con la búsqueda.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
