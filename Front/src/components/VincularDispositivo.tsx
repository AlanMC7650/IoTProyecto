import { useState } from "react";
import type { FormEvent } from "react";
import { DispositivosApi } from "../services/dispositivos.service";
import { mensajeError } from "../services/errors";
import type { Dispositivo } from "../types/api";

interface Props {
  onVinculado: (dispositivo: Dispositivo) => void;
}

export function VincularDispositivo({ onVinculado }: Props) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      onVinculado(await DispositivosApi.vincular(codigo, nombre));
    } catch (err) {
      setError(mensajeError(err, "No se pudo vincular el dispositivo"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="serie-dashboard">
      <header>
        <h2>Agregar dispositivo</h2>
        <p className="serie-descripcion">
          No hace falta copiar ninguna clave al ESP32: se vincula con el código que muestra al encenderse.
        </p>
      </header>

      <ol className="pasos-vinculacion">
        <li>
          <strong>Conectá el ESP32 a tu Wi-Fi.</strong> Si es la primera vez, crea la red{" "}
          <code>AquaControl-XXXXXX</code>: conectate con el celular, abrí <code>http://192.168.4.1</code>, elegí
          tu red y escribí la contraseña.
        </li>
        <li>
          <strong>Esperá el LED azul parpadeando.</strong> Significa que el ESP32 está conectado y esperando que lo
          vincules. Su código son las 6 letras y números de la red <code>AquaControl-XXXXXX</code>; también aparece en
          la consola de Thonny.
        </li>
        <li><strong>Escribí el código y un nombre</strong> para el dispositivo.</li>
      </ol>

      <form className="generar-form" onSubmit={onSubmit}>
        <label>
          Código
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 6))}
            placeholder="ej: 3F2A1B"
            className="input-codigo"
            required
            minLength={6}
            autoFocus
          />
        </label>
        <label>
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="ej: Cocina"
            maxLength={100}
            required
          />
        </label>
        <button type="submit" disabled={enviando || codigo.length !== 6}>
          {enviando ? "Vinculando..." : "Vincular"}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}
    </section>
  );
}
