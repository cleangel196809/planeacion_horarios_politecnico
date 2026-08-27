"use client";

import { useEffect, useMemo, useState } from "react";
import { SEDES, JORNADAS, ESTADOS, DIAS } from "@/lib/constants";

const HORARIO_VACIO = { hora_inicio: "", hora_fin: "", salon: "" };

function horariosArrayToMap(horarios) {
  const map = {};
  for (const h of horarios || []) {
    map[h.dia] = { hora_inicio: h.hora_inicio || "", hora_fin: h.hora_fin || "", salon: h.salon || "" };
  }
  return map;
}

export default function GrupoForm({ initial, onCancel, onSubmit }) {
  const isEdit = Boolean(initial?.id);

  const [grupo, setGrupo] = useState(initial?.grupo || "");
  const [modalidad, setModalidad] = useState(initial?.modalidad || "");
  const [jornada, setJornada] = useState(initial?.jornada || "");
  const [franjaSabatina, setFranjaSabatina] = useState(0);
  const [diasSeleccionados, setDiasSeleccionados] = useState(() => {
    const s = new Set((initial?.horarios || []).map((h) => h.dia));
    return s;
  });
  const [horariosPorDia, setHorariosPorDia] = useState(() => horariosArrayToMap(initial?.horarios));
  const [capacidad, setCapacidad] = useState(initial?.capacidad ?? "");
  const [estado, setEstado] = useState(initial?.estado || "Sin reportar");
  const [documentoDocente, setDocumentoDocente] = useState(initial?.documento_docente || "");
  const [nombreDocente, setNombreDocente] = useState(initial?.nombre_docente || "");
  const [correoInstitucional, setCorreoInstitucional] = useState(initial?.correo_institucional || "");
  const [codigoMoodle, setCodigoMoodle] = useState(initial?.codigo_moodle || "");
  const [codigoTeams, setCodigoTeams] = useState(initial?.codigo_teams || "");
  const [enlaceTeams, setEnlaceTeams] = useState(initial?.enlace_teams || "");
  const [codigoMoodleDuplicar, setCodigoMoodleDuplicar] = useState(initial?.codigo_moodle_a_duplicar || "");
  const [observaciones, setObservaciones] = useState(initial?.observaciones || "");

  const [busquedaDocente, setBusquedaDocente] = useState("");
  const [sugerenciasDocente, setSugerenciasDocente] = useState([]);

  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const jornadaSeleccionada = useMemo(() => JORNADAS.find((j) => j.value === jornada), [jornada]);

  useEffect(() => {
    if (busquedaDocente.trim().length < 2) {
      setSugerenciasDocente([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/docentes?q=${encodeURIComponent(busquedaDocente)}`, {
          signal: controller.signal
        });
        const data = await res.json();
        setSugerenciasDocente(data.docentes || []);
      } catch (err) {
        // silencioso: la búsqueda de docente es una ayuda, no bloquea el formulario
      }
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [busquedaDocente]);

  function toggleDia(dia) {
    setDiasSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(dia)) {
        next.delete(dia);
      } else {
        next.add(dia);
        // Al marcar un día nuevo, sugiere la hora por defecto de la jornada elegida.
        setHorariosPorDia((prevHor) => {
          if (prevHor[dia]) return prevHor;
          let sugerida = { ...HORARIO_VACIO };
          if (jornadaSeleccionada) {
            if (jornadaSeleccionada.opciones) {
              sugerida = {
                hora_inicio: jornadaSeleccionada.opciones[franjaSabatina].horaInicio,
                hora_fin: jornadaSeleccionada.opciones[franjaSabatina].horaFin,
                salon: ""
              };
            } else {
              sugerida = {
                hora_inicio: jornadaSeleccionada.horaInicio,
                hora_fin: jornadaSeleccionada.horaFin,
                salon: ""
              };
            }
          }
          return { ...prevHor, [dia]: sugerida };
        });
      }
      return next;
    });
  }

  function actualizarHorario(dia, campo, valor) {
    setHorariosPorDia((prev) => ({
      ...prev,
      [dia]: { ...(prev[dia] || HORARIO_VACIO), [campo]: valor }
    }));
  }

  function elegirDocente(d) {
    setDocumentoDocente(d.documento);
    setNombreDocente(d.nombre_completo);
    setCorreoInstitucional(d.correo_institucional || "");
    setBusquedaDocente("");
    setSugerenciasDocente([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!modalidad) return setError("Selecciona la sede (modalidad).");
    if (!jornada) return setError("Selecciona la jornada.");
    if (diasSeleccionados.size === 0) return setError("Selecciona al menos un día de clase.");

    const horarios = [...diasSeleccionados].map((dia) => ({
      dia,
      ...(horariosPorDia[dia] || HORARIO_VACIO)
    }));

    setGuardando(true);
    try {
      await onSubmit({
        grupo,
        modalidad,
        jornada,
        capacidad: capacidad === "" ? null : Number(capacidad),
        estado,
        documento_docente: documentoDocente,
        nombre_docente: nombreDocente,
        correo_institucional: correoInstitucional,
        codigo_moodle: codigoMoodle,
        codigo_teams: codigoTeams,
        enlace_teams: enlaceTeams,
        codigo_moodle_a_duplicar: codigoMoodleDuplicar,
        observaciones,
        horarios
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Grupo</label>
          <input
            className="input"
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            placeholder="Ej: SEON1-3TS"
          />
        </div>
        <div>
          <label className="label">Capacidad</label>
          <input
            type="number"
            min="0"
            className="input"
            value={capacidad}
            onChange={(e) => setCapacidad(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Sede (modalidad)</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SEDES.map((s) => (
            <label key={s.value} className="checkbox-pill">
              <input
                type="radio"
                name="modalidad"
                className="accent-brand-600"
                checked={modalidad === s.value}
                onChange={() => setModalidad(s.value)}
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Jornada</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {JORNADAS.map((j) => (
            <label key={j.value} className="checkbox-pill">
              <input
                type="radio"
                name="jornada"
                className="accent-brand-600"
                checked={jornada === j.value}
                onChange={() => setJornada(j.value)}
              />
              {j.label}
            </label>
          ))}
        </div>
        {jornadaSeleccionada?.opciones && (
          <div className="mt-2 flex gap-2">
            {jornadaSeleccionada.opciones.map((op, i) => (
              <label key={op.label} className="checkbox-pill text-xs">
                <input
                  type="radio"
                  name="franja-sabatina"
                  checked={franjaSabatina === i}
                  onChange={() => setFranjaSabatina(i)}
                />
                {op.label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="label">Días y horario</label>
        <div className="space-y-2">
          {DIAS.map((d) => {
            const activo = diasSeleccionados.has(d.value);
            const h = horariosPorDia[d.value] || HORARIO_VACIO;
            return (
              <div key={d.value} className="flex flex-wrap items-center gap-2">
                <label className="checkbox-pill w-32 shrink-0">
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={activo}
                    onChange={() => toggleDia(d.value)}
                  />
                  {d.label}
                </label>
                {activo && (
                  <>
                    <input
                      type="time"
                      className="input w-32"
                      value={h.hora_inicio}
                      onChange={(e) => actualizarHorario(d.value, "hora_inicio", e.target.value)}
                    />
                    <span className="text-gray-400 text-sm">a</span>
                    <input
                      type="time"
                      className="input w-32"
                      value={h.hora_fin}
                      onChange={(e) => actualizarHorario(d.value, "hora_fin", e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Salón"
                      className="input w-32"
                      value={h.salon}
                      onChange={(e) => actualizarHorario(d.value, "salon", e.target.value)}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Nota: la plantilla oficial no tiene columna propia para Sábado; si seleccionas Sábado, se ubicará en el primer bloque de día disponible del Excel exportado.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="relative">
          <label className="label">Docente</label>
          <input
            className="input"
            placeholder="Buscar por nombre o documento..."
            value={busquedaDocente || nombreDocente}
            onChange={(e) => {
              setBusquedaDocente(e.target.value);
              setNombreDocente(e.target.value);
            }}
          />
          {sugerenciasDocente.length > 0 && (
            <ul className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-md w-full mt-1 max-h-48 overflow-auto">
              {sugerenciasDocente.map((d) => (
                <li
                  key={d.documento}
                  className="px-3 py-2 text-sm hover:bg-brand-50 cursor-pointer"
                  onClick={() => elegirDocente(d)}
                >
                  {d.nombre_completo} <span className="text-gray-400">· {d.documento}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className="label">Documento del docente</label>
          <input
            className="input"
            value={documentoDocente}
            onChange={(e) => setDocumentoDocente(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Correo institucional del docente</label>
          <input
            className="input"
            value={correoInstitucional}
            onChange={(e) => setCorreoInstitucional(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Estado</label>
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((e) => (
              <label key={e.value} className="checkbox-pill text-xs">
                <input
                  type="radio"
                  name="estado"
                  checked={estado === e.value}
                  onChange={() => setEstado(e.value)}
                />
                {e.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Código Moodle</label>
          <input className="input" value={codigoMoodle} onChange={(e) => setCodigoMoodle(e.target.value)} />
        </div>
        <div>
          <label className="label">Código Teams</label>
          <input className="input" value={codigoTeams} onChange={(e) => setCodigoTeams(e.target.value)} />
        </div>
        <div>
          <label className="label">Enlace Teams</label>
          <input className="input" value={enlaceTeams} onChange={(e) => setEnlaceTeams(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Código Moodle a duplicar</label>
        <input
          className="input"
          value={codigoMoodleDuplicar}
          onChange={(e) => setCodigoMoodleDuplicar(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Observaciones</label>
        <textarea
          className="input"
          rows={2}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={guardando}>
          {guardando ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear grupo"}
        </button>
      </div>
    </form>
  );
}
