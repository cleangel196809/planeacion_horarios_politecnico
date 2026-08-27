"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import CambiarPasswordModal from "@/components/CambiarPasswordModal";
import GrupoForm from "@/components/GrupoForm";
import EstadoBadge from "@/components/EstadoBadge";
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

export default function DecanoApp({ user }) {
  const [mostrarCambiarPassword, setMostrarCambiarPassword] = useState(
    user.debeCambiarPassword
  );
  const [periodos, setPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState("");
  const [catalogo, setCatalogo] = useState([]);
  const [planeacionPorCatalogo, setPlaneacionPorCatalogo] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [formularioAbiertoPara, setFormularioAbiertoPara] = useState(null); // catalogo_id
  const [editando, setEditando] = useState(null); // planeacion row

  useEffect(() => {
    fetch("/api/periodos")
      .then((r) => r.json())
      .then((d) => {
        setPeriodos(d.periodos || []);
        if (d.periodos?.length) setPeriodo(d.periodos[0]);
      });
  }, []);

  async function cargarDatos(p) {
    if (!p) return;
    setCargando(true);
    setError("");
    try {
      const [catRes, planRes] = await Promise.all([
        fetch(`/api/catalogo?periodo=${encodeURIComponent(p)}`),
        fetch(`/api/planeacion?periodo=${encodeURIComponent(p)}`)
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
    cargarDatos(periodo);
  }, [periodo]);

  const catalogoFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter((c) =>
      [c.asignatura, c.programa, c.plan, c.ciclo].join(" ").toLowerCase().includes(q)
    );
  }, [catalogo, busqueda]);

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
      <TopBar user={user} titulo="Mi planeación">
        {periodo && (
          <a
            href={`/api/planeacion/exportar?periodo=${encodeURIComponent(periodo)}`}
            className="btn-secondary"
          >
            Descargar mi Excel
          </a>
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
          <div className="flex-1 min-w-[200px]">
            <label className="label">Buscar asignatura</label>
            <input
              className="input"
              placeholder="Nombre de la asignatura, programa o plan..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!cargando && periodos.length === 0 && (
          <div className="card text-center text-gray-500">
            Todavía no hay un catálogo cargado para ningún período. Pide al administrador que
            cargue el Excel base de tu facultad para el próximo ciclo.
          </div>
        )}

        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}

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
                    + Agregar grupo
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
                                className="text-brand-600 text-xs font-medium mr-3"
                                onClick={() => setEditando(g)}
                              >
                                Editar
                              </button>
                              <button
                                className="text-red-600 text-xs font-medium"
                                onClick={() => eliminarGrupo(g.id)}
                              >
                                Eliminar
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
                      onCancel={() => setFormularioAbiertoPara(null)}
                      onSubmit={(valores) => crearGrupo(item.id, valores)}
                    />
                  </div>
                )}

                {editando && editando.catalogo_id === item.id && (
                  <div className="mt-3">
                    <GrupoForm
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
