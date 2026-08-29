"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLogin, IconArrowLeft } from "@/components/Icons";

function OlvidePasswordForm({ onCerrar }) {
  const [username, setUsername] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMensaje("");
    try {
      const res = await fetch("/api/auth/olvide-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      setMensaje(data.mensaje || "Si el usuario existe, te enviamos un enlace a tu correo.");
    } catch (err) {
      setMensaje("No pudimos procesar la solicitud. Intenta de nuevo en unos minutos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-3">
      <p className="text-sm text-gray-600">
        Escribe tu usuario y, si tiene un correo registrado, te enviaremos un enlace para
        restablecer la contraseña.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="input"
          placeholder="Tu usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        {mensaje && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {mensaje}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={loading}>
            <IconLogin /> {loading ? "Enviando..." : "Enviar enlace"}
          </button>
          <button type="button" className="btn-secondary" onClick={onCerrar}>
            <IconArrowLeft /> Volver
          </button>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarOlvide, setMostrarOlvide] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar sesión.");

      router.push(
        data.user.rol === "admin"
          ? "/admin"
          : data.user.rol === "coordinador"
          ? "/coordinador"
          : data.user.rol === "secretaria_academica"
          ? "/secretaria"
          : "/decano"
      );
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8 gap-3">
          <img src="/isologo.png" alt="Politécnico Internacional" className="h-16 w-auto" />
          <div>
            <h1 className="text-2xl font-bold text-brand-900">Planeación Académica</h1>
            <p className="text-sm text-gray-500 mt-1">
              Captura de la planeación del siguiente ciclo de formación
            </p>
          </div>
        </div>

        {mostrarOlvide ? (
          <OlvidePasswordForm onCerrar={() => setMostrarOlvide(false)} />
        ) : (
          <>
            <form onSubmit={handleSubmit} className="card space-y-4">
              <div>
                <label className="label" htmlFor="username">Usuario</label>
                <input
                  id="username"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                <IconLogin /> {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>

            <button
              type="button"
              className="block text-center text-xs text-brand-600 hover:underline mt-6 w-full"
              onClick={() => setMostrarOlvide(true)}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </>
        )}
      </div>
    </main>
  );
}
