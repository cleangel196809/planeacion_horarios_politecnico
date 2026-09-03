"use client";

import { useEffect, useState } from "react";
import { IconDownload, IconTrash } from "@/components/Icons";

// Mantenimiento de la base de datos, para uso exclusivo del administrador:
// (1) copia de seguridad completa descargable en cualquier momento, y
// (2) eliminación controlada de todos los datos de un período (catálogo,
// planeación con sus horarios, y el archivo de estudiantes cargado para ese
// período), útil para limpiar un ciclo cargado por error o ya cerrado hace
// tiempo antes de empezar el siguiente.
//
// La eliminación sigue las mismas "normas del CRUD" para un borrado seguro
// que exige el backend (ver app/api/admin/eliminar-periodo/route.js): solo
// admin, dentro de una transacción, y con confirmación explícita — aquí en
// la interfaz eso se ve como tener que escribir de nuevo el nombre exacto
// del período (además del diálogo de confirmación del navegador) antes de
// que el botón de eliminar se habilite.
export default function MantenimientoBD() {
  const [descargando, setDescargando] = useState(false);
  const [errorBackup, setErrorBackup] = useState("");

  const [periodos, setPeriodos] = useState([]);
  const [periodoEliminar, setPeriodoEliminar] = useState("");
  const [confirmacionTexto, setConfirmacionTexto] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState("");
  const [resultadoEliminar, setResultadoEliminar] = useState(null);

  useEffect(() => {
    fetch("/api/periodos")
      .then((r) => r.json())
      .then((d) => setPeriodos(d.periodos || []));
  }, []);

  async function descargarBackup() {
    setDescargando(true);
    setErrorBackup("");
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo generar la copia de seguridad.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      const nombreArchivo = match ? match[1] : `backup_planeacion_academica_${Date.now()}.sql`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setErrorBackup(err.message);
    } finally {
      setDescargando(false);
    }
  }

  const puedeEliminar =
    periodoEliminar.length > 0 && confirmacionTexto.trim() === periodoEliminar.trim();

  async function eliminarPeriodo() {
    if (!puedeEliminar) return;
    if (
      !confirm(
        `¿Eliminar TODOS los datos del período "${periodoEliminar}" (catálogo, planeación, horarios y estudiantes cargados)?\n\nEsta acción no se puede deshacer. Si crees que podrías necesitar estos datos más adelante, cancela y descarga primero la copia de seguridad.`
      )
    ) {
      return;
    }
    setEliminando(true);
    setErrorEliminar("");
    setResultadoEliminar(null);
    try {
      const res = await fetch("/api/admin/eliminar-periodo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: periodoEliminar, confirmacion: confirmacionTexto.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultadoEliminar(data);
      setPeriodos((prev) => prev.filter((p) => p !== data.periodo));
      setPeriodoEliminar("");
      setConfirmacionTexto("");
    } catch (err) {
      setErrorEliminar(err.message);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <section className="card">
      <h2 className="font-semibold text-gray-900 mb-1">6. Mantenimiento de la base de datos</h2>
      <p className="text-sm text-gray-500 mb-4">
        Copia de seguridad y eliminación de datos, solo para el administrador. La eliminación es
        permanente: descarga siempre primero una copia de seguridad si crees que podrías necesitar
        los datos más adelante.
      </p>

      <div className="border-b border-gray-100 pb-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Copia de seguridad (backup)</h3>
        <p className="text-sm text-gray-500 mb-3">
          Descarga un respaldo completo de todas las tablas (usuarios, catálogo, planeación,
          horarios, docentes, salones, sedes y estudiantes) en un archivo .sql listo para pegar en
          el editor SQL de Neon si alguna vez necesitas restaurarlo.
        </p>
        <button className="btn-secondary" onClick={descargarBackup} disabled={descargando}>
          <IconDownload /> {descargando ? "Generando copia..." : "Descargar copia de seguridad"}
        </button>
        {errorBackup && <p className="text-sm text-red-600 mt-2">{errorBackup}</p>}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Eliminar los datos de un período</h3>
        <p className="text-sm text-gray-500 mb-3">
          Borra el catálogo, la planeación con sus horarios y el archivo de estudiantes cargados
          para un período específico (por ejemplo, un ciclo cerrado hace tiempo o cargado por
          error). No afecta a otros períodos ni a los usuarios, sedes, salones o docentes.
        </p>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div className="min-w-[200px]">
            <label className="label">Período a eliminar</label>
            <select
              className="input"
              value={periodoEliminar}
              onChange={(e) => {
                setPeriodoEliminar(e.target.value);
                setConfirmacionTexto("");
                setResultadoEliminar(null);
                setErrorEliminar("");
              }}
            >
              <option value="">Selecciona un período...</option>
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {periodoEliminar && (
            <div className="min-w-[220px]">
              <label className="label">Escribe &quot;{periodoEliminar}&quot; para confirmar</label>
              <input
                className="input"
                value={confirmacionTexto}
                onChange={(e) => setConfirmacionTexto(e.target.value)}
                placeholder={periodoEliminar}
              />
            </div>
          )}
          <button
            className="btn-danger"
            disabled={!puedeEliminar || eliminando}
            onClick={eliminarPeriodo}
          >
            <IconTrash /> {eliminando ? "Eliminando..." : "Eliminar período"}
          </button>
        </div>
        {errorEliminar && <p className="text-sm text-red-600 mb-2">{errorEliminar}</p>}
        {resultadoEliminar && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Se eliminaron del período {resultadoEliminar.periodo}: {resultadoEliminar.eliminado.catalogo}{" "}
            asignatura(s) de catálogo, {resultadoEliminar.eliminado.planeacion} grupo(s) de
            planeación, {resultadoEliminar.eliminado.horarios} horario(s) y{" "}
            {resultadoEliminar.eliminado.estudiantes} estudiante(s).
          </p>
        )}
      </div>
    </section>
  );
}
