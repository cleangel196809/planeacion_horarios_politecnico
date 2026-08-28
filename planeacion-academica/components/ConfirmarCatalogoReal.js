"use client";

import { useMemo, useState } from "react";
import { SEDES, JORNADAS, CICLOS } from "@/lib/constants";

const LIMITE_VISIBLE = 80;

// Sección para revisar/editar y confirmar en lote las filas que llegaron del
// archivo real de carreras y materias (tienen GRUPO propio). Confirmar una
// fila crea su grupo de planeación (con la jornada/sede que quede definida
// en ese momento), que es lo único que entra al Excel entregable.
export default function ConfirmarCatalogoReal({ items, periodo, onConfirmado }) {
  const [edits, setEdits] = useState({}); // id -> { programa, ciclo, jornada, sede }
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [filtroCiclo, setFiltroCiclo] = useState("");

  const visibles = useMemo(() => {
    if (!filtroCiclo) return items;
    return items.filter((it) => String(it.ciclo || "") === filtroCiclo);
  }, [items, filtroCiclo]);

  function valorDe(item, campo) {
    const editado = edits[item.id]?.[campo];
    return editado !== undefined ? editado : item[campo] || "";
  }

  function setValor(item, campo, valor) {
    setEdits((prev) => ({ ...prev, [item.id]: { ...prev[item.id], [campo]: valor } }));
  }

  function toggle(id) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function marcarVisibles(marcar) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      for (const it of visibles) {
        if (marcar) next.add(it.id);
        else next.delete(it.id);
      }
      return next;
    });
  }

  async function confirmarSeleccionados() {
    if (seleccionados.size === 0) {
      setError("Marca al menos una fila para confirmar.");
      return;
    }
    setError("");
    setGuardando(true);
    const fallidos = [];
    try {
      for (const id of seleccionados) {
        const item = items.find((it) => it.id === id);
        if (!item) continue;

        const programa = valorDe(item, "programa");
        const ciclo = valorDe(item, "ciclo");
        const jornada = valorDe(item, "jornada");
        const sede = valorDe(item, "sede");

        const patchRes = await fetch(`/api/catalogo/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programa, ciclo, jornada, sede })
        });
        if (!patchRes.ok) {
          const d = await patchRes.json().catch(() => ({}));
          fallidos.push(d.error || `No se pudo actualizar "${item.asignatura}"`);
          continue;
        }

        const planRes = await fetch("/api/planeacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            catalogo_id: id,
            periodo,
            grupo: item.grupo,
            modalidad: sede,
            jornada
          })
        });
        if (!planRes.ok) {
          const d = await planRes.json().catch(() => ({}));
          fallidos.push(d.error || `No se pudo confirmar "${item.asignatura}"`);
        }
      }

      setSeleccionados(new Set());
      await onConfirmado();
      if (fallidos.length > 0) {
        setError(`Algunas filas no se pudieron confirmar: ${fallidos.join(" / ")}`);
      }
    } finally {
      setGuardando(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="card border-brand-200">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-gray-900">Confirmar catálogo cargado</h2>
          <p className="text-sm text-gray-500">
            {items.length} fila{items.length === 1 ? "" : "s"} del archivo de carreras y materias
            están pendientes de confirmar. Revisa el plan, el ciclo, la jornada y la sede de cada
            una y marca las que quieras enviar al Excel entregable.
          </p>
        </div>
        <div>
          <label className="label">Filtrar por ciclo</label>
          <select className="input" value={filtroCiclo} onChange={(e) => setFiltroCiclo(e.target.value)}>
            <option value="">Todos</option>
            {CICLOS.map((c) => (
              <option key={c} value={c}>
                Ciclo {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs mb-2">
        <button className="text-brand-600 font-medium" onClick={() => marcarVisibles(true)}>
          Marcar visibles
        </button>
        <button className="text-brand-600 font-medium" onClick={() => marcarVisibles(false)}>
          Desmarcar visibles
        </button>
        <span className="ml-auto text-gray-500">{seleccionados.size} seleccionada(s)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-1 pr-2"></th>
              <th className="py-1 pr-2">Asignatura</th>
              <th className="py-1 pr-2">Plan</th>
              <th className="py-1 pr-2">Ciclo</th>
              <th className="py-1 pr-2">Grupo</th>
              <th className="py-1 pr-2">Jornada</th>
              <th className="py-1 pr-2">Sede</th>
            </tr>
          </thead>
          <tbody>
            {visibles.slice(0, LIMITE_VISIBLE).map((item) => (
              <tr key={item.id} className="border-b last:border-0 align-top">
                <td className="py-1.5 pr-2">
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={seleccionados.has(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                </td>
                <td className="py-1.5 pr-2 max-w-[220px]">{item.asignatura}</td>
                <td className="py-1.5 pr-2 min-w-[180px]">
                  <input
                    className="input py-1 text-xs"
                    value={valorDe(item, "programa")}
                    onChange={(e) => setValor(item, "programa", e.target.value)}
                  />
                </td>
                <td className="py-1.5 pr-2 min-w-[90px]">
                  <select
                    className="input py-1 text-xs"
                    value={valorDe(item, "ciclo")}
                    onChange={(e) => setValor(item, "ciclo", e.target.value)}
                  >
                    <option value="">—</option>
                    {CICLOS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-2">{item.grupo || "—"}</td>
                <td className="py-1.5 pr-2 min-w-[130px]">
                  <select
                    className="input py-1 text-xs"
                    value={valorDe(item, "jornada")}
                    onChange={(e) => setValor(item, "jornada", e.target.value)}
                  >
                    <option value="">—</option>
                    {JORNADAS.map((j) => (
                      <option key={j.value} value={j.value}>
                        {j.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-2 min-w-[150px]">
                  <select
                    className="input py-1 text-xs"
                    value={valorDe(item, "sede")}
                    onChange={(e) => setValor(item, "sede", e.target.value)}
                  >
                    <option value="">—</option>
                    {SEDES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibles.length > LIMITE_VISIBLE && (
          <p className="text-xs text-gray-400 mt-2">
            Mostrando {LIMITE_VISIBLE} de {visibles.length} filas. Usa el filtro de ciclo o la
            búsqueda de arriba para acotar la lista.
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
          {error}
        </p>
      )}

      <div className="flex justify-end mt-3">
        <button className="btn-primary" onClick={confirmarSeleccionados} disabled={guardando}>
          {guardando
            ? "Confirmando..."
            : `Confirmar ${seleccionados.size || ""} fila${seleccionados.size === 1 ? "" : "s"}`.trim()}
        </button>
      </div>
    </div>
  );
}
