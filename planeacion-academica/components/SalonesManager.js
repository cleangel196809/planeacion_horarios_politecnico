"use client";

import { useEffect, useMemo, useState } from "react";
import { useSedes } from "@/lib/useSedes";
import { IconUpload, IconSave, IconPlus, IconX, IconTrash } from "@/components/Icons";

// Administración de salones por sede: carga masiva por Excel (una hoja por
// sede) o alta/edición uno por uno, más borrado individual o por sede
// completa. La usan tanto el administrador como la secretaría académica
// (ambos con los mismos permisos sobre /api/admin/salones).
export default function SalonesManager() {
  const SEDES = useSedes();
  const [salones, setSalones] = useState([]);
  const [nuevoSalon, setNuevoSalon] = useState({
    id: null,
    sede: "",
    nombre: "",
    planta: "",
    capacidad: "",
    identificador: "",
    observaciones: ""
  });
  const [errorSalon, setErrorSalon] = useState("");
  const [guardandoSalon, setGuardandoSalon] = useState(false);
  const [archivoSalones, setArchivoSalones] = useState(null);
  const [importandoSalones, setImportandoSalones] = useState(false);
  const [mensajeSalones, setMensajeSalones] = useState(null);
  const [errorImportSalones, setErrorImportSalones] = useState("");
  const [filtroSedeSalon, setFiltroSedeSalon] = useState("");

  function cargarSalones() {
    fetch("/api/admin/salones")
      .then((r) => r.json())
      .then((d) => setSalones(d.salones || []));
  }

  useEffect(() => {
    cargarSalones();
  }, []);

  // Si todavía no se ha elegido sede en el formulario de alta, se precarga
  // con la primera disponible en cuanto llega la lista real de sedes.
  useEffect(() => {
    if (!nuevoSalon.sede && SEDES.length > 0) {
      setNuevoSalon((prev) => (prev.sede ? prev : { ...prev, sede: SEDES[0].value }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SEDES]);

  async function handleGuardarSalon(e) {
    e.preventDefault();
    setErrorSalon("");
    setGuardandoSalon(true);
    try {
      const res = await fetch("/api/admin/salones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoSalon)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNuevoSalon({
        id: null,
        sede: SEDES[0]?.value || "",
        nombre: "",
        planta: "",
        capacidad: "",
        identificador: "",
        observaciones: ""
      });
      cargarSalones();
    } catch (err) {
      setErrorSalon(err.message);
    } finally {
      setGuardandoSalon(false);
    }
  }

  async function eliminarSalon(id, nombre) {
    if (!confirm(`¿Eliminar el salón "${nombre}"?`)) return;
    await fetch("/api/admin/salones", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    cargarSalones();
  }

  // Borra de un solo golpe todos los salones cargados para una sede (por
  // ejemplo, para limpiar una sede cargada por error antes de reimportarla).
  async function eliminarSalonesDeSede(sede, cantidad) {
    if (
      !confirm(
        `¿Eliminar los ${cantidad} salones de "${sede}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    setErrorSalon("");
    try {
      const res = await fetch("/api/admin/salones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sede })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFiltroSedeSalon("");
      cargarSalones();
    } catch (err) {
      setErrorSalon(err.message);
    }
  }

  function editarSalon(s) {
    setNuevoSalon({
      id: s.id,
      sede: s.sede,
      nombre: s.nombre,
      planta: s.planta || "",
      capacidad: s.capacidad ?? "",
      identificador: s.identificador || "",
      observaciones: s.observaciones || ""
    });
  }

  async function handleImportarSalones(e) {
    e.preventDefault();
    setErrorImportSalones("");
    setMensajeSalones(null);
    if (!archivoSalones) {
      setErrorImportSalones("Selecciona el archivo Excel de salones.");
      return;
    }
    setImportandoSalones(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivoSalones);
      const res = await fetch("/api/admin/salones/importar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMensajeSalones(data);
      cargarSalones();
    } catch (err) {
      setErrorImportSalones(err.message);
    } finally {
      setImportandoSalones(false);
    }
  }

  const sedesSalones = useMemo(() => {
    const set = new Set(salones.map((s) => s.sede).filter(Boolean));
    return [...set].sort();
  }, [salones]);

  const salonesFiltrados = useMemo(() => {
    if (!filtroSedeSalon) return salones;
    return salones.filter((s) => s.sede === filtroSedeSalon);
  }, [salones, filtroSedeSalon]);

  return (
    <section className="card">
      <h2 className="font-semibold text-gray-900 mb-1">Salones por sede</h2>
      <p className="text-sm text-gray-500 mb-4">
        El catálogo de salones alimenta la lista desplegable que ven los decanos al asignar el
        salón de una clase, filtrada por la sede del grupo. Puedes cargar el Excel con una hoja
        por sede (el nombre de la hoja se toma como la sede) o agregar/editar un salón a la vez.
      </p>

      <form onSubmit={handleImportarSalones} className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="label">Archivo Excel de salones</label>
          <input
            type="file"
            accept=".xlsx"
            className="input"
            onChange={(e) => setArchivoSalones(e.target.files?.[0] || null)}
          />
          <p className="text-xs text-gray-400 mt-1">
            Una hoja por sede (el nombre de la hoja = la sede), con columnas Planta, Nombre de
            salón, Capacidad, Identificador y Observaciones. Las demás hojas del archivo se
            ignoran automáticamente.
          </p>
        </div>
        <button className="btn-primary" disabled={importandoSalones}>
          <IconUpload /> {importandoSalones ? "Cargando..." : "Cargar salones"}
        </button>
      </form>
      {errorImportSalones && <p className="text-sm text-red-600 mb-3">{errorImportSalones}</p>}
      {mensajeSalones && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
          {mensajeSalones.salonesCargados} salón(es) cargado(s) · Sedes: {mensajeSalones.sedes.join(", ")}.
          {mensajeSalones.hojasIgnoradas?.length > 0 &&
            ` Hojas ignoradas (no tenían columnas de salón): ${mensajeSalones.hojasIgnoradas.join(", ")}.`}
        </p>
      )}

      <form
        onSubmit={handleGuardarSalon}
        className="grid sm:grid-cols-6 gap-3 items-end mb-4 border-t border-gray-200 pt-4"
      >
        <div>
          <label className="label">Sede</label>
          <select
            className="input"
            value={nuevoSalon.sede}
            onChange={(e) => setNuevoSalon({ ...nuevoSalon, sede: e.target.value })}
          >
            {SEDES.filter((s) => s.value !== "ASISTIDA POR TECNOLOGIA").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Nombre del salón</label>
          <input
            className="input"
            value={nuevoSalon.nombre}
            onChange={(e) => setNuevoSalon({ ...nuevoSalon, nombre: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Planta</label>
          <input
            className="input"
            value={nuevoSalon.planta}
            onChange={(e) => setNuevoSalon({ ...nuevoSalon, planta: e.target.value })}
            placeholder="Piso 1"
          />
        </div>
        <div>
          <label className="label">Capacidad</label>
          <input
            type="number"
            min="0"
            className="input"
            value={nuevoSalon.capacidad}
            onChange={(e) => setNuevoSalon({ ...nuevoSalon, capacidad: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Identificador</label>
          <input
            className="input"
            value={nuevoSalon.identificador}
            onChange={(e) => setNuevoSalon({ ...nuevoSalon, identificador: e.target.value })}
            placeholder="COC 1"
          />
        </div>
        <div className="sm:col-span-5">
          <label className="label">Observaciones</label>
          <input
            className="input"
            value={nuevoSalon.observaciones}
            onChange={(e) => setNuevoSalon({ ...nuevoSalon, observaciones: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={guardandoSalon}>
            {nuevoSalon.id ? <IconSave /> : <IconPlus />}{" "}
            {guardandoSalon ? "Guardando..." : nuevoSalon.id ? "Guardar cambios" : "Agregar salón"}
          </button>
          {nuevoSalon.id && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setNuevoSalon({
                  id: null,
                  sede: SEDES[0]?.value || "",
                  nombre: "",
                  planta: "",
                  capacidad: "",
                  identificador: "",
                  observaciones: ""
                })
              }
            >
              <IconX /> Cancelar
            </button>
          )}
        </div>
      </form>
      {errorSalon && <p className="text-sm text-red-600 mb-3">{errorSalon}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <label className="label mb-0">Filtrar por sede</label>
          <select
            className="input max-w-xs"
            value={filtroSedeSalon}
            onChange={(e) => setFiltroSedeSalon(e.target.value)}
          >
            <option value="">Todas ({salones.length})</option>
            {sedesSalones.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {filtroSedeSalon && (
          <button
            type="button"
            className="btn-danger"
            onClick={() => eliminarSalonesDeSede(filtroSedeSalon, salonesFiltrados.length)}
          >
            <IconTrash /> Eliminar todos los de {filtroSedeSalon} ({salonesFiltrados.length})
          </button>
        )}
      </div>

      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-1 pr-3">Sede</th>
              <th className="py-1 pr-3">Salón</th>
              <th className="py-1 pr-3">Planta</th>
              <th className="py-1 pr-3">Capacidad</th>
              <th className="py-1 pr-3">Identificador</th>
              <th className="py-1 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {salonesFiltrados.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="py-1.5 pr-3">{s.sede}</td>
                <td className="py-1.5 pr-3">{s.nombre}</td>
                <td className="py-1.5 pr-3">{s.planta || "—"}</td>
                <td className="py-1.5 pr-3">{s.capacidad ?? "—"}</td>
                <td className="py-1.5 pr-3">{s.identificador || "—"}</td>
                <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                  <button
                    className="text-brand-600 text-xs font-medium mr-3"
                    onClick={() => editarSalon(s)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-red-600 text-xs font-medium"
                    onClick={() => eliminarSalon(s.id, s.nombre)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {salonesFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-400">
                  Todavía no hay salones cargados{filtroSedeSalon ? " para esta sede" : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
