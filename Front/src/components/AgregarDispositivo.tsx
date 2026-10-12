import { useState } from "react";
import type { FormEvent } from "react";
import { DispositivosApi } from "../services/dispositivos.service";
import { mensajeError } from "../services/errors";
import type { DispositivoCreado } from "../types/api";
import { ClaveApi } from "./ClaveApi";

interface Props {
  onCreado: (creado: DispositivoCreado) => void;
  onVerDispositivo: (id_dispositivo: number) => void;
}

export function AgregarDispositivo({ onCreado, onVerDispositivo }: Props) {
  const [nombre, setNombre] = useState("");
  const [creado, setCreado] = useState<DispositivoCreado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const resultado = await DispositivosApi.crear(nombre);
      setCreado(resultado);
      onCreado(resultado);
    } catch (err) {
      setError(mensajeError(err, "No se pudo registrar el dispositivo"));
    } finally {
      setEnviando(false);
    }
  }

  if (creado) {
    return (
      <section className="serie-dashboard">
        <header>
          <h2>“{creado.dispositivo.nombre}” quedó registrado</h2>
          <p className="serie-descripcion">
            Falta cargar su clave en el ESP32 para que empiece a enviar lecturas.
          </p>
        </header>

        <div className="panel">
          <ClaveApi apiKey={creado.api_key} />
          <div className="panel-acciones">
            <button
              type="button"
              className="btn-primary"
              onClick={() => onVerDispositivo(creado.dispositivo.id_dispositivo)}
            >
              Ir al dispositivo
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="serie-dashboard">
      <header>
        <h2>Agregar dispositivo</h2>
        <p className="serie-descripcion">
          Registrá un ESP32 con caudalímetro para obtener la clave API con la que envía sus lecturas.
        </p>
      </header>

      <form className="generar-form" onSubmit={onSubmit}>
        <label>
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="ej: Canilla de la cocina"
            maxLength={100}
            required
            autoFocus
          />
        </label>
        <button type="submit" disabled={enviando}>
          {enviando ? "Registrando..." : "Registrar dispositivo"}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}
    </section>
  );
}
