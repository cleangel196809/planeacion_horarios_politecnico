"use client";

import { useEffect, useMemo, useState } from "react";
import { SEDES, JORNADAS, DIAS, BLOQUES_HORARIO } from "@/lib/constants";

// Color de referencia por jornada, solo para la interfaz (chips, cuadrícula
// resumen semanal). No se guarda en la base de datos.
const COLOR_JORNADA = {
  DIURNA: "#2563eb",
  ESPECIAL: "#7c3aed",
  NOCHE: "#0f766e",
  SABADO: "#c2410c",
  VIRTUAL: "#be185d"
};
function colorJornada(v) {
  return COLOR_JORNADA[v] || "#6b7280";
}

function claveBloque(b) {
  return `${b.horaInicio}-${b.horaFin}`;
}
function claveCelda(dia, claveB) {
  return `${dia}|${claveB}`;
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

// ¿Este bloque cae dentro del rango horario típico de la jornada? Se usa
// solo para sugerir visualmente (recuadro punteado) dónde marcar, nunca para
// restringir: el decano puede marcar cualquier celda igual.
function bloqueSugerido(jornadaValue, bloque) {
  const j = JORNADAS.find((x) => x.value === jornadaValue);
  if (!j) return false;
  const rangos = j.opciones && j.opciones.length > 0 ? j.opciones : j.horaInicio ? [j] : [];
  return rangos.some((r) => bloque.horaInicio >= r.horaInicio && bloque.horaInicio < r.horaFin);
}

function estadoJornadaVacio() {
  return { sedes: new Set(), celdas: new Set() };
}

// Paso 2 de la captura: "Programación del ciclo". Dado el programa/plan/
// periodo ya elegidos en el paso 1, el decano escoge un ciclo de formación y
// arma la programación por jornada: cada jornada (Diurna, Especial, Noche,
// Sabatina, Virtual) tiene su propia cuadrícula semanal de días × bloques de
// horario de 1:30, en vez de compartir un único horario entre todas las
// jornadas marcadas. "Aplicar esta jornada" reemplaza la programación previa
// de esa jornada para las materias marcadas (las demás jornadas de esas
// materias no se tocan).
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
  const [busquedaMateria, setBusquedaMateria] = useState("");
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState(new Set());

  const [jornadaActiva, setJornadaActiva] = useState(JORNADAS[0].value);
  const [estadoPorJornada, setEstadoPorJornada] = useState(() => {
    const inicial = {};
    for (const j of JORNADAS) inicial[j.value] = estadoJornadaVacio();
    return inicial;
  });

  const [vista, setVista] = useState("resumen"); // "resumen" | "semana"

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

  const materiasFiltradas = useMemo(() => {
    const q = busquedaMateria.trim().toLowerCase();
    if (!q) return materiasDelCiclo;
    return materiasDelCiclo.filter((m) => m.asignatura.toLowerCase().includes(q));
  }, [materiasDelCiclo, busquedaMateria]);

  function elegirCiclo(c) {
    setCicloSeleccionado(c);
    setMateriasSeleccionadas(new Set());
    setBusquedaMateria("");
    const inicial = {};
    for (const j of JORNADAS) inicial[j.value] = estadoJornadaVacio();
    setEstadoPorJornada(inicial);
    setJornadaActiva(JORNADAS[0].value);
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
    setMateriasSeleccionadas(
      marcar ? new Set(materiasFiltradas.map((m) => m.id)) : new Set()
    );
  }

  const estadoActivo = estadoPorJornada[jornadaActiva] || estadoJornadaVacio();
  const jornadaInfo = JORNADAS.find((j) => j.value === jornadaActiva);
  const diasVisibles =
    jornadaActiva === "SABADO"
      ? DIAS.filter((d) => d.value === "SABADO")
      : jornadaActiva === "NOCHE"
      ? DIAS.filter((d) => d.value !== "SABADO") // Noche es de lunes a viernes, 6:00 p.m. a 9:00 p.m.
      : DIAS;

  function actualizarEstadoActivo(fn) {
    setEstadoPorJornada((prev) => {
      const actual = prev[jornadaActiva] || estadoJornadaVacio();
      const nuevoSet = fn(actual);
      return { ...prev, [jornadaActiva]: nuevoSet };
    });
  }

  function toggleSede(valor) {
    actualizarEstadoActivo((actual) => {
      const sedes = new Set(actual.sedes);
      sedes.has(valor) ? sedes.delete(valor) : sedes.add(valor);
      return { ...actual, sedes };
    });
  }

  function toggleCelda(dia, claveB) {
    actualizarEstadoActivo((actual) => {
      const celdas = new Set(actual.celdas);
      const key = claveCelda(dia, claveB);
      celdas.has(key) ? celdas.delete(key) : celdas.add(key);
      return { ...actual, celdas };
    });
  }

  function toggleFila(bloque) {
    const claveB = claveBloque(bloque);
    actualizarEstadoActivo((actual) => {
      const todasOn = diasVisibles.every((d) => actual.celdas.has(claveCelda(d.value, claveB)));
      const celdas = new Set(actual.celdas);
      diasVisibles.forEach((d) => {
        const key = claveCelda(d.value, claveB);
        todasOn ? celdas.delete(key) : celdas.add(key);
      });
      return { ...actual, celdas };
    });
  }

  function toggleColumna(dia) {
    actualizarEstadoActivo((actual) => {
      const todasOn = BLOQUES_HORARIO.every((b) =>
        actual.celdas.has(claveCelda(dia, claveBloque(b)))
      );
      const celdas = new Set(actual.celdas);
      BLOQUES_HORARIO.forEach((b) => {
        const key = claveCelda(dia, claveBloque(b));
        todasOn ? celdas.delete(key) : celdas.add(key);
      });
      return { ...actual, celdas };
    });
  }

  function limpiarJornadaActiva() {
    setEstadoPorJornada((prev) => ({ ...prev, [jornadaActiva]: estadoJornadaVacio() }));
  }

  const celdasActivasOrdenadas = useMemo(() => {
    const idxDia = {};
    DIAS.forEach((d, i) => (idxDia[d.value] = i));
    return [...estadoActivo.celdas]
      .map((k) => {
        const [dia, claveB] = k.split("|");
        const bloque = BLOQUES_HORARIO.find((b) => claveBloque(b) === claveB);
        return { dia, bloque };
      })
      .filter((c) => c.bloque)
      .sort(
        (a, b) => idxDia[a.dia] - idxDia[b.dia] || a.bloque.horaInicio.localeCompare(b.bloque.horaInicio)
      );
  }, [estadoActivo]);

  const listoParaAplicar =
    materiasSeleccionadas.size > 0 && estadoActivo.sedes.size > 0 && estadoActivo.celdas.size > 0;

  let notaAplicar = "";
  if (materiasSeleccionadas.size === 0) notaAplicar = "Marca al menos una materia de la lista.";
  else if (estadoActivo.sedes.size === 0) notaAplicar = "Elige al menos una sede para esta jornada.";
  else if (estadoActivo.celdas.size === 0) notaAplicar = "Marca al menos una celda en la cuadrícula.";
  else
    notaAplicar = `Se aplicará a ${materiasSeleccionadas.size} materia${materiasSeleccionadas.size === 1 ? "" : "s"}: ${estadoActivo.sedes.size} sede${estadoActivo.sedes.size === 1 ? "" : "s"} · ${estadoActivo.celdas.size} franja${estadoActivo.celdas.size === 1 ? "" : "s"} horaria${estadoActivo.celdas.size === 1 ? "" : "s"}.`;

  async function aplicarJornada() {
    if (!listoParaAplicar) {
      setError(notaAplicar);
      return;
    }
    setError("");
    setMensaje("");
    setGuardando(true);

    const horarios = celdasActivasOrdenadas.map((c) => ({
      dia: c.dia,
      hora_inicio: c.bloque.horaInicio,
      hora_fin: c.bloque.horaFin,
      salon: null
    }));
    const sedesElegidas = [...estadoActivo.sedes];
    const materiasElegidas = [...materiasSeleccionadas];

    const fallidos = [];
    try {
      for (const catalogoId of materiasElegidas) {
        // Reemplaza solo los grupos de ESTA jornada para esta materia; los
        // grupos de otras jornadas de la misma materia quedan intactos, para
        // poder combinar por ejemplo Diurna y Noche en la misma asignatura.
        const existentes = (planeacionPorCatalogo[catalogoId] || []).filter(
          (g) => g.jornada === jornadaActiva
        );
        for (const g of existentes) {
          await fetch(`/api/planeacion/${g.id}`, { method: "DELETE" });
        }

        for (const sede of sedesElegidas) {
          const res = await fetch("/api/planeacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              catalogo_id: catalogoId,
              periodo,
              modalidad: sede,
              jornada: jornadaActiva,
              horarios
            })
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            fallidos.push(data.error || `Error programando (id ${catalogoId})`);
          }
        }
      }

      await cargarDatos();
      await onCreated?.(periodo);

      setMensaje(
        `${labelJornada(jornadaActiva)} aplicada a ${materiasElegidas.length} materia${materiasElegidas.length === 1 ? "" : "s"}.`
      );
      setMateriasSeleccionadas(new Set());
      if (fallidos.length > 0) {
        setError(`Algunas asignaciones fallaron: ${fallidos.join(" / ")}`);
      }
    } finally {
      setGuardando(false);
    }
  }

  async function quitarAsignacion(catalogoId, jornadaValue) {
    const existentes = (planeacionPorCatalogo[catalogoId] || []).filter(
      (g) => g.jornada === jornadaValue
    );
    if (existentes.length === 0) return;
    if (!confirm(`¿Quitar la programación de ${labelJornada(jornadaValue)} para esta materia?`)) return;
    for (const g of existentes) {
      await fetch(`/api/planeacion/${g.id}`, { method: "DELETE" });
    }
    await cargarDatos();
    await onCreated?.(periodo);
  }

  // Una fila por cada combinación materia + jornada que tenga grupos creados
  // (antes se mezclaban todas las jornadas de una materia en una sola fila).
  const filasAsignadas = useMemo(() => {
    const filas = [];
    for (const item of materiasDelCiclo) {
      const grupos = planeacionPorCatalogo[item.id] || [];
      const porJornada = new Map();
      for (const g of grupos) {
        const key = g.jornada || "Sin jornada";
        if (!porJornada.has(key)) porJornada.set(key, []);
        porJornada.get(key).push(g);
      }
      for (const [jornadaValue, gruposJornada] of porJornada) {
        const sedes = [...new Set(gruposJornada.map((g) => g.modalidad).filter(Boolean))];
        const bloques = [
          ...new Set(
            gruposJornada.flatMap((g) =>
              (g.horarios || []).map((h) => `${labelDia(h.dia)} ${h.hora_inicio}–${h.hora_fin}`)
            )
          )
        ].sort();
        filas.push({ item, jornada: jornadaValue, sedes, bloques });
      }
    }
    return filas;
  }, [materiasDelCiclo, planeacionPorCatalogo]);

  // Todos los horarios ya asignados en el ciclo, para la vista semanal
  // consolidada (coloreada por jornada).
  const celdasSemana = useMemo(() => {
    const mapa = new Map(); // "DIA|horaInicio" -> [{materia, jornada}]
    for (const item of materiasDelCiclo) {
      const grupos = planeacionPorCatalogo[item.id] || [];
      for (const g of grupos) {
        for (const h of g.horarios || []) {
          const key = `${h.dia}|${h.hora_inicio}`;
          if (!mapa.has(key)) mapa.set(key, []);
          mapa.get(key).push({ materia: item.asignatura, jornada: g.jornada });
        }
      }
    }
    return mapa;
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
            <div className="grid sm:grid-cols-[240px_1fr] gap-5">
              {/* Columna materias */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-brand-600 tracking-wide">
                    MATERIAS DEL CICLO
                  </p>
                  <button
                    className="text-xs text-brand-600 font-medium"
                    onClick={() =>
                      marcarTodasMaterias(
                        !materiasFiltradas.every((m) => materiasSeleccionadas.has(m.id)) ||
                          materiasFiltradas.length === 0
                      )
                    }
                  >
                    Seleccionar todas
                  </button>
                </div>
                <input
                  className="input mb-2 text-sm"
                  placeholder="Buscar materia..."
                  value={busquedaMateria}
                  onChange={(e) => setBusquedaMateria(e.target.value)}
                />
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {materiasFiltradas.map((item) => {
                    const jornadasAsignadas = [
                      ...new Set((planeacionPorCatalogo[item.id] || []).map((g) => g.jornada).filter(Boolean))
                    ];
                    return (
                      <label
                        key={item.id}
                        className={`flex items-start gap-2 text-sm p-2 rounded-lg border cursor-pointer ${
                          materiasSeleccionadas.has(item.id)
                            ? "border-brand-300 bg-brand-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-brand-600 mt-0.5"
                          checked={materiasSeleccionadas.has(item.id)}
                          onChange={() =>
                            toggleEnSet(materiasSeleccionadas, setMateriasSeleccionadas, item.id)
                          }
                        />
                        <span className="flex-1">
                          <span className="block text-gray-900">{item.asignatura}</span>
                          <span className="block text-xs text-gray-400">
                            {item.creditos ?? "—"} créditos
                          </span>
                          {jornadasAsignadas.length > 0 && (
                            <span className="flex flex-wrap gap-1 mt-1">
                              {jornadasAsignadas.map((j) => (
                                <span
                                  key={j}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: `${colorJornada(j)}22`, color: colorJornada(j) }}
                                >
                                  {labelJornada(j)}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                  {materiasFiltradas.length === 0 && (
                    <p className="text-sm text-gray-400">Ninguna materia coincide con la búsqueda.</p>
                  )}
                </div>
              </div>

              {/* Columna builder por jornada */}
              <div>
                <p className="text-xs font-semibold text-brand-600 tracking-wide mb-2">
                  1 · ELIGE LA JORNADA A PROGRAMAR
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {JORNADAS.map((j) => {
                    const n = (estadoPorJornada[j.value] || estadoJornadaVacio()).celdas.size;
                    const rango =
                      j.opciones && j.opciones.length > 0
                        ? "Ver opciones"
                        : j.horaInicio
                        ? `${j.horaInicio} – ${j.horaFin}`
                        : "";
                    return (
                      <button
                        key={j.value}
                        onClick={() => setJornadaActiva(j.value)}
                        className={`relative rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                          jornadaActiva === j.value
                            ? "border-brand-600 bg-brand-50 text-brand-700"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {j.label}
                        <span className="block font-normal text-[10px] text-gray-400">{rango}</span>
                        {n > 0 && (
                          <span
                            className="absolute -top-2 -right-2 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1"
                            style={{ background: colorJornada(j.value) }}
                          >
                            {n}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs font-semibold text-brand-600 tracking-wide mb-2">
                  2 · SEDE(S) DE ESTA JORNADA
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {SEDES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => toggleSede(s.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        estadoActivo.sedes.has(s.value)
                          ? "bg-brand-600 border-brand-600 text-white"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold text-brand-600 tracking-wide">
                    3 · MARCA LOS DÍAS Y HORAS
                  </p>
                  <button className="text-xs text-gray-500 border border-gray-300 rounded-lg px-2 py-1" onClick={limpiarJornadaActiva}>
                    Limpiar esta jornada
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  Clic en una celda para marcarla; clic en un día o un bloque marca/quita toda la
                  fila o columna. El recuadro punteado sugiere el horario típico de{" "}
                  {jornadaInfo?.label.toLowerCase()}.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-200 bg-gray-50"></th>
                        {diasVisibles.map((d) => (
                          <th
                            key={d.value}
                            className="border border-gray-200 bg-gray-50 py-1.5 font-semibold text-gray-500 cursor-pointer hover:bg-brand-50 hover:text-brand-700"
                            onClick={() => toggleColumna(d.value)}
                          >
                            {d.corto}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BLOQUES_HORARIO.map((b) => {
                        const claveB = claveBloque(b);
                        const sugerido = bloqueSugerido(jornadaActiva, b);
                        return (
                          <tr key={claveB}>
                            <td
                              className="border border-gray-200 bg-gray-50 px-2 py-1 whitespace-nowrap text-gray-500 font-medium cursor-pointer hover:bg-brand-50 hover:text-brand-700"
                              onClick={() => toggleFila(b)}
                            >
                              {b.horaInicio}–{b.horaFin}
                              {b.corto ? " *" : ""}
                            </td>
                            {diasVisibles.map((d) => {
                              const on = estadoActivo.celdas.has(claveCelda(d.value, claveB));
                              return (
                                <td
                                  key={d.value}
                                  onClick={() => toggleCelda(d.value, claveB)}
                                  className="border border-gray-200 h-8 cursor-pointer relative"
                                  style={{
                                    background: on ? colorJornada(jornadaActiva) : sugerido ? "#fafdff" : undefined
                                  }}
                                >
                                  {!on && sugerido && (
                                    <span className="absolute inset-1 border border-dashed border-brand-200 rounded-sm" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3 mb-1">
                  {celdasActivasOrdenadas.length === 0 ? (
                    <span className="text-xs text-gray-400">
                      Todavía no has marcado ningún día/hora para esta jornada.
                    </span>
                  ) : (
                    celdasActivasOrdenadas.map((c) => (
                      <span
                        key={claveCelda(c.dia, claveBloque(c.bloque))}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium pl-2.5 pr-1 py-1"
                      >
                        {labelDia(c.dia)} {c.bloque.horaInicio}–{c.bloque.horaFin}
                        <button
                          className="text-brand-300 hover:text-brand-700 leading-none px-1"
                          onClick={() => toggleCelda(c.dia, claveBloque(c.bloque))}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400">{notaAplicar}</p>
                  <button className="btn-primary" onClick={aplicarJornada} disabled={guardando || !listoParaAplicar}>
                    {guardando ? "Aplicando..." : `Aplicar ${jornadaInfo?.label || ""} a las materias marcadas →`}
                  </button>
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
                  <div className="flex gap-2 mb-3">
                    <button
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                        vista === "resumen"
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-500"
                      }`}
                      onClick={() => setVista("resumen")}
                    >
                      Programación asignada · {filasAsignadas.length} registro
                      {filasAsignadas.length === 1 ? "" : "s"}
                    </button>
                    <button
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                        vista === "semana"
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-500"
                      }`}
                      onClick={() => setVista("semana")}
                    >
                      Vista semanal (todas las jornadas)
                    </button>
                  </div>

                  {vista === "resumen" ? (
                    filasAsignadas.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        Todavía no hay materias programadas en este ciclo.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 border-b">
                              <th className="py-1 pr-3">Materia</th>
                              <th className="py-1 pr-3">Jornada</th>
                              <th className="py-1 pr-3">Sedes</th>
                              <th className="py-1 pr-3">Horario</th>
                              <th className="py-1 pr-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filasAsignadas.map(({ item, jornada, sedes, bloques }) => (
                              <tr key={`${item.id}-${jornada}`} className="border-b last:border-0">
                                <td className="py-1.5 pr-3">{item.asignatura}</td>
                                <td className="py-1.5 pr-3">
                                  <span
                                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: `${colorJornada(jornada)}1c`, color: colorJornada(jornada) }}
                                  >
                                    {labelJornada(jornada)}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-3">{sedes.map(labelSede).join(", ")}</td>
                                <td className="py-1.5 pr-3">{bloques.join(" · ")}</td>
                                <td className="py-1.5 pr-3 text-right">
                                  <button
                                    className="text-red-600 text-xs font-medium"
                                    onClick={() => quitarAsignacion(item.id, jornada)}
                                  >
                                    Quitar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    <div>
                      <div className="flex flex-wrap gap-3 mb-3">
                        {JORNADAS.map((j) => (
                          <span key={j.value} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-sm"
                              style={{ background: colorJornada(j.value) }}
                            />
                            {j.label}
                          </span>
                        ))}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr>
                              <th className="border border-gray-200 bg-gray-50"></th>
                              {DIAS.map((d) => (
                                <th key={d.value} className="border border-gray-200 bg-gray-50 py-1.5 font-semibold text-gray-500">
                                  {d.corto}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {BLOQUES_HORARIO.map((b) => (
                              <tr key={claveBloque(b)}>
                                <td className="border border-gray-200 bg-gray-50 px-2 py-1 whitespace-nowrap text-gray-500 font-medium">
                                  {b.horaInicio}–{b.horaFin}
                                </td>
                                {DIAS.map((d) => {
                                  const entradas = celdasSemana.get(`${d.value}|${b.horaInicio}`) || [];
                                  return (
                                    <td key={d.value} className="border border-gray-200 align-top p-0.5">
                                      {entradas.map((e, i) => (
                                        <div
                                          key={i}
                                          title={`${e.materia} · ${labelJornada(e.jornada)}`}
                                          className="text-[9px] font-bold text-white rounded px-1 py-0.5 mb-0.5 truncate"
                                          style={{ background: colorJornada(e.jornada) }}
                                        >
                                          {e.materia}
                                        </div>
                                      ))}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
