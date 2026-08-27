"use client";

import { useRouter } from "next/navigation";

export default function TopBar({ user, titulo, children }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{titulo}</h1>
          <p className="text-xs text-gray-500">
            {user.nombre} · {user.rol === "admin" ? "Administrador" : `Decano · ${user.facultad}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {children}
          <button onClick={handleLogout} className="btn-secondary">
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
