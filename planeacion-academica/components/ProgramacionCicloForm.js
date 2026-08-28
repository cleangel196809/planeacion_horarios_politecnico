"use client";

import { useEffect, useMemo, useState } from "react";
import { SEDES, JORNADAS, DIAS, BLOQUES_HORARIO } from "@/lib/constants";

function claveBloque(b) {
  return `${b.horaInicio}-${b.horaFin}`;
}

function labelSede(v) {
  return SEDES.find((s) => s.value === v)?.label || v || "—";
}
function labelJornada(v) {
  return JORNADAS.find((j) => j.value === v)?.label || v || "—";
}
function labelDia(v) {
  return DIAS.find((d) => d.value === v)?.corto || v;
}

// Paso 2 de la captura: "Programación del ciclo". Dado el programa/plan/
// periodo ya elegidos en el paso 1, el decano escoge un ciclo de formación y
// arma, para una o varias materias a la vez, su programación completa:
// sedes, jornadas, días y bloques de horario de 1:30. "Asignar programación"
// reemplaza cualquier programación previa de esas materias por la nueva
// selección (crea un grupo por cada combinación sede × jornada elegida, con
// el mismo horario para todas).
export default function ProgramacionCicloForm({
  facultad,
  programa,
  plan,
  periodo,
  onVolver,
  onCreated
}) {
  const [catalogo, setCatalogo] = useState([]);
  const [planeacionPorCatalogo, setPlaneacionPorCatalogo] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [cicloSeleccionado, setCicloSeleccionado] = useState("");
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState(new Set());
  const [sedesSeleccionadas, setSedesSeleccionadas] = useState(new Set());
  const [jornadasSeleccionadas, setJornadasSeleccionadas] = useState(new Set());
  const [diasSeleccionados, setDiasSeleccionados] = useState(new Set());
  const [bloquesSeleccionados, setBloquesSeleccionados] = useState(new Set());

  async function cargarDatos() {
    setCargando(true);
    setError("");
    try {
      const qsFacultad = facultad ? `&facultad=${encodeURIComponent(facultad)}` : "";
      const [catRes, planRes] = await Promise.all([
        fetch(`/api/catalogo?periodo=${encodeURIComponent(periodo)}${qsFacultad}`),
        fetch(`/api/planeacion?periodo=${encodeURIComponent(periodo)}${qsFacultad}`)
      ]);
      const catData = await catRes.json();
      const planData = await planRes.json();
      if (!catRes.ok) throw new Error(catData.error);
      if (!planRes.ok) throw new Error(planData.error);

      setCatalogo(catData.catalogo || []);
      const agrupado = {};
      for (const p of planData.planeacion || []) {
        agrupado[p.catalogo_id] = agrupado[p.catalogo_id] || [];
        agrupado[p.catalogo_id].push(p);
      }
      setPlaneacionPorCatalogo(agrupado);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const materiasDelPrograma = useMemo(
    () =>
      catalogo.filter(
        (c) => c.programa === programa && (c.plan || "Sin plan") === plan
      ),
    [catalogo, programa, plan]
  );

  const ciclos = useMemo(() => {
    const map = new Map();
    for (const item of materiasDelPrograma) {
      const key = String(item.ciclo || "Sin ciclo");
      if (!map.has(key)) map.set(key, { ciclo: key, materias: 0, creditos: 0 });
      const acc = map.get(key);
      acc.materias++;
      acc.creditos += Number(item.creditos) || 0;
    }
    return [...map.values()].sort((a, b) => {
      const na = Number(a.ciclo);
      const nb = Number(b.ciclo);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.ciclo.localeCompare(b.ciclo);
    });
  }, [materiasDelPrograma]);

  const cicloInfo = ciclos.find((c) => c.ciclo === cicloSeleccionado);

  const materiasDelCiclo = useMemo(() => {
    if (!cicloSeleccionado) return [];
    return materiasDelPrograma.filter(
      (c) => String(c.ciclo || "Sin ciclo") === cicloSeleccionado
    );
  }, [materiasDelPrograma, cicloSeleccionado]);

  function elegirCiclo(c) {
    setCicloSeleccionado(c);
    setMateriasSeleccionadas(new Set());
    setMensaje("");
    setError("");
  }

  function toggleEnSet(set, setter, valor) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(valor)) next.delete(valor);
      else next.add(valor);
      return next;
    });
  }

  function marcarTodasMaterias(marcar) {
    setMateriasSeleccionadas(marcar ? new Set(materiasDelCiclo.map((m) => m.id)) : new Set());
  }

  async function asignarProgramacion() {
    if (materiasSeleccionadas.size === 0) {
      setError("Marca al menos una materia del ciclo.");
      return;
    }
    if (sedesSeleccionadas.size === 0 || jornadasSeleccionadas.size === 0) {
      setError("Selecciona al menos una sede y una jornada.");
      return;
    }
    if (diasSeleccionados.size === 0 || bloquesSeleccionados.size === 0) {
      setError("Selecciona al menos un día y un bloque de horario.");
      return;
    }
    setError("");
    setMensaje("");
    setGuardando(true);

    const horarios = [];
    for (const dia of diasSeleccionados) {
      for (const clave of bloquesSeleccionados) {
        const bloque = BLOQUES_HORARIO.find((b) => claveBloque(b) === clave);
        if (!bloque) continue;
        horarios.push({ dia, hora_inicio: bloque.horaInicio, hora_fin: bloque.horaFin, salon: null });
      }
    }

    const fallidos = [];
    try {
      for (const catalogoId of materiasSeleccionadas) {
        // "Reemplazar lo anterior": se borra cualquier grupo previo de esta
        // materia antes de crear los nuevos, en vez de acumularlos.
        const existentes = planeacionPorCatalogo[catalogoId] || [];
        for (const g of existentes) {
          await fetch(`/api/planeacion/${g.id}`, { method: "DELETE" });
        }

        for (const sede of sedesSeleccionadas) {
          for (const jornada of jornadasSeleccionadas) {
            const res = await fetch("/api/planeacion", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                catalogo_id: catalogoId,
                periodo,
                modalidad: sede,
                jornada,
                horarios
              })
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              fallidos.push(data.error || `Error programando (id ${catalogoId})`);
            }
          }
        }
      }

      await cargarDatos();
      await onCreated?.(periodo);

      const nMaterias = materiasSeleccionadas.size;
      const nBloques = bloquesSeleccionados.size;
      setMensaje(
        `${nMaterias} materia${nMaterias === 1 ? "" : "s"} programada${nMaterias === 1 ? "" : "s"} en ${nBloques} bloque${nBloques === 1 ? "" : "s"}.`
      );
      setMateriasSeleccionadas(new Set());
      if (fallidos.length > 0) {
        setError(`Algunas asignaciones fallaron: ${fallidos.join(" / ")}`);
      }
    } finally {
      setGuardando(false);
    }
  }

  function limpiarSeleccion() {
    setMateriasSeleccionadas(new Set());
    setSedesSeleccionadas(new Set());
    setJornadasSeleccionadas(new Set());
    setDiasSeleccionados(new Set());
    setBloquesSeleccionados(new Set());
    setError("");
    setMensaje("");
  }

  async function quitarMateria(catalogoId) {
    const existentes = planeacionPorCatalogo[catalogoId] || [];
    if (existentes.length === 0) return;
    if (!confirm("¿Quitar toda la programación asignada a esta materia?")) return;
    for (const g of existentes) {
      await fetch(`/api/planeacion/${g.id}`, { method: "DELETE" });
    }
    await cargarDatos();
    await onCreated?.(periodo);
  }

  const filasAsignadas = useMemo(() => {
    return materiasDelCiclo
      .map((item) => {
        const grupos = planeacionPorCatalogo[item.id] || [];
        if (grupos.length === 0) return null;
        const sedes = [...new Set(grupos.map((g) => g.modalidad).filter(Boolean))];
        const jornadas = [...new Set(grupos.map((g) => g.jornada).filter(Boolean))];
        const bloques = [
          ...new Set(
            grupos.flatMap((g) => (g.horarios || []).map((h) => `${h.hora_inicio}–${h.hora_fin}`))
          )
        ].sort();
        return { item, sedes, jornadas, bloques };
      })
      .filter(Boolean);
  }, [materiasDelCiclo, planeacionPorCatalogo]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Programación del ciclo</h2>
          <p className="text-xs text-gray-400">Paso 2 de la captura</p>
        </div>
        <button className="text-brand-600 text-sm font-medium" onClick={onVolver}>
          ← Volver a selección académica
        </button>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-brand-600 font-medium border-b border-gray-200 pb-2 mb-4">
        <span>{facultad}</span>
        <span className="text-gray-300">·</span>
        <span>{programa}</span>
        <span className="text-gray-300">·</span>
        <span>Plan {plan}</span>
        <span className="text-gray-300">·</span>
        <span>Periodo {periodo}</span>
      </div>

      {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
      {error && !cargando && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      {!cargando && (
        <>
          <div className="mb-4">
            <label className="label">Ciclo de formación *</label>
            <select
              className="input max-w-sm"
              value={cicloSeleccionado}
              onChange={(e) => elegirCiclo(e.target.value)}
            >
              <option value="">Selecciona un ciclo...</option>
              {ciclos.map((c) => (
                <option key={c.ciclo} value={c.ciclo}>
                  {c.ciclo === "Sin ciclo" ? "Sin ciclo" : `Ciclo ${c.ciclo}`}
                </option>
              ))}
            </select>
            {cicloInfo && (
              <p className="text-xs text-gray-400 mt-1">
                {cicloInfo.materias} materia{cicloInfo.materias === 1 ? "" : "s"} ·{" "}
                {cicloInfo.creditos} créditos en el ciclo
              </p>
            )}
          </div>

          {cicloSeleccionado && (
            <>
              <div className="grid sm:grid-cols-4 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-brand-600 tracking-wide">
                      MATERIAS DEL CICLO
                    </p>
                    <button
                      className="text-xs text-brand-600 font-medium"
                      onClick={() =>
                        marcarTodasMaterias(materiasSeleccionadas.size !== materiasDelCiclo.length)
                      }
                    >
                      Seleccionar todas
                    </button>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {materiasDelCiclo.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-start gap-2 text-sm p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="accent-brand-600 mt-0.5"
                          checked={materiasSeleccionadas.has(item.id)}
                          onChange={() =>
                            toggleEnSet(materiasSeleccionadas, setMateriasSeleccionadas, item.id)
                          }
                        />
                        <span>
                          <span className="block text-gray-900">{item.asignatura}</span>
                          <span className="block text-xs text-gray-400">
                            {item.creditos ?? "—"} créditos
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-brand-600 tracking-wide mb-2">SEDES</p>
                  <div className="space-y-2">
                    {SEDES.map((s) => (
                      <label
                        key={s.value}
                        className="flex items-center gap-2 text-sm p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="accent-brand-600"
                          checked={sedesSeleccionadas.has(s.value)}
                          onChange={() =>
                            toggleEnSet(sedesSeleccionadas, setSedesSeleccionadas, s.value)
                          }
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-brand-600 tracking-wide mb-2">JORNADAS</p>
                  <div className="space-y-2">
                    {JORNADAS.map((j) => (
                      <label
                        key={j.value}
                        className="flex items-start gap-2 text-sm p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="accent-brand-600 mt-0.5"
                          checked={jornadasSeleccionadas.has(j.value)}
                          onChange={() =>
                            toggleEnSet(jornadasSeleccionadas, setJornadasSeleccionadas, j.value)
                          }
                        />
                        <span>
                          <span className="block">{j.label}</span>
                          {j.horaInicio && (
                            <span className="block text-xs text-gray-400">
                              {j.horaInicio} – {j.horaFin}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>

                  <p className="text-xs font-semibold text-brand-600 tracking-wide mb-2 mt-4">DÍAS</p>
                  <div className="flex flex-wrap gap-2">
                    {DIAS.map((d) => (
                      <label key={d.value} className="checkbox-pill text-xs">
                        <input
                          type="checkbox"
                          className="accent-brand-600"
                          checked={diasSeleccionados.has(d.value)}
                          onChange={() =>
                            toggleEnSet(diasSeleccionados, setDiasSeleccionados, d.value)
                          }
                        />
                        {d.corto}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-brand-600 tracking-wide mb-2">
                    HORARIO · BLOQUES DE 1:30
                  </p>
                  <div className="space-y-1.5">
                    {BLOQUES_HORARIO.map((b) => {
                      const clave = claveBloque(b);
                      return (
                        <label
                          key={clave}
                          className="flex items-center justify-between gap-2 text-sm p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="accent-brand-600"
                              checked={bloquesSeleccionados.has(clave)}
                              onChange={() =>
                                toggleEnSet(bloquesSeleccionados, setBloquesSeleccionados, clave)
                              }
                            />
                            {b.horaInicio} – {b.horaFin}
                          </span>
                          {b.corto && <span className="text-xs text-gray-400">bloque corto</span>}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Los bloques fuera de las jornadas seleccionadas quedan solo como referencia
                    horaria: revisa que calcen con la jornada elegida.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={asignarProgramacion} disabled={guardando}>
                    {guardando ? "Asignando..." : "Asignar programación"}
                  </button>
                  <button className="btn-secondary" onClick={limpiarSeleccion} disabled={guardando}>
                    Limpiar selección
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {materiasSeleccionadas.size} materia{materiasSeleccionadas.size === 1 ? "" : "s"} ·{" "}
                  {sedesSeleccionadas.size} sede{sedesSeleccionadas.size === 1 ? "" : "s"} ·{" "}
                  {jornadasSeleccionadas.size} jornada{jornadasSeleccionadas.size === 1 ? "" : "s"} ·{" "}
                  {bloquesSeleccionados.size} bloque{bloquesSeleccionados.size === 1 ? "" : "s"}
                </p>
              </div>

              {mensaje && (
                <p className="text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 mt-3">
                  {mensaje}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
                  {error}
                </p>
              )}

              <div className="mt-6">
                <p className="text-xs font-semibold text-brand-600 tracking-wide mb-2">
                  PROGRAMACIÓN ASIGNADA · {filasAsignadas.length} registro
                  {filasAsignadas.length === 1 ? "" : "s"}
                </p>
                {filasAsignadas.length === 0 ? (
                  <p className="text-sm text-gray-400">Todavía no hay materias programadas en este ciclo.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-1 pr-3">Ciclo</th>
                          <th className="py-1 pr-3">Materia</th>
                          <th className="py-1 pr-3">Sedes</th>
                          <th className="py-1 pr-3">Jornadas</th>
                          <th className="py-1 pr-3">Bloques</th>
                          <th className="py-1 pr-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filasAsignadas.map(({ item, sedes, jornadas, bloques }) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3">
                              {cicloSeleccionado === "Sin ciclo" ? "—" : cicloSeleccionado}
                            </td>
                            <td className="py-1.5 pr-3">{item.asignatura}</td>
                            <td className="py-1.5 pr-3">{sedes.map(labelSede).join(", ")}</td>
                            <td className="py-1.5 pr-3">{jornadas.map(labelJornada).join(", ")}</td>
                            <td className="py-1.5 pr-3">{bloques.join(" · ")}</td>
                            <td className="py-1.5 pr-3 text-right">
                              <button
                                className="text-red-600 text-xs font-medium"
                                onClick={() => quitarMateria(item.id)}
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
