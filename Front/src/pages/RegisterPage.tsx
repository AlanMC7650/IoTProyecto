import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { mensajeError } from "../services/errors";

export function RegisterPage() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await registrar({ nombre, identificador, email, password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(mensajeError(err, "No se pudo completar el registro"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Series Matemáticas</h1>
        <p className="auth-subtitle">Crear cuenta</p>

        <label>
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label>
          Identificador
          <input
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            required
            placeholder="ej: legajo o cédula"
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Creando cuenta..." : "Registrarme"}
        </button>

        <p className="auth-switch">
          ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
        </p>
      </form>
    </div>
  );
}
