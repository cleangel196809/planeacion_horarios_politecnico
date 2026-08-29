"use client";

import { useRouter } from "next/navigation";
import FormHeader from "@/components/FormHeader";
import { IconLogout } from "@/components/Icons";

export default function TopBar({ user, titulo, children }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b-2 border-brand-600 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <FormHeader
          titulo={titulo}
          subtitulo={`${user.nombre} · ${
            user.rol === "admin"
              ? "Administrador"
              : user.rol === "coordinador"
              ? `Coordinador · ${user.facultad}`
              : `Decano · ${user.facultad}`
          }`}
        />
        <div className="flex items-center gap-3">
          {children}
          <button onClick={handleLogout} className="btn-secondary">
            <IconLogout /> Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
