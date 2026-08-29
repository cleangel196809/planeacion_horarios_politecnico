"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import CambiarPasswordModal from "@/components/CambiarPasswordModal";
import GrupoForm from "@/components/GrupoForm";
import EstadoBadge from "@/components/EstadoBadge";
import NuevoFormularioWizard from "@/components/NuevoFormularioWizard";
import ConfirmarCatalogoReal from "@/components/ConfirmarCatalogoReal";
import { SEDES, JORNADAS, DIAS } from "@/lib/constants";
import { IconPlus, IconDownload, IconEdit, IconTrash } from "@/components/Icons";

function labelSede(v) {
  return SEDES.find((s) => s.value === v)?.label || v || "—";
}
function labelJornada(v) {
  return JORNADAS.find((j) => j.value === v)?.label || v || "—";
}
function labelDia(v) {
  return DIAS.find((d) => d.value === v)?.corto || v;
}

// facultadOverride: solo la usa el administrador cuando entra a "actuar
// como decano" de una facultad puntual (ver AdminApp). Un decano normal
// nunca la recibe: su facultad ya viene fija en su sesión y el backend la
// aplica solo, así que aquí basta con no mandar nada distinto.
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
  const [formularioAbiertoPara, setFormularioAbiertoPara] = useState(null); // catalogo_id
  const [editando, setEditando] = useState(null); // planeacion row
  const [mostrarWizard, setMostrarWizard] = useState(false);

  const qsFacultad = facultadOverride ? `&facultad=${encodeURIComponent(facultadOverride)}` : "";

  useEffect(() => {
    const qs = facultadOverride ? `?facultad=${encodeURIComponent(facultadOverride)}` : "";
    fetch(`/api/periodos${qs}`)
      .then((r) => r.json())
      .then((d) => {
        const lista = d.periodos || [];
        setPeriodos(lista);
        if (lista.length === 0) return;
        // Recuerda el último período que se vio en este navegador para esta
        // facultad, en vez de siempre caer al primero de la lista.
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

  // Ciclos de formación presentes en el catálogo del período (con la cuenta
  // de materias de cada uno), para que el decano elija uno y solo se vean
  // las materias de ese ciclo — el resto de la lista queda oculta.
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
  // propio GRUPO) y que todavía no tienen ningún grupo de planeación creado:
  // están pendientes de que el decano las revise y confirme.
  const pendientesConfirmar = useMemo(
    () =>
      catalogoFiltrado.filter(
        (c) => c.grupo && !(planeacionPorCatalogo[c.id]?.length > 0)
      ),
    [catalogoFiltrado, planeacionPorCatalogo]
  );

  async function crearGrupo(catalogoId, valores) {
    const res = await fetch("/api/planeacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogo_id: catalogoId, periodo, ...valores })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setFormularioAbiertoPara(null);
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
    setEditando(null);
    await cargarDatos(periodo);
  }

  async function eliminarGrupo(id) {
    if (!confirm("¿Eliminar este grupo? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/planeacion/${id}`, { method: "DELETE" });
    if (res.ok) await cargarDatos(periodo);
  }

  return (
    <div className="min-h-screen">
      {mostrarCambiarPassword && (
        <CambiarPasswordModal onDone={() => setMostrarCambiarPassword(false)} />
      )}
      {mostrarWizard && (
        <NuevoFormularioWizard
          periodos={periodos}
          facultadOverride={facultadOverride}
          onClose={() => setMostrarWizard(false)}
          onCreated={(periodoUsado) => {
            if (periodoUsado && periodoUsado !== periodo) {
              setPeriodo(periodoUsado); // el useEffect de [periodo] recarga los datos
            } else {
              cargarDatos(periodo);
            }
          }}
        />
      )}

      <TopBar user={user} titulo={titulo || "Mi planeación"}>
        {periodo && (
          <>
            <button className="btn-primary" onClick={() => setMostrarWizard(true)}>
              <IconPlus /> Nuevo formulario
            </button>
            <a
              href={`/api/planeacion/exportar?periodo=${encodeURIComponent(periodo)}${qsFacultad}`}
              className="btn-secondary"
            >
              <IconDownload /> Descargar {facultadOverride ? "el" : "mi"} Excel
            </a>
          </>
        )}
      </TopBar>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
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
          <div>
            <label className="label">Ciclo de formación</label>
            <select
              className="input"
              value={cicloSeleccionado}
              onChange={(e) => setCicloSeleccionado(e.target.value)}
            >
              <option value="">Selecciona un ciclo...</option>
              {ciclos.map((c) => (
                <option key={c.ciclo} value={c.ciclo}>
                  {c.ciclo === "Sin ciclo" ? "Sin ciclo" : `Ciclo ${c.ciclo}`} ({c.materias})
                </option>
              ))}
            </select>
          </div>
          {cicloSeleccionado && (
            <div className="flex-1 min-w-[200px]">
              <label className="label">Buscar asignatura</label>
              <input
                className="input"
                placeholder="Nombre de la asignatura, programa o plan..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!cargando && periodos.length === 0 && (
          <div className="card text-center text-gray-500">
            {facultadOverride
              ? `Todavía no hay catálogo cargado para ${facultadOverride} en ningún período.`
              : "Todavía no hay un catálogo cargado para ningún período. Pide al administrador que cargue el Excel base de tu facultad para el próximo ciclo."}
          </div>
        )}

        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}

        {!cargando && periodos.length > 0 && !cicloSeleccionado && (
          <div className="card text-center text-gray-500">
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

        <div className="space-y-3">
          {catalogoFiltrado.map((item) => {
            const grupos = planeacionPorCatalogo[item.id] || [];
            return (
              <div key={item.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.asignatura}</h3>
                    <p className="text-xs text-gray-500">
                      {item.programa} · Plan {item.plan} · Ciclo {item.ciclo} · {item.creditos} créditos
                    </p>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      setFormularioAbiertoPara(formularioAbiertoPara === item.id ? null : item.id)
                    }
                  >
                    <IconPlus /> Agregar grupo
                  </button>
                </div>

                {grupos.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-1 pr-3">Grupo</th>
                          <th className="py-1 pr-3">Sede</th>
                          <th className="py-1 pr-3">Jornada</th>
                          <th className="py-1 pr-3">Días</th>
                          <th className="py-1 pr-3">Docente</th>
                          <th className="py-1 pr-3">Estado</th>
                          <th className="py-1 pr-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupos.map((g) => (
                          <tr key={g.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3">{g.grupo || "—"}</td>
                            <td className="py-1.5 pr-3">{labelSede(g.modalidad)}</td>
                            <td className="py-1.5 pr-3">{labelJornada(g.jornada)}</td>
                            <td className="py-1.5 pr-3">
                              {(g.horarios || []).map((h) => labelDia(h.dia)).join(", ") || "—"}
                            </td>
                            <td className="py-1.5 pr-3">{g.nombre_docente || "—"}</td>
                            <td className="py-1.5 pr-3">
                              <EstadoBadge estado={g.estado} />
                            </td>
                            <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                              <button
                                className="inline-flex items-center gap-1 text-brand-600 text-xs font-medium mr-3"
                                onClick={() => setEditando(g)}
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

                {formularioAbiertoPara === item.id && (
                  <div className="mt-3">
                    <GrupoForm
                      facultad={facultadOverride || user.facultad}
                      onCancel={() => setFormularioAbiertoPara(null)}
                      onSubmit={(valores) => crearGrupo(item.id, valores)}
                    />
                  </div>
                )}

                {editando && editando.catalogo_id === item.id && (
                  <div className="mt-3">
                    <GrupoForm
                      facultad={facultadOverride || user.facultad}
                      initial={editando}
                      onCancel={() => setEditando(null)}
                      onSubmit={(valores) => actualizarGrupo(editando.id, valores)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
