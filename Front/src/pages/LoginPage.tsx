import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { mensajeError } from "../services/errors";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await login({ email, password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(mensajeError(err, "No se pudo iniciar sesión"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Series Matemáticas</h1>
        <p className="auth-subtitle">Iniciar sesión</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
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
          {enviando ? "Ingresando..." : "Ingresar"}
        </button>

        <p className="auth-switch">
          ¿No tenés cuenta? <Link to="/registro">Registrate</Link>
        </p>
      </form>
    </div>
  );
}
