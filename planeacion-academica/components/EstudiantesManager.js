"use client";

import { useState } from "react";
import { IconUpload, IconTrash } from "@/components/Icons";

// Carga y consulta del archivo base de estudiantes (documento, nombre y, si
// vienen en el archivo, programa/plan/ciclo/asignatura/grupo y datos de
// contacto). Es informativa: no depende del catálogo ni de la planeación, así
// que se puede cargar en cualquier momento del período.
export default function EstudiantesManager() {
  const [periodo, setPeriodo] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [errorImport, setErrorImport] = useState("");

  const [periodoConsulta, setPeriodoConsulta] = useState("");
  const [facultadConsulta, setFacultadConsulta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estudiantes, setEstudiantes] = useState([]);
  const [total, setTotal] = useState(0);
  const [limite, setLimite] = useState(0);
  const [consultando, setConsultando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState("");

  async function handleImportar(e) {
    e.preventDefault();
    setErrorImport("");
    setMensaje(null);
    if (!archivo || !periodo) {
      setErrorImport("Selecciona el archivo y escribe el período.");
      return;
    }
    setImportando(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("periodo", periodo);
      const res = await fetch("/api/admin/estudiantes/importar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMensaje(data);
      setPeriodoConsulta(periodo);
      await consultar(periodo, facultadConsulta, busqueda);
    } catch (err) {
      setErrorImport(err.message);
    } finally {
      setImportando(false);
    }
  }

  async function consultar(p, f, q) {
    if (!p) return;
    setConsultando(true);
    setErrorConsulta("");
    try {
      const params = new URLSearchParams({ periodo: p });
      if (f) params.set("facultad", f);
      if (q) params.set("q", q);
      const res = await fetch(`/api/admin/estudiantes?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEstudiantes(data.estudiantes || []);
      setTotal(data.total || 0);
      setLimite(data.limite || 0);
    } catch (err) {
      setErrorConsulta(err.message);
    } finally {
      setConsultando(false);
    }
  }

  async function eliminarUno(id) {
    if (!confirm("¿Eliminar este estudiante del archivo cargado?")) return;
    await fetch("/api/admin/estudiantes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    consultar(periodoConsulta, facultadConsulta, busqueda);
  }

  async function eliminarCarga() {
    if (!periodoConsulta) return;
    const alcance = facultadConsulta ? `de ${facultadConsulta} ` : "";
    if (
      !confirm(
        `¿Eliminar TODO el archivo de estudiantes ${alcance}cargado para el período ${periodoConsulta}? Esta acción no se puede deshacer.`
      )
    )
      return;
    const res = await fetch("/api/admin/estudiantes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodo: periodoConsulta, facultad: facultadConsulta || undefined })
    });
    if (res.ok) consultar(periodoConsulta, facultadConsulta, busqueda);
  }

  return (
    <section className="card">
      <h2 className="font-semibold text-gray-900 mb-1">Archivo base de estudiantes</h2>
      <p className="text-sm text-gray-500 mb-4">
        Sube el Excel con la base de estudiantes (documento, nombre y, si vienen, programa, plan,
        ciclo, asignatura/grupo matriculado, correo y teléfono). Puedes volver a subirlo para
        actualizar los datos de un mismo período.
      </p>

      <form onSubmit={handleImportar} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Período</label>
          <input
            className="input"
            placeholder="Ej: 2026-2T"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Archivo Excel</label>
          <input
            type="file"
            accept=".xlsx"
            className="input"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          />
        </div>
        <button className="btn-primary" disabled={importando}>
          <IconUpload /> {importando ? "Cargando..." : "Cargar estudiantes"}
        </button>
      </form>
      {errorImport && <p className="text-sm text-red-600 mt-3">{errorImport}</p>}
      {mensaje && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-3">
          {mensaje.estudiantesCargados} estudiante(s) cargado(s) para el período {mensaje.periodo}.
          {mensaje.facultades.length > 0 && ` Facultades: ${mensaje.facultades.join(", ")}.`}
        </p>
      )}

      <div className="border-t border-gray-200 mt-5 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Consultar lo ya cargado</h3>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <label className="label">Período</label>
            <input
              className="input"
              placeholder="Ej: 2026-2T"
              value={periodoConsulta}
              onChange={(e) => setPeriodoConsulta(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Facultad (opcional)</label>
            <input
              className="input"
              value={facultadConsulta}
              onChange={(e) => setFacultadConsulta(e.target.value)}
              placeholder="Como aparece en el archivo"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="label">Buscar (nombre o documento)</label>
            <input
              className="input"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => consultar(periodoConsulta, facultadConsulta, busqueda)}
            disabled={consultando || !periodoConsulta}
          >
            {consultando ? "Buscando..." : "Buscar"}
          </button>
          {estudiantes.length > 0 && (
            <button type="button" className="btn-danger" onClick={eliminarCarga}>
              <IconTrash /> Eliminar esta carga
            </button>
          )}
        </div>
        {errorConsulta && <p className="text-sm text-red-600 mb-3">{errorConsulta}</p>}

        {estudiantes.length > 0 && (
          <>
            <p className="text-xs text-gray-500 mb-2">
              {total} estudiante(s) encontrados{limite && total > limite ? ` (mostrando los primeros ${limite})` : ""}.
            </p>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1 pr-3">Documento</th>
                    <th className="py-1 pr-3">Nombre</th>
                    <th className="py-1 pr-3">Facultad</th>
                    <th className="py-1 pr-3">Programa</th>
                    <th className="py-1 pr-3">Ciclo</th>
                    <th className="py-1 pr-3">Asignatura</th>
                    <th className="py-1 pr-3">Grupo</th>
                    <th className="py-1 pr-3">Contacto</th>
                    <th className="py-1 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {estudiantes.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">{e.documento}</td>
                      <td className="py-1.5 pr-3">{e.nombre_completo}</td>
                      <td className="py-1.5 pr-3">{e.facultad || "—"}</td>
                      <td className="py-1.5 pr-3">{e.programa || "—"}</td>
                      <td className="py-1.5 pr-3">{e.ciclo || "—"}</td>
                      <td className="py-1.5 pr-3">{e.asignatura || "—"}</td>
                      <td className="py-1.5 pr-3">{e.grupo || "—"}</td>
                      <td className="py-1.5 pr-3">{e.correo || e.telefono || "—"}</td>
                      <td className="py-1.5 pr-3 text-right">
                        <button
                          className="text-red-600 text-xs font-medium"
                          onClick={() => eliminarUno(e.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
