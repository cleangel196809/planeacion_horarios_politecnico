"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import CambiarPasswordModal from "@/components/CambiarPasswordModal";
import GrupoForm from "@/components/GrupoForm";
import EstadoBadge from "@/components/EstadoBadge";
import ConfirmarCatalogoReal from "@/components/ConfirmarCatalogoReal";
import { SEDES, JORNADAS, DIAS } from "@/lib/constants";
import {
  IconPlus,
  IconDownload,
  IconEdit,
  IconTrash,
  IconX,
  IconChevronRight
} from "@/components/Icons";

function labelSede(v) {
  return SEDES.find((s) => s.value === v)?.label || v || "—";
}
function labelJornada(v) {
  return JORNADAS.find((j) => j.value === v)?.label || v || "—";
}
function labelDia(v) {
  return DIAS.find((d) => d.value === v)?.corto || v;
}

// Panel del decano: TODO pasa en una sola pantalla (filtro -> tabla de
// materias del ciclo -> panel lateral con el detalle y el formulario de
// grupo/horario), sin un asistente modal aparte. Antes existia un boton
// "Nuevo formulario" que abria components/NuevoFormularioWizard.js con su
// propio selector de programa/plan/periodo y un formulario en cascada de
// ~1000 lineas (components/ProgramacionCicloForm.js) que repetia casi todo
// lo que ya hacia esta vista; se retiraron ambos archivos y su unica logica
// util (la deteccion de cruces de horario) se movio a lib/conflictos.js,
// que ahora usa GrupoForm en cualquiera de los dos flujos (crear o editar).
//
// facultadOverride: solo la usa el administrador/secretaria cuando entran a
// "actuar como decano" de una facultad puntual (ver AdminApp/SecretariaApp).
// Un decano normal nunca la recibe: su facultad ya viene fija en su sesion.
export default function DecanoApp({ user, facultadOverride, titulo }) {
  const [mostrarCambiarPassword, setMostrarCambiarPassword] = useState(
    user.debeCambiarPassword
  );
  const storageKey = `planeacion_periodo_decano_${facultadOverride || user.facultad || "propio"}`;
  const [periodos, setPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState("");
  const [catalogo, setCatalogo] = useState([]);
  const [planeacionPorCatalogo, setPlaneacionPorCatalogo] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cicloSeleccionado, setCicloSeleccionado] = useState("");

  // Panel lateral (drawer) con el detalle de una materia: null = cerrado.
  const [materiaPanel, setMateriaPanel] = useState(null); // catalogo item
  const [agregando, setAgregando] = useState(false);
  const [editandoGrupo, setEditandoGrupo] = useState(null); // planeacion row

  const facultad = facultadOverride || user.facultad;
  const qsFacultad = facultadOverride ? `&facultad=${encodeURIComponent(facultadOverride)}` : "";

  useEffect(() => {
    const qs = facultadOverride ? `?facultad=${encodeURIComponent(facultadOverride)}` : "";
    fetch(`/api/periodos${qs}`)
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
  }, [facultadOverride]);

  async function cargarDatos(p) {
    if (!p) return;
    setCargando(true);
    setError("");
    try {
      const [catRes, planRes] = await Promise.all([
        fetch(`/api/catalogo?periodo=${encodeURIComponent(p)}${qsFacultad}`),
        fetch(`/api/planeacion?periodo=${encodeURIComponent(p)}${qsFacultad}`)
      ]);
      const catData = await catRes.json();
      const planData = await planRes.json();
      if (!catRes.ok) throw new Error(catData.error);
      if (!planRes.ok) throw new Error(planData.error);

      setCatalogo(catData.catalogo || []);
      setCicloSeleccionado("");
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
    cargarDatos(periodo);
    if (periodo) {
      try {
        window.localStorage.setItem(storageKey, periodo);
      } catch (e) {
        /* localStorage no disponible: no pasa nada, solo no se recuerda */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  // Ciclos de formacion presentes en el catalogo del periodo (con la cuenta
  // de materias de cada uno), para que el decano elija uno y solo se vean
  // las materias de ese ciclo -- el resto de la lista queda oculta.
  const ciclos = useMemo(() => {
    const map = new Map();
    for (const item of catalogo) {
      const key = String(item.ciclo || "Sin ciclo");
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([ciclo, materias]) => ({ ciclo, materias }))
      .sort((a, b) => {
        const na = Number(a.ciclo);
        const nb = Number(b.ciclo);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.ciclo.localeCompare(b.ciclo);
      });
  }, [catalogo]);

  const materiasDelCiclo = useMemo(() => {
    if (!cicloSeleccionado) return [];
    return catalogo.filter((c) => String(c.ciclo || "Sin ciclo") === cicloSeleccionado);
  }, [catalogo, cicloSeleccionado]);

  const catalogoFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return materiasDelCiclo;
    return materiasDelCiclo.filter((c) =>
      [c.asignatura, c.programa, c.plan, c.ciclo].join(" ").toLowerCase().includes(q)
    );
  }, [materiasDelCiclo, busqueda]);

  // Filas que llegaron del archivo real de carreras y materias (traen su
  // propio GRUPO) y que todavia no tienen ningun grupo de planeacion creado:
  // estan pendientes de que el decano las revise y confirme.
  const pendientesConfirmar = useMemo(
    () =>
      catalogoFiltrado.filter(
        (c) => c.grupo && !(planeacionPorCatalogo[c.id]?.length > 0)
      ),
    [catalogoFiltrado, planeacionPorCatalogo]
  );

  const catalogoPorId = useMemo(() => {
    const map = {};
    for (const c of catalogo) map[c.id] = c;
    return map;
  }, [catalogo]);

  // Todos los grupos ya guardados en el periodo (de cualquier materia),
  // enriquecidos con el nombre de su asignatura, para que
  // lib/conflictos.js pueda avisar de cruces de docente/salon sin importar
  // a que materia pertenezcan.
  const todosLosGrupos = useMemo(() => {
    const todos = Object.values(planeacionPorCatalogo).flat();
    return todos.map((g) => ({
      ...g,
      catalogo_asignatura: catalogoPorId[g.catalogo_id]?.asignatura
    }));
  }, [planeacionPorCatalogo, catalogoPorId]);

  function abrirPanel(item) {
    setMateriaPanel(item);
    setAgregando(false);
    setEditandoGrupo(null);
  }

  function cerrarPanel() {
    setMateriaPanel(null);
    setAgregando(false);
    setEditandoGrupo(null);
  }

  async function crearGrupo(catalogoId, valores) {
    const res = await fetch("/api/planeacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogo_id: catalogoId, periodo, ...valores })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setAgregando(false);
    await cargarDatos(periodo);
  }

  async function actualizarGrupo(id, valores) {
    const res = await fetch(`/api/planeacion/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valores)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setEditandoGrupo(null);
    await cargarDatos(periodo);
  }

  async function eliminarGrupo(id) {
    if (!confirm("¿Eliminar este grupo? Esta accion no se puede deshacer.")) return;
    const res = await fetch(`/api/planeacion/${id}`, { method: "DELETE" });
    if (res.ok) await cargarDatos(periodo);
  }

  // El panel lateral muestra siempre el item de catalogo mas reciente (por
  // si sus grupos cambiaron tras crear/editar/eliminar), buscandolo por id
  // en vez de quedarse con la referencia vieja.
  const materiaPanelActual = materiaPanel ? catalogoPorId[materiaPanel.id] || materiaPanel : null;
  const gruposDelPanel = materiaPanelActual ? planeacionPorCatalogo[materiaPanelActual.id] || [] : [];

  return (
    <div className="min-h-screen">
      {mostrarCambiarPassword && (
        <CambiarPasswordModal onDone={() => setMostrarCambiarPassword(false)} />
      )}

      <TopBar user={user} titulo={titulo || "Mi planeación"}>
        {periodo && (
          <a
            href={`/api/planeacion/exportar?periodo=${encodeURIComponent(periodo)}${qsFacultad}`}
            className="btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconDownload /> Descargar {facultadOverride ? "el" : "mi"} Excel
          </a>
        )}
      </TopBar>

      <div className="filter-bar">
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

          <div className="flex-1 min-w-[260px]">
            <label className="label">Ciclo de formación</label>
            <div className="tab-strip">
              {ciclos.length === 0 && <p className="text-sm text-gray-400">Sin ciclos aún.</p>}
              {ciclos.map((c) => (
                <button
                  key={c.ciclo}
                  type="button"
                  className={`tab-btn ${cicloSeleccionado === c.ciclo ? "tab-btn-active" : ""}`}
                  onClick={() => setCicloSeleccionado(cicloSeleccionado === c.ciclo ? "" : c.ciclo)}
                >
                  {c.ciclo === "Sin ciclo" ? "Sin ciclo" : `Ciclo ${c.ciclo}`}
                  <span className="tab-count">{c.materias}</span>
                </button>
              ))}
            </div>
          </div>

          {cicloSeleccionado && (
            <div className="min-w-[220px]">
              <label className="label">Buscar asignatura</label>
              <input
                className="input"
                placeholder="Nombre, programa o plan..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!cargando && periodos.length === 0 && (
          <div className="empty-state">
            {facultadOverride
              ? `Todavía no hay catálogo cargado para ${facultadOverride} en ningún período.`
              : "Todavía no hay un catálogo cargado para ningún período. Pide al administrador que cargue el Excel base de tu facultad para el próximo ciclo."}
          </div>
        )}

        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}

        {!cargando && periodos.length > 0 && !cicloSeleccionado && (
          <div className="empty-state">
            Selecciona un ciclo de formación arriba para ver sus materias.
          </div>
        )}

        {cicloSeleccionado && (
          <ConfirmarCatalogoReal
            items={pendientesConfirmar}
            periodo={periodo}
            onConfirmado={() => cargarDatos(periodo)}
          />
        )}

        {cicloSeleccionado && catalogoFiltrado.length > 0 && (
          <div className="table-sap-wrap">
            <table className="table-sap">
              <thead>
                <tr>
                  <th>Asignatura</th>
                  <th>Programa · Plan</th>
                  <th>Créditos</th>
                  <th>Grupos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {catalogoFiltrado.map((item) => {
                  const grupos = planeacionPorCatalogo[item.id] || [];
                  return (
                    <tr key={item.id} role="button" onClick={() => abrirPanel(item)}>
                      <td className="font-medium text-gray-900">{item.asignatura}</td>
                      <td className="text-gray-500">
                        {item.programa} · {item.plan || "—"}
                      </td>
                      <td className="text-gray-500">{item.creditos ?? "—"}</td>
                      <td>
                        {grupos.length === 0 ? (
                          <span className="badge bg-amber-100 text-amber-700">Sin grupos</span>
                        ) : (
                          <span className="badge bg-gray-100 text-gray-600">
                            {grupos.length} grupo{grupos.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <span className="inline-flex items-center gap-1 text-brand-600 text-xs font-medium">
                          Programar <IconChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {cicloSeleccionado && !cargando && catalogoFiltrado.length === 0 && (
          <div className="empty-state">Ninguna asignatura coincide con la búsqueda.</div>
        )}
      </main>

      {materiaPanelActual && (
        <div className="overlay-drawer">
          <div className="overlay-drawer-backdrop" onClick={cerrarPanel} />
          <div className="drawer-panel">
            <div className="drawer-header">
              <div className="min-w-0">
                <p className="kicker mb-1">
                  {materiaPanelActual.programa} · Plan {materiaPanelActual.plan || "—"} · Ciclo{" "}
                  {materiaPanelActual.ciclo || "—"}
                </p>
                <h2 className="font-semibold text-gray-900 leading-tight">
                  {materiaPanelActual.asignatura}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {materiaPanelActual.creditos ?? "—"} créditos
                </p>
              </div>
              <button className="btn-icon" onClick={cerrarPanel}>
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="drawer-body">
              {gruposDelPanel.length > 0 && (
                <div className="table-sap-wrap">
                  <table className="table-sap">
                    <thead>
                      <tr>
                        <th>Grupo</th>
                        <th>Sede</th>
                        <th>Jornada</th>
                        <th>Días</th>
                        <th>Docente</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {gruposDelPanel.map((g) => (
                        <tr key={g.id}>
                          <td>{g.grupo || "—"}</td>
                          <td>{labelSede(g.modalidad)}</td>
                          <td>{labelJornada(g.jornada)}</td>
                          <td>{(g.horarios || []).map((h) => labelDia(h.dia)).join(", ") || "—"}</td>
                          <td>{g.nombre_docente || "—"}</td>
                          <td>
                            <EstadoBadge estado={g.estado} />
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <button
                              className="inline-flex items-center gap-1 text-brand-600 text-xs font-medium mr-3"
                              onClick={() => {
                                setAgregando(false);
                                setEditandoGrupo(g);
                              }}
                            >
                              <IconEdit className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button
                              className="inline-flex items-center gap-1 text-red-600 text-xs font-medium"
                              onClick={() => eliminarGrupo(g.id)}
                            >
                              <IconTrash className="w-3.5 h-3.5" /> Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!agregando && !editandoGrupo && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setEditandoGrupo(null);
                    setAgregando(true);
                  }}
                >
                  <IconPlus /> Agregar grupo (sede, jornada y horario)
                </button>
              )}

              {agregando && (
                <GrupoForm
                  facultad={facultad}
                  todosLosGrupos={todosLosGrupos}
                  onCancel={() => setAgregando(false)}
                  onSubmit={(valores) => crearGrupo(materiaPanelActual.id, valores)}
                />
              )}

              {editandoGrupo && (
                <GrupoForm
                  facultad={facultad}
                  initial={editandoGrupo}
                  todosLosGrupos={todosLosGrupos}
                  onCancel={() => setEditandoGrupo(null)}
                  onSubmit={(valores) => actualizarGrupo(editandoGrupo.id, valores)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
