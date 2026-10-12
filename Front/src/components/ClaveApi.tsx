import { useRef, useState } from "react";

// Muestra la clave API recién generada. El Back solo la devuelve una vez.
export function ClaveApi({ apiKey }: { apiKey: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copiada, setCopiada] = useState(false);

  async function onCopiar() {
    try {
      await navigator.clipboard.writeText(apiKey);
    } catch {
      // navigator.clipboard solo existe en localhost o https: si se entra por
      // la IP de la red se copia seleccionando el texto del input.
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopiada(true);
    setTimeout(() => setCopiada(false), 2000);
  }

  return (
    <div className="clave-api">
      <strong>Clave API del dispositivo</strong>
      <div className="clave-api-fila">
        <input
          ref={inputRef}
          readOnly
          value={apiKey}
          aria-label="Clave API"
          onFocus={(e) => e.target.select()}
        />
        <button type="button" onClick={onCopiar}>{copiada ? "¡Copiada!" : "Copiar"}</button>
      </div>
      <p>
        Pegala en <code>API_KEY</code> dentro del <code>config.py</code> del ESP32.{" "}
        <b>Solo se muestra esta vez:</b> si la perdés vas a tener que regenerarla.
      </p>
    </div>
  );
}
