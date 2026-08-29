"use client";

import { useEffect, useMemo, useState } from "react";
import { SEDES, JORNADAS, DIAS } from "@/lib/constants";
import { IconArrowLeft, IconEdit, IconX, IconSave } from "@/components/Icons";

// Color de referencia por jornada, solo para la interfaz (chips, resumen).
// No se guarda en la base de datos.
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

function labelSede(v) {
  return SEDES.find((s) => s.value === v)?.label || v || "—";
}
function labelJornada(v) {
  return JORNADAS.find((j) => j.value === v)?.label || v || "—";
}
function labelDia(v) {
  return DIAS.find((d) => d.value === v)?.corto || v;
}

// Días visibles para cada jornada: Sabatina solo Sábado; Noche es de lunes a
// viernes (6:00 p.m. a 9:00 p.m., sin fin de semana); el resto, toda la semana.
function diasVisiblesPara(jornadaValue) {
  if (jornadaValue === "SABADO") return DIAS.filter((d) => d.value === "SABADO");
  if (jornadaValue === "NOCHE") return DIAS.filter((d) => d.value !== "SABADO");
  return DIAS;
}

// Horario sugerido con el que se precarga un día al marcarlo, tomado de la
// jornada (o de su primera franja sugerida, en el caso de Sabatina).
function horarioSugerido(jornadaValue) {
  const j = JORNADAS.find((x) => x.value === jornadaValue);
  if (!j) return { hora_inicio: "", hora_fin: "", salon: "" };
  if (j.opciones && j.opciones.length > 0) {
    return { hora_inicio: j.opciones[0].horaInicio, hora_fin: j.opciones[0].horaFin, salon: "" };
  }
  return { hora_inicio: j.horaInicio || "", hora_fin: j.horaFin || "", salon: "" };
}

// Convierte "HH:MM" a minutos desde medianoche, para comparar franjas.
function horaAMinutos(hhmm) {
  if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
function seSuperponen(aIni, aFin, bIni, bFin) {
  const a1 = horaAMinutos(aIni);
  const a2 = horaAMinutos(aFin);
  const b1 = horaAMinutos(bIni);
  const b2 = horaAMinutos(bFin);
  if (a1 == null || a2 == null || b1 == null || b2 == null) return false;
  return a1 < b2 && b1 < a2;
}

// Reconstruye el estado de edición (sedes → jornadas → docente/días/horario/
// salón) de una materia a partir de los grupos ya guardados en planeacion,
// para que al abrir el acordeón se vea tal cual quedó la última vez.
function construirConfigDesdeGrupos(grupos) {
  const sedes = new Set();
  const porSede = {};
  for (const g of grupos || []) {
    if (!g.modalidad || !g.jornada) continue;
    sedes.add(g.modalidad);
    if (!porSede[g.modalidad]) porSede[g.modalidad] = { jornadas: new Set(), porJornada: {} };
    porSede[g.modalidad].jornadas.add(g.jornada);
    const dias = new Set();
    const horarioPorDia = {};
    for (const h of g.horarios || []) {
      dias.add(h.dia);
      horarioPorDia[h.dia] = {
        hora_inicio: h.hora_inicio || "",
        hora_fin: h.hora_fin || "",
        salon: h.salon || ""
      };
    }
    // Si ya existía una jornada con esta misma clave (fila duplicada), se
    // conserva la primera y la segunda se ignora aquí (se limpia al guardar).
    if (!porSede[g.modalidad].porJornada[g.jornada]) {
      porSede[g.modalidad].porJornada[g.jornada] = {
        dias,
        horarioPorDia,
        docenteDocumento: g.documento_docente || "",
        docenteNombre: g.nombre_docente || "",
        docenteCorreo: g.correo_institucional || ""
      };
    }
  }
  return { sedes, porSede };
}

function configVacia() {
  return { sedes: new Set(), porSede: {} };
}

function jornadaVacia() {
  return { dias: new Set(), horarioPorDia: {}, docenteDocumento: "", docenteNombre: "", docenteCorreo: "" };
}

// Paso 2 de la captura: "Programación del ciclo". El decano elige un ciclo de
// formación y, materia por materia, arma su programación en cascada: sede(s)
// → jornada(s) de esa sede (con su docente) → días de la semana con su franja
// horaria y salón. Cada materia se guarda por separado y solo toca sus
// propios grupos (sede+jornada). Antes de guardar se verifica que ningún
// docente ni salón quede con horarios cruzados frente al resto de grupos ya
// programados en el período (de cualquier materia de la facultad); si hay un
// cruce, se resalta en rojo para que el decano lo corrija.
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

  const [docentesFacultad, setDocentesFacultad] = useState([]);
  const [salonesPorSede, setSalonesPorSede] = useState({});

  const [cicloSeleccionado, setCicloSeleccionado] = useState("");
  const [busquedaMateria, setBusquedaMateria] = useState("");

  const [materiaExpandida, setMateriaExpandida] = useState(null);
  const [configPorMateria, setConfigPorMateria] = useState({});
  const [guardandoMateria, setGuardandoMateria] = useState(null);
  const [errorPorMateria, setErrorPorMateria] = useState({});
  const [mensajePorMateria, setMensajePorMateria] = useState({});

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

  // Lista de docentes de la facultad, para el selector de cada jornada.
  useEffect(() => {
    if (!facultad) return;
    fetch(`/api/docentes?facultad=${encodeURIComponent(facultad)}`)
      .then((r) => r.json())
      .then((d) => setDocentesFacultad(d.docentes || []))
      .catch(() => setDocentesFacultad([]));
  }, [facultad]);

  // Salones de una sede, cargados la primera vez que se activa esa sede en
  // cualquier materia (se guardan en caché para no repetir la consulta).
  function asegurarSalonesSede(sede) {
    if (!sede || salonesPorSede[sede] !== undefined) return;
    setSalonesPorSede((prev) => ({ ...prev, [sede]: null })); // marca "cargando"
    fetch(`/api/salones?sede=${encodeURIComponent(sede)}`)
      .then((r) => r.json())
      .then((d) => setSalonesPorSede((prev) => ({ ...prev, [sede]: d.salones || [] })))
      .catch(() => setSalonesPorSede((prev) => ({ ...prev, [sede]: [] })));
  }

  const catalogoPorId = useMemo(() => {
    const map = {};
    for (const c of catalogo) map[c.id] = c;
    return map;
  }, [catalogo]);

  // Todos los grupos ya guardados en el período (de cualquier materia,
  // programa o ciclo de la facultad), usados para detectar cruces de
  // docente/salón sin importar a qué materia pertenezcan.
  const todosLosGrupos = useMemo(
    () => Object.values(planeacionPorCatalogo).flat(),
    [planeacionPorCatalogo]
  );

  const materiasDelPrograma = useMemo(
    () => catalogo.filter((c) => c.programa === programa && (c.plan || "Sin plan") === plan),
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
    return materiasDelPrograma.filter((c) => String(c.ciclo || "Sin ciclo") === cicloSeleccionado);
  }, [materiasDelPrograma, cicloSeleccionado]);

  const materiasFiltradas = useMemo(() => {
    const q = busquedaMateria.trim().toLowerCase();
    if (!q) return materiasDelCiclo;
    return materiasDelCiclo.filter((m) => m.asignatura.toLowerCase().includes(q));
  }, [materiasDelCiclo, busquedaMateria]);

  function elegirCiclo(c) {
    setCicloSeleccionado(c);
    setBusquedaMateria("");
    setMateriaExpandida(null);
  }

  // Resumen (badges) de lo ya guardado para una materia: una entrada por cada
  // combinación sede+jornada con grupo creado.
  function resumenMateria(materiaId) {
    const grupos = planeacionPorCatalogo[materiaId] || [];
    const porClave = new Map();
    for (const g of grupos) {
      if (!g.modalidad || !g.jornada) continue;
      const clave = `${g.modalidad}|${g.jornada}`;
      if (!porClave.has(clave)) {
        porClave.set(clave, { sede: g.modalidad, jornada: g.jornada, dias: new Set() });
      }
      for (const h of g.horarios || []) porClave.get(clave).dias.add(h.dia);
    }
    return [...porClave.values()].map((r) => ({
      ...r,
      diasTexto: [...r.dias].map(labelDia).join(", ")
    }));
  }

  function abrirMateria(materiaId) {
    if (materiaExpandida === materiaId) {
      setMateriaExpandida(null);
      return;
    }
    setMateriaExpandida(materiaId);
    const grupos = planeacionPorCatalogo[materiaId] || [];
    setConfigPorMateria((prev) => ({
      ...prev,
      [materiaId]: construirConfigDesdeGrupos(grupos)
    }));
    // Precarga los salones de las sedes que ya tuvieran grupo, para que el
    // selector de salón no se quede vacío al abrir.
    for (const g of grupos) {
      if (g.modalidad) asegurarSalonesSede(g.modalidad);
    }
    setErrorPorMateria((prev) => ({ ...prev, [materiaId]: "" }));
    setMensajePorMateria((prev) => ({ ...prev, [materiaId]: "" }));
  }

  function actualizarConfig(materiaId, fn) {
    setConfigPorMateria((prev) => ({
      ...prev,
      [materiaId]: fn(prev[materiaId] || configVacia())
    }));
  }

  function toggleSede(materiaId, sede) {
    actualizarConfig(materiaId, (cfg) => {
      const sedes = new Set(cfg.sedes);
      const porSede = { ...cfg.porSede };
      if (sedes.has(sede)) {
        sedes.delete(sede);
        delete porSede[sede];
      } else {
        sedes.add(sede);
        porSede[sede] = porSede[sede] || { jornadas: new Set(), porJornada: {} };
        asegurarSalonesSede(sede);
      }
      return { sedes, porSede };
    });
  }

  function toggleJornada(materiaId, sede, jornada) {
    actualizarConfig(materiaId, (cfg) => {
      const sedeCfg = cfg.porSede[sede] || { jornadas: new Set(), porJornada: {} };
      const jornadas = new Set(sedeCfg.jornadas);
      const porJornada = { ...sedeCfg.porJornada };
      if (jornadas.has(jornada)) {
        jornadas.delete(jornada);
        delete porJornada[jornada];
      } else {
        jornadas.add(jornada);
        porJornada[jornada] = porJornada[jornada] || jornadaVacia();
      }
      return { ...cfg, porSede: { ...cfg.porSede, [sede]: { jornadas, porJornada } } };
    });
  }

  function toggleDia(materiaId, sede, jornada, dia) {
    actualizarConfig(materiaId, (cfg) => {
      const sedeCfg = cfg.porSede[sede];
      if (!sedeCfg) return cfg;
      const jc = sedeCfg.porJornada[jornada] || jornadaVacia();
      const dias = new Set(jc.dias);
      const horarioPorDia = { ...jc.horarioPorDia };
      if (dias.has(dia)) {
        dias.delete(dia);
      } else {
        dias.add(dia);
        if (!horarioPorDia[dia]) horarioPorDia[dia] = horarioSugerido(jornada);
      }
      return {
        ...cfg,
        porSede: {
          ...cfg.porSede,
          [sede]: { ...sedeCfg, porJornada: { ...sedeCfg.porJornada, [jornada]: { ...jc, dias, horarioPorDia } } }
        }
      };
    });
  }

  function actualizarHorarioDia(materiaId, sede, jornada, dia, campo, valor) {
    actualizarConfig(materiaId, (cfg) => {
      const sedeCfg = cfg.porSede[sede];
      if (!sedeCfg) return cfg;
      const jc = sedeCfg.porJornada[jornada];
      if (!jc) return cfg;
      const horarioPorDia = {
        ...jc.horarioPorDia,
        [dia]: { ...(jc.horarioPorDia[dia] || {}), [campo]: valor }
      };
      return {
        ...cfg,
        porSede: {
          ...cfg.porSede,
          [sede]: { ...sedeCfg, porJornada: { ...sedeCfg.porJornada, [jornada]: { ...jc, horarioPorDia } } }
        }
      };
    });
  }

  function actualizarDocenteJornada(materiaId, sede, jornada, documento) {
    actualizarConfig(materiaId, (cfg) => {
      const sedeCfg = cfg.porSede[sede];
      if (!sedeCfg) return cfg;
      const jc = sedeCfg.porJornada[jornada] || jornadaVacia();
      const doc = docentesFacultad.find((d) => d.documento === documento);
      const actualizada = {
        ...jc,
        docenteDocumento: doc ? doc.documento : "",
        docenteNombre: doc ? doc.nombre_completo : "",
        docenteCorreo: doc ? doc.correo_institucional || "" : ""
      };
      return {
        ...cfg,
        porSede: { ...cfg.porSede, [sede]: { ...sedeCfg, porJornada: { ...sedeCfg.porJornada, [jornada]: actualizada } } }
      };
    });
  }

  // Busca el id del grupo (planeacion) ya guardado para esta combinación
  // materia+sede+jornada, si existe, para excluirlo de la propia comparación
  // de cruces (un grupo no se cruza consigo mismo).
  function idPropio(materiaId, sede, jornada) {
    const existente = (planeacionPorCatalogo[materiaId] || []).find(
      (g) => g.modalidad === sede && g.jornada === jornada
    );
    return existente?.id ?? null;
  }

  // Cruces de docente y de salón para un día puntual de una jornada en
  // edición, comparando contra TODOS los grupos ya guardados en el período
  // (de cualquier materia), excluyendo el propio grupo que se está editando.
  function conflictosDia(materiaId, sede, jornada, dia) {
    const sinConflictos = { docente: [], salon: [] };
    const cfg = configPorMateria[materiaId];
    const jc = cfg?.porSede?.[sede]?.porJornada?.[jornada];
    if (!jc) return sinConflictos;
    const h = jc.horarioPorDia[dia];
    if (!h || !h.hora_inicio || !h.hora_fin) return sinConflictos;

    const propioId = idPropio(materiaId, sede, jornada);
    const docenteDocumento = jc.docenteDocumento || "";
    const salon = h.salon || "";
    if (!docenteDocumento && !salon) return sinConflictos;

    const docenteConflictos = [];
    const salonConflictos = [];

    for (const g of todosLosGrupos) {
      if (g.id === propioId) continue;
      for (const hh of g.horarios || []) {
        if (hh.dia !== dia) continue;
        if (!seSuperponen(h.hora_inicio, h.hora_fin, hh.hora_inicio, hh.hora_fin)) continue;
        const asignatura = catalogoPorId[g.catalogo_id]?.asignatura || "otra materia";
        const detalle = {
          asignatura,
          grupo: g.grupo || "",
          sede: g.modalidad,
          jornada: g.jornada,
          horaInicio: hh.hora_inicio,
          horaFin: hh.hora_fin
        };
        if (docenteDocumento && g.documento_docente === docenteDocumento) {
          docenteConflictos.push(detalle);
        }
        if (salon && hh.salon && hh.salon === salon) {
          salonConflictos.push(detalle);
        }
      }
    }
    return { docente: docenteConflictos, salon: salonConflictos };
  }

  // Recorre toda la configuración de una materia y junta los mensajes de
  // cruce de todos sus días marcados, para bloquear el guardado si hay
  // alguno sin resolver.
  function todosLosConflictos(materiaId) {
    const cfg = configPorMateria[materiaId] || configVacia();
    const mensajes = [];
    for (const sede of cfg.sedes) {
      const sedeCfg = cfg.porSede[sede];
      if (!sedeCfg) continue;
      for (const jornada of sedeCfg.jornadas) {
        const jc = sedeCfg.porJornada[jornada];
        if (!jc) continue;
        for (const dia of jc.dias) {
          const { docente, salon } = conflictosDia(materiaId, sede, jornada, dia);
          for (const c of docente) {
            mensajes.push(
              `Docente ocupado el ${labelDia(dia)} ${c.horaInicio}-${c.horaFin} con "${c.asignatura}" (${labelSede(c.sede)} · ${labelJornada(c.jornada)}).`
            );
          }
          for (const c of salon) {
            mensajes.push(
              `Salón ocupado el ${labelDia(dia)} ${c.horaInicio}-${c.horaFin} con "${c.asignatura}" (${labelSede(c.sede)} · ${labelJornada(c.jornada)}).`
            );
          }
        }
      }
    }
    return mensajes;
  }

  async function guardarMateria(materiaId) {
    const cfg = configPorMateria[materiaId] || configVacia();
    setErrorPorMateria((prev) => ({ ...prev, [materiaId]: "" }));
    setMensajePorMateria((prev) => ({ ...prev, [materiaId]: "" }));

    const conflictos = todosLosConflictos(materiaId);
    if (conflictos.length > 0) {
      setErrorPorMateria((prev) => ({
        ...prev,
        [materiaId]: `Hay horarios cruzados sin resolver: ${conflictos[0]}${
          conflictos.length > 1 ? ` (y ${conflictos.length - 1} más, resaltados abajo)` : ""
        }`
      }));
      return;
    }

    setGuardandoMateria(materiaId);
    try {
      // Combinaciones sede+jornada que el decano quiere que existan, con su
      // docente y sus días/horas/salón (se ignoran las jornadas activas sin
      // ningún día marcado).
      const deseados = [];
      for (const sede of cfg.sedes) {
        const sedeCfg = cfg.porSede[sede];
        if (!sedeCfg) continue;
        for (const jornada of sedeCfg.jornadas) {
          const jc = sedeCfg.porJornada[jornada];
          if (!jc || jc.dias.size === 0) continue;
          const horarios = [...jc.dias].map((dia) => ({
            dia,
            hora_inicio: jc.horarioPorDia[dia]?.hora_inicio || "",
            hora_fin: jc.horarioPorDia[dia]?.hora_fin || "",
            salon: jc.horarioPorDia[dia]?.salon || null
          }));
          deseados.push({
            sede,
            jornada,
            horarios,
            documento_docente: jc.docenteDocumento || null,
            nombre_docente: jc.docenteNombre || null,
            correo_institucional: jc.docenteCorreo || null
          });
        }
      }

      const clave = (s, j) => `${s}||${j}`;
      const deseadosPorClave = new Map(deseados.map((d) => [clave(d.sede, d.jornada), d]));

      const existentes = planeacionPorCatalogo[materiaId] || [];
      const existentesPorClave = new Map();
      const extras = [];
      for (const g of existentes) {
        if (!g.modalidad || !g.jornada) continue;
        const k = clave(g.modalidad, g.jornada);
        if (existentesPorClave.has(k)) extras.push(g);
        else existentesPorClave.set(k, g);
      }

      // Borra los grupos que ya no están marcados, y los duplicados sobrantes.
      for (const [k, g] of existentesPorClave) {
        if (!deseadosPorClave.has(k)) {
          await fetch(`/api/planeacion/${g.id}`, { method: "DELETE" });
        }
      }
      for (const g of extras) {
        await fetch(`/api/planeacion/${g.id}`, { method: "DELETE" });
      }

      // Crea los grupos nuevos y actualiza SOLO horario/docente/salón de los
      // que ya existían (conserva grupo, moodle, teams, estado, etc.).
      for (const [k, d] of deseadosPorClave) {
        const existente = existentesPorClave.get(k);
        const payload = {
          horarios: d.horarios,
          documento_docente: d.documento_docente,
          nombre_docente: d.nombre_docente,
          correo_institucional: d.correo_institucional
        };
        if (existente) {
          const res = await fetch(`/api/planeacion/${existente.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "No se pudo actualizar el horario.");
          }
        } else {
          const res = await fetch("/api/planeacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              catalogo_id: materiaId,
              periodo,
              modalidad: d.sede,
              jornada: d.jornada,
              ...payload
            })
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "No se pudo crear el grupo.");
          }
        }
      }

      await cargarDatos();
      await onCreated?.(periodo);
      setMensajePorMateria((prev) => ({ ...prev, [materiaId]: "Programación guardada." }));
    } catch (err) {
      setErrorPorMateria((prev) => ({ ...prev, [materiaId]: err.message }));
    } finally {
      setGuardandoMateria(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Programación del ciclo</h2>
          <p className="text-xs text-gray-400">Paso 2 de la captura</p>
        </div>
        <button className="inline-flex items-center gap-1.5 text-brand-600 text-sm font-medium" onClick={onVolver}>
          <IconArrowLeft className="w-3.5 h-3.5" /> Volver a selección académica
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
                {cicloInfo.creditos} créditos en el ciclo — solo estas se muestran abajo
              </p>
            )}
          </div>

          {cicloSeleccionado && (
            <div>
              <input
                className="input mb-3 max-w-md"
                placeholder="Buscar materia..."
                value={busquedaMateria}
                onChange={(e) => setBusquedaMateria(e.target.value)}
              />

              <div className="space-y-2">
                {materiasFiltradas.map((item) => {
                  const expandida = materiaExpandida === item.id;
                  const resumen = resumenMateria(item.id);
                  const cfg = configPorMateria[item.id] || configVacia();
                  const guardando = guardandoMateria === item.id;
                  const errorM = errorPorMateria[item.id];
                  const mensajeM = mensajePorMateria[item.id];

                  return (
                    <div key={item.id} className="card p-4">
                      <div
                        className="flex flex-wrap items-start justify-between gap-2 cursor-pointer"
                        onClick={() => abrirMateria(item.id)}
                      >
                        <div>
                          <p className="font-medium text-gray-900">{item.asignatura}</p>
                          <p className="text-xs text-gray-400 mb-1">{item.creditos ?? "—"} créditos</p>
                          {resumen.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {resumen.map((r) => (
                                <span
                                  key={`${r.sede}|${r.jornada}`}
                                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                  style={{ background: `${colorJornada(r.jornada)}1c`, color: colorJornada(r.jornada) }}
                                >
                                  {labelSede(r.sede)} · {labelJornada(r.jornada)}
                                  {r.diasTexto ? ` · ${r.diasTexto}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn-secondary text-xs shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirMateria(item.id);
                          }}
                        >
                          {expandida ? <IconX /> : <IconEdit />}
                          {expandida ? "Cerrar" : resumen.length > 0 ? "Editar horario" : "Programar horario"}
                        </button>
                      </div>

                      {expandida && (
                        <div className="mt-4 pt-3 border-t border-gray-200 space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-brand-600 tracking-wide mb-1">
                              SEDE(S)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {SEDES.map((s) => (
                                <button
                                  key={s.value}
                                  type="button"
                                  onClick={() => toggleSede(item.id, s.value)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                    cfg.sedes.has(s.value)
                                      ? "bg-brand-600 border-brand-600 text-white"
                                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {[...cfg.sedes].map((sede) => {
                            const sedeCfg = cfg.porSede[sede] || { jornadas: new Set(), porJornada: {} };
                            const salonesSede = salonesPorSede[sede];
                            return (
                              <div key={sede} className="ml-1 pl-3 border-l-2 border-brand-100 space-y-2">
                                <p className="text-xs font-semibold text-gray-500 tracking-wide">
                                  JORNADA(S) EN {labelSede(sede).toUpperCase()}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {JORNADAS.map((j) => (
                                    <button
                                      key={j.value}
                                      type="button"
                                      onClick={() => toggleJornada(item.id, sede, j.value)}
                                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                        sedeCfg.jornadas.has(j.value)
                                          ? "text-white"
                                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                      }`}
                                      style={
                                        sedeCfg.jornadas.has(j.value)
                                          ? { background: colorJornada(j.value), borderColor: colorJornada(j.value) }
                                          : undefined
                                      }
                                    >
                                      {j.label}
                                    </button>
                                  ))}
                                </div>

                                {[...sedeCfg.jornadas].map((jornada) => {
                                  const jc = sedeCfg.porJornada[jornada] || jornadaVacia();
                                  const dias = diasVisiblesPara(jornada);
                                  return (
                                    <div key={jornada} className="ml-1 pl-3 border-l-2 border-gray-100 space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-xs text-gray-400 shrink-0">
                                          {labelJornada(jornada)} · Docente
                                        </p>
                                        {docentesFacultad.length > 0 ? (
                                          <select
                                            className="input !w-64 shrink-0 !py-1 text-sm"
                                            value={jc.docenteDocumento}
                                            onChange={(e) =>
                                              actualizarDocenteJornada(item.id, sede, jornada, e.target.value)
                                            }
                                          >
                                            <option value="">— Sin asignar —</option>
                                            {docentesFacultad.map((d) => (
                                              <option key={d.documento} value={d.documento}>
                                                {d.nombre_completo}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            className="input !w-64 shrink-0 !py-1 text-sm"
                                            placeholder="Nombre del docente"
                                            value={jc.docenteNombre}
                                            onChange={(e) =>
                                              actualizarConfig(item.id, (cfgPrev) => {
                                                const sc = cfgPrev.porSede[sede];
                                                const jornadaCfg = sc.porJornada[jornada];
                                                return {
                                                  ...cfgPrev,
                                                  porSede: {
                                                    ...cfgPrev.porSede,
                                                    [sede]: {
                                                      ...sc,
                                                      porJornada: {
                                                        ...sc.porJornada,
                                                        [jornada]: { ...jornadaCfg, docenteNombre: e.target.value }
                                                      }
                                                    }
                                                  }
                                                };
                                              })
                                            }
                                          />
                                        )}
                                      </div>

                                      <p className="text-xs text-gray-400">Días — {labelJornada(jornada)}</p>
                                      <div className="space-y-1.5">
                                        {dias.map((d) => {
                                          const activo = jc.dias.has(d.value);
                                          const h = jc.horarioPorDia[d.value] || { hora_inicio: "", hora_fin: "", salon: "" };
                                          const conflictos = activo
                                            ? conflictosDia(item.id, sede, jornada, d.value)
                                            : { docente: [], salon: [] };
                                          const hayConflicto = conflictos.docente.length > 0 || conflictos.salon.length > 0;
                                          return (
                                            <div
                                              key={d.value}
                                              className={
                                                hayConflicto
                                                  ? "rounded-lg border border-red-300 bg-red-50 p-2"
                                                  : ""
                                              }
                                            >
                                              <div className="flex flex-wrap items-center gap-2">
                                                <label className="checkbox-pill !w-28 shrink-0">
                                                  <input
                                                    type="checkbox"
                                                    className="accent-brand-600"
                                                    checked={activo}
                                                    onChange={() => toggleDia(item.id, sede, jornada, d.value)}
                                                  />
                                                  {d.label}
                                                </label>
                                                {activo && (
                                                  <>
                                                    <input
                                                      type="time"
                                                      className="input !w-32 shrink-0"
                                                      value={h.hora_inicio}
                                                      onChange={(e) =>
                                                        actualizarHorarioDia(
                                                          item.id,
                                                          sede,
                                                          jornada,
                                                          d.value,
                                                          "hora_inicio",
                                                          e.target.value
                                                        )
                                                      }
                                                    />
                                                    <span className="text-gray-400 text-sm">a</span>
                                                    <input
                                                      type="time"
                                                      className="input !w-32 shrink-0"
                                                      value={h.hora_fin}
                                                      onChange={(e) =>
                                                        actualizarHorarioDia(
                                                          item.id,
                                                          sede,
                                                          jornada,
                                                          d.value,
                                                          "hora_fin",
                                                          e.target.value
                                                        )
                                                      }
                                                    />
                                                    {salonesSede === null ? (
                                                      <span className="text-xs text-gray-400">Cargando salones...</span>
                                                    ) : salonesSede && salonesSede.length > 0 ? (
                                                      <select
                                                        className="input !w-44 shrink-0 !py-1.5 text-sm"
                                                        value={h.salon}
                                                        onChange={(e) =>
                                                          actualizarHorarioDia(
                                                            item.id,
                                                            sede,
                                                            jornada,
                                                            d.value,
                                                            "salon",
                                                            e.target.value
                                                          )
                                                        }
                                                      >
                                                        <option value="">Salón...</option>
                                                        {salonesSede.map((s) => (
                                                          <option key={s.id} value={s.nombre}>
                                                            {s.nombre}
                                                            {s.capacidad ? ` (cap. ${s.capacidad})` : ""}
                                                          </option>
                                                        ))}
                                                      </select>
                                                    ) : (
                                                      <input
                                                        className="input !w-44 shrink-0"
                                                        placeholder="Salón"
                                                        value={h.salon}
                                                        onChange={(e) =>
                                                          actualizarHorarioDia(
                                                            item.id,
                                                            sede,
                                                            jornada,
                                                            d.value,
                                                            "salon",
                                                            e.target.value
                                                          )
                                                        }
                                                      />
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                              {hayConflicto && (
                                                <div className="mt-1 ml-1 space-y-0.5">
                                                  {conflictos.docente.map((c, i) => (
                                                    <p key={`doc-${i}`} className="text-xs text-red-700">
                                                      ⚠ Docente ocupado {c.horaInicio}-{c.horaFin} con &quot;{c.asignatura}&quot; (
                                                      {labelSede(c.sede)} · {labelJornada(c.jornada)})
                                                    </p>
                                                  ))}
                                                  {conflictos.salon.map((c, i) => (
                                                    <p key={`sal-${i}`} className="text-xs text-red-700">
                                                      ⚠ Salón ocupado {c.horaInicio}-{c.horaFin} con &quot;{c.asignatura}&quot; (
                                                      {labelSede(c.sede)} · {labelJornada(c.jornada)})
                                                    </p>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}

                          {cfg.sedes.size === 0 && (
                            <p className="text-xs text-gray-400">
                              Elige al menos una sede para empezar a programar esta materia.
                            </p>
                          )}

                          {errorM && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                              {errorM}
                            </p>
                          )}
                          {mensajeM && (
                            <p className="text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                              {mensajeM}
                            </p>
                          )}

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              className="btn-secondary text-xs"
                              onClick={() => setMateriaExpandida(null)}
                            >
                              <IconX /> Cancelar
                            </button>
                            <button
                              type="button"
                              className="btn-primary text-xs"
                              onClick={() => guardarMateria(item.id)}
                              disabled={guardando}
                            >
                              <IconSave /> {guardando ? "Guardando..." : "Guardar programación"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {materiasFiltradas.length === 0 && (
                  <p className="text-sm text-gray-400">Ninguna materia coincide con la búsqueda.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
