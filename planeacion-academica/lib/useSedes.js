"use client";

import { useEffect, useState } from "react";
import { SEDES as SEDES_FALLBACK } from "@/lib/constants";

// Sedes disponibles para los selectores (salón, grupo, catálogo real). Arranca
// con el arreglo fijo de lib/constants.js (para que no haya parpadeo/lista
// vacía mientras carga) y, apenas responde /api/sedes, se actualiza con la
// lista real de la base de datos, que incluye las sedes que haya agregado la
// secretaría académica.
export function useSedes() {
  const [sedes, setSedes] = useState(SEDES_FALLBACK);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/sedes")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelado && Array.isArray(d.sedes) && d.sedes.length > 0) {
          setSedes(d.sedes);
        }
      })
      .catch(() => {
        /* si falla, seguimos mostrando el arreglo fijo de respaldo */
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return sedes;
}
