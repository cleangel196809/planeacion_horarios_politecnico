"use client";

import { useEffect, useMemo, useState } from "react";
import ProgramacionCicloForm from "@/components/ProgramacionCicloForm";

// Asistente "Selección académica" para el decano:
// Paso 1) Facultad (fija, la del decano) → Programa → Plan → Periodo de
//         formación, con un resumen de la selección.
// Paso 2) "Programación del ciclo": por cada ciclo del plan, el decano marca
//         las materias y define sede(s), jornada(s), días y bloques de
//         horario con los que se crean/reemplazan los grupos de esa materia.
export default function NuevoFormularioWizard({ periodos, facultadOverride, onClose, onCreated }) {
  const [paso, setPaso] = useState(1);

  const [catalogoPorPeriodo, setCatalogoPorPeriodo] = useState({});
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [errorCatalogo, setErrorCatalogo] = useState("");

  const [programaSeleccionado, setProgramaSeleccionado] = useState("");
  const [planSeleccionado, setPlanSeleccionado] = useState("");
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("");

  const [error, setError] = useState("");

  const listaPeriodos = periodos || [];

  useEffect(() => {
    if (listaPeriodos.length === 0) return;
    setCargandoCatalogo(true);
    setErrorCatalogo("");
    const qsFacultad = facultadOverride ? `&facultad=${encodeURIComponent(facultadOverride)}` : "";
    Promise.all(
      listaPeriodos.map((p) =>
        fetch(`/api/catalogo?periodo=${encodeURIComponent(p)}${qsFacultad}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.error) throw new Error(d.error);
            return { periodo: p, catalogo: d.catalogo || [] };
          })
      )
    )
      .then((resultados) => {
        const map = {};
        for (const r of resultados) map[r.periodo] = r.catalogo;
        setCatalogoPorPeriodo(map);
      })
      .catch((err) => setErrorCatalogo(err.message))
      .finally(() => setCargandoCatalogo(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaPeriodos.join("|")]);

  const catalogoCompleto = useMemo(() => {
    const todo = [];
    for (const [periodo, items] of Object.entries(catalogoPorPeriodo)) {
      for (const item of items) todo.push({ ...item, periodo });
    }
    return todo;
  }, [catalogoPorPeriodo]);

  const facultad = facultadOverride || catalogoCompleto[0]?.facultad || "";

  const programas = useMemo(() => {
    const set = new Set(catalogoCompleto.map((c) => c.programa).filter(Boolean));
    return [...set].sort();
  }, [catalogoCompleto]);

  const planesDelPrograma = useMemo(() => {
    if (!programaSeleccionado) return [];
    const map = new Map();
    for (const it of catalogoCompleto) {
      if (it.programa !== programaSeleccionado) continue;
      const key = it.plan || "Sin plan";
      if (!map.has(key)) map.set(key, { plan: key, asignaturas: 0 });
      map.get(key).asignaturas++;
    }
    return [...map.values()].sort((a, b) => a.plan.localeCompare(b.plan));
  }, [catalogoCompleto, programaSeleccionado]);

  const periodosDelPlan = useMemo(() => {
    if (!programaSeleccionado || !planSeleccionado) return [];
    const set = new Set(
      catalogoCompleto
        .filter(
          (c) => c.programa === programaSeleccionado && (c.plan || "Sin plan") === planSeleccionado
        )
        .map((c) => c.periodo)
    );
    return [...set].sort().reverse();
  }, [catalogoCompleto, programaSeleccionado, planSeleccionado]);

  const totalAsignaturasPlan = useMemo(() => {
    if (!programaSeleccionado || !planSeleccionado) return 0;
    return catalogoCompleto.filter(
      (c) => c.programa === programaSeleccionado && (c.plan || "Sin plan") === planSeleccionado
    ).length;
  }, [catalogoCompleto, programaSeleccionado, planSeleccionado]);

  function elegirPrograma(p) {
    setProgramaSeleccionado(p);
    setPlanSeleccionado("");
    setPeriodoSeleccionado("");
  }

  function elegirPlan(p) {
    setPlanSeleccionado(p);
    setPeriodoSeleccionado("");
  }

  function registrarSeleccion() {
    if (!programaSeleccionado || !planSeleccionado || !periodoSeleccionado) {
      setError("Selecciona programa, plan y periodo de formación.");
      return;
    }
    setError("");
    setPaso(2);
  }

  const seleccionCompleta = programaSeleccionado && planSeleccionado && periodoSeleccionado;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
      <div className="card w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Selección académica</h2>
            <p className="text-sm text-gray-500">
              {paso === 1
                ? "Elige el programa, el plan y el periodo de formación."
                : "Define la programación del ciclo: materias, sedes, jornadas y horario."}
            </p>
          </div>
          <button className="text-gray-400 hover:text-gray-600 text-xl leading-none" onClick={onClose}>
            ×
          </button>
        </div>

        {cargandoCatalogo && <p className="text-sm text-gray-500">Cargando catálogo...</p>}
        {errorCatalogo && <p className="text-sm text-red-600 mb-3">{errorCatalogo}</p>}

        {!cargandoCatalogo && !errorCatalogo && paso === 1 && (
          <div className="grid sm:grid-cols-[220px_1fr] gap-5">
            <div>
              <p className="text-xs font-semibold text-gray-400 tracking-wide mb-2">01 — FACULTAD</p>
              <div className="border border-brand-300 bg-brand-50 rounded-lg p-3">
                <p className="font-medium text-gray-900 text-sm">{facultad || "Tu facultad"}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {programas.length} programa{programas.length === 1 ? "" : "s"} ·{" "}
                  {new Set(catalogoCompleto.map((c) => c.plan || "Sin plan")).size} plan
                  {new Set(catalogoCompleto.map((c) => c.plan || "Sin plan")).size === 1 ? "" : "es"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 tracking-wide mb-2">
                02 — PROGRAMA, PLAN Y PERIODO
              </p>
              <h3 className="font-semibold text-gray-900 mb-3">{facultad || "—"}</h3>

              <div className="space-y-4">
                <div>
                  <label className="label">Programa *</label>
                  <select
                    className="input"
                    value={programaSeleccionado}
                    onChange={(e) => elegirPrograma(e.target.value)}
                  >
                    <option value="">Selecciona un programa...</option>
                    {programas.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {programaSeleccionado && (
                    <p className="text-xs text-gray-400 mt-1">
                      {programas.length} programas activos en {facultad}
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">Nombre del plan *</label>
                  <select
                    className="input"
                    value={planSeleccionado}
                    onChange={(e) => elegirPlan(e.target.value)}
                    disabled={!programaSeleccionado}
                  >
                    <option value="">Selecciona un plan...</option>
                    {planesDelPrograma.map((p) => (
                      <option key={p.plan} value={p.plan}>
                        {p.plan} · {p.asignaturas} asignatura{p.asignaturas === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                  {planSeleccionado && (
                    <p className="text-xs text-gray-400 mt-1">
                      {planesDelPrograma.length} plan{planesDelPrograma.length === 1 ? "" : "es"} vigente
                      {planesDelPrograma.length === 1 ? "" : "s"} para este programa
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">Periodo de formación *</label>
                  <div className="flex flex-wrap gap-2">
                    {periodosDelPlan.length === 0 && (
                      <p className="text-sm text-gray-400">Elige antes un programa y un plan.</p>
                    )}
                    {periodosDelPlan.map((p) => (
                      <label key={p} className="checkbox-pill">
                        <input
                          type="radio"
                          name="periodo-wizard"
                          className="accent-brand-600"
                          checked={periodoSeleccionado === p}
                          onChange={() => setPeriodoSeleccionado(p)}
                        />
                        {p}
                      </label>
                    ))}
                  </div>
                  {periodosDelPlan.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Periodos con catálogo cargado para este plan
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-400 tracking-wide mb-2">SELECCIÓN</p>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Facultad</dt>
                    <dd className="text-gray-900 font-medium text-right">{facultad || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Programa</dt>
                    <dd className={`text-right font-medium ${programaSeleccionado ? "text-gray-900" : "text-gray-400"}`}>
                      {programaSeleccionado || "Sin seleccionar"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Plan</dt>
                    <dd className={`text-right font-medium ${planSeleccionado ? "text-gray-900" : "text-gray-400"}`}>
                      {planSeleccionado || "Sin seleccionar"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Periodo de formación</dt>
                    <dd className={`text-right font-medium ${periodoSeleccionado ? "text-gray-900" : "text-gray-400"}`}>
                      {periodoSeleccionado || "Sin seleccionar"}
                    </dd>
                  </div>
                </dl>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 mt-4">
                <p className="text-xs text-gray-400">
                  {seleccionCompleta
                    ? `${totalAsignaturasPlan} asignatura${totalAsignaturasPlan === 1 ? "" : "s"} en el plan`
                    : ""}
                </p>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={onClose}>
                    Cancelar
                  </button>
                  <button className="btn-primary" onClick={registrarSeleccion}>
                    Registrar selección
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {paso === 2 && (
          <ProgramacionCicloForm
            facultad={facultad}
            programa={programaSeleccionado}
            plan={planSeleccionado}
            periodo={periodoSeleccionado}
            onVolver={() => setPaso(1)}
            onCreated={onCreated}
          />
        )}
      </div>
    </div>
  );
}
