"use client";

import { useEffect, useState } from "react";
import { IconPlus } from "@/components/Icons";

// Administración del catálogo de sedes (Calle 73, Calle 80, Norte, Sur,
// Virtual, y cualquiera que agregue la secretaría académica). Una sede
// nueva queda disponible de inmediato en los selectores de sede de salones,
// grupos y catálogo real (ver lib/useSedes.js); desactivar una sede no
// borra los salones/grupos que ya la usan, solo deja de ofrecerla para
// registros nuevos.
export default function SedesManager() {
  const [sedes, setSedes] = useState([]);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function cargarSedes() {
    fetch("/api/admin/sedes")
      .then((r) => r.json())
      .then((d) => setSedes(d.sedes || []));
  }

  useEffect(() => {
    cargarSedes();
  }, []);

  async function agregarSede(e) {
    e.preventDefault();
    setError("");
    if (!nombreNuevo.trim()) {
      setError("Escribe el nombre de la sede.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreNuevo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNombreNuevo("");
      cargarSedes();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActiva(id, activa) {
    await fetch("/api/admin/sedes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, activa: !activa })
    });
    cargarSedes();
  }

  return (
    <section className="card">
      <h2 className="font-semibold text-gray-900 mb-1">Sedes</h2>
      <p className="text-sm text-gray-500 mb-4">
        Estas son las sedes que aparecen para elegir al cargar salones o al programar grupos. Puedes
        agregar una nueva o desactivar una que ya no se use (no se borra, solo deja de ofrecerse
        para registros nuevos; lo que ya tenía asignado sigue igual).
      </p>

      <form onSubmit={agregarSede} className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Nombre de la sede nueva</label>
          <input
            className="input"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Ej: SEDE ORIENTE"
          />
        </div>
        <button className="btn-primary" disabled={guardando}>
          <IconPlus /> {guardando ? "Guardando..." : "Agregar sede"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-1 pr-3">Sede</th>
              <th className="py-1 pr-3">Estado</th>
              <th className="py-1 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {sedes.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="py-1.5 pr-3">{s.nombre}</td>
                <td className="py-1.5 pr-3">
                  <span
                    className={`badge ${s.activa ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {s.activa ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right">
                  <button
                    className="text-brand-600 text-xs font-medium"
                    onClick={() => toggleActiva(s.id, s.activa)}
                  >
                    {s.activa ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
            {sedes.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-gray-400">
                  Cargando sedes...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
