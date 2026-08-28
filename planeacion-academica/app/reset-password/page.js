"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Este enlace no es válido. Solicita uno nuevo desde la pantalla de inicio de sesión.");
      return;
    }
    if (passwordNueva !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/restablecer-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, passwordNueva })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExito(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Restablecer contraseña</h1>
        </div>

        {exito ? (
          <div className="card text-center space-y-2">
            <p className="text-sm text-green-700">
              Tu contraseña fue actualizada. Te llevamos al inicio de sesión...
            </p>
            <Link href="/login" className="text-sm text-brand-600 underline">
              Ir ahora
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            {!token && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Este enlace no trae un token válido. Ábrelo directamente desde el correo que
                recibiste, o solicita uno nuevo desde la pantalla de inicio de sesión.
              </p>
            )}
            <div>
              <label className="label">Nueva contraseña</label>
              <input
                type="password"
                className="input"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input
                type="password"
                className="input"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                minLength={6}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Guardando..." : "Restablecer contraseña"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
