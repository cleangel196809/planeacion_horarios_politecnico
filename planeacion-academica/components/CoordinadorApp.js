"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import CambiarPasswordModal from "@/components/CambiarPasswordModal";
import EstadoBadge from "@/components/EstadoBadge";
import { IconDownload, IconSearch, IconX } from "@/components/Icons";
import { SEDES, JORNADAS, DIAS } from "@/lib/constants";

function labelSede(v) {
  return SEDES.find((s) => s.value === v)?.label || v || "—";
}
function labelJornada(v) {
  return JORNADAS.find((j) => j.value === v)?.label || v || "—";
}
function labelDia(v) {
  return DIAS.find((d) => d.value === v)?.corto || v;
}

const FILTROS_VACIOS = { cedulaDocente: "", cedulaEstudiante: "", grupo: "", materia: "" };

// Vista de solo consulta para el rol "coordinador": ve los mismos datos que
// el decano de su facultad (catalogo, grupos creados, estado y horario),
// sin ningun boton para crear, editar ni eliminar nada. Ademas de recorrer
// el catalogo completo (como antes), puede buscar puntualmente por cedula
// de un docente, cedula de un estudiante, numero de grupo o nombre de
// materia -- las cuatro formas de busqueda que la coordinacion usa a diario
// -- contra /api/coordinador/consulta.
export default function CoordinadorApp({ user }) {
  const [mostrarCambiarPassword, setMostrarCambiarPassword] = useState(
    user.debeCambiarPassword
  );
  const storageKey = `planeacion_periodo_coordinador_${user.facultad || "propio"}`;
  const [periodos, setPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [resultado, setResultado] = useState({ tipo: "todos", filas: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/periodos")
      .then((r) => r.json())
      .then((d) => {
        const lista = d.periodos || [];
        setPeriodos(lista);
        if (lista.length === 0) return;
        let recordado = null;
        try {
          recordado = window.localStorage.getItem(storageKey);
        } catch (e) {
          /* localStorage no disponible: seguimos sin recordar, sin romper nada */
        }
        setPeriodo(recordado && lista.includes(recordado) ? recordado : lista[0]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscar(filtrosActuales) {
    if (!periodo) return;
    setCargando(true);
    setError("");
    try {
      const params = new URLSearchParams({ periodo });
      if (filtrosActuales.cedulaDocente.trim()) params.set("cedula_docente", filtrosActuales.cedulaDocente.trim());
      if (filtrosActuales.cedulaEstudiante.trim())
        params.set("cedula_estudiante", filtrosActuales.cedulaEstudiante.trim());
      if (filtrosActuales.grupo.trim()) params.set("grupo", filtrosActuales.grupo.trim());
      if (filtrosActuales.materia.trim()) params.set("materia", filtrosActuales.materia.trim());

      const res = await fetch(`/api/coordinador/consulta?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultado({ tipo: data.tipo, filas: data.filas || [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (periodo) {
      try {
        window.localStorage.setItem(storageKey, periodo);
      } catch (e) {
        /* localStorage no disponible: no pasa nada, solo no se recuerda */
      }
    }
    buscar(FILTROS_VACIOS);
    setFiltros(FILTROS_VACIOS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  function actualizarFiltro(campo, valor) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  function onSubmitFiltros(e) {
    e.preventDefault();
    buscar(filtros);
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
    buscar(FILTROS_VACIOS);
  }

  const hayFiltroActivo = Object.values(filtros).some((v) => v.trim());
  const esEstudiante = resultado.tipo === "estudiante";

  return (
    <div className="min-h-screen">
      {mostrarCambiarPassword && (
        <CambiarPasswordModal onDone={() => setMostrarCambiarPassword(false)} />
      )}

      <TopBar user={user} titulo="Consulta de planeación">
        {periodo && (
          <a
            href={`/api/planeacion/exportar?periodo=${encodeURIComponent(periodo)}`}
            className="btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconDownload /> Descargar Excel
          </a>
        )}
      </TopBar>

      <form className="filter-bar" onSubmit={onSubmitFiltros}>
        <div className="filter-bar-row">
          <div>
            <label className="label">Período</label>
            <select className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              {periodos.length === 0 && <option value="">Sin períodos cargados</option>}
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="label">Cédula docente</label>
            <input
              className="input"
              placeholder="Documento..."
              value={filtros.cedulaDocente}
              onChange={(e) => actualizarFiltro("cedulaDocente", e.target.value)}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="label">Cédula estudiante</label>
            <input
              className="input"
              placeholder="Documento..."
              value={filtros.cedulaEstudiante}
              onChange={(e) => actualizarFiltro("cedulaEstudiante", e.target.value)}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="label">Grupo</label>
            <input
              className="input"
              placeholder="Ej: SEON1-3TS"
              value={filtros.grupo}
              onChange={(e) => actualizarFiltro("grupo", e.target.value)}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="label">Materia</label>
            <input
              className="input"
              placeholder="Nombre de la asignatura..."
              value={filtros.materia}
              onChange={(e) => actualizarFiltro("materia", e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              <IconSearch /> Buscar
            </button>
            {hayFiltroActivo && (
              <button type="button" className="btn-secondary" onClick={limpiarFiltros}>
                <IconX /> Limpiar
              </button>
            )}
          </div>
        </div>
      </form>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Estás en modo de solo consulta: puedes ver el catálogo y los grupos de tu facultad, y
          descargar el Excel, pero no puedes crear, editar ni eliminar información.
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!cargando && periodos.length === 0 && (
          <div className="empty-state">
            Todavía no hay un catálogo cargado para ningún período en tu facultad.
          </div>
        )}

        {cargando && <p className="text-sm text-gray-500">Buscando...</p>}

        {!cargando && periodos.length > 0 && resultado.filas.length === 0 && (
          <div className="empty-state">
            {hayFiltroActivo
              ? "Ninguna coincidencia para esos criterios de búsqueda."
              : "Todavía no hay materias en el catálogo de este período."}
          </div>
        )}

        {!cargando && resultado.filas.length > 0 && (
          <div className="table-sap-wrap">
            <table className="table-sap">
              <thead>
                <tr>
                  {esEstudiante && <th>Estudiante</th>}
                  {esEstudiante && <th>Documento</th>}
                  <th>Asignatura</th>
                  <th>Programa · Plan</th>
                  <th>Grupo</th>
                  <th>Sede</th>
                  <th>Jornada</th>
                  <th>Días</th>
                  <th>Docente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {resultado.filas.map((f, i) => (
                  <tr key={f.id ?? `${f.estudiante_documento || ""}-${f.asignatura}-${i}`}>
                    {esEstudiante && <td className="font-medium text-gray-900">{f.estudiante_nombre}</td>}
                    {esEstudiante && <td className="text-gray-500">{f.estudiante_documento}</td>}
                    <td className="font-medium text-gray-900">{f.asignatura}</td>
                    <td className="text-gray-500">
                      {f.programa} {f.plan ? `· ${f.plan}` : ""}
                    </td>
                    <td>{f.grupo || "—"}</td>
                    <td>{labelSede(f.modalidad)}</td>
                    <td>{labelJornada(f.jornada)}</td>
                    <td>{(f.horarios || []).map((h) => labelDia(h.dia)).join(", ") || "—"}</td>
                    <td>{f.nombre_docente || "—"}</td>
                    <td>
                      {f.sinProgramar ? (
                        <span className="badge bg-amber-100 text-amber-700">Sin programar</span>
                      ) : (
                        <EstadoBadge estado={f.estado} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
