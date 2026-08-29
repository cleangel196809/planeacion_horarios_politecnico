"use client";

import { useState } from "react";
import { IconSave } from "@/components/Icons";

export default function CambiarPasswordModal({ onDone }) {
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordActual, passwordNueva })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <img src="/isologo.png" alt="Politécnico Internacional" className="h-9 w-auto shrink-0" />
          <h2 className="text-lg font-semibold text-brand-900 border-l border-brand-100 pl-3">
            Cambia tu contraseña
          </h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Por seguridad debes definir una nueva contraseña antes de continuar.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Contraseña actual</label>
            <input
              type="password"
              className="input"
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Nueva contraseña (mín. 6 caracteres)</label>
            <input
              type="password"
              className="input"
              value={passwordNueva}
              onChange={(e) => setPasswordNueva(e.target.value)}
              minLength={6}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            <IconSave /> {loading ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
