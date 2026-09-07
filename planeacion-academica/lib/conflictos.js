// Deteccion de cruces de horario (docente ocupado / salon ocupado) al
// guardar un grupo. Esta logica vivia unicamente dentro del asistente
// "Programacion del ciclo" (components/ProgramacionCicloForm.js, retirado
// al fusionar el flujo del decano en una sola pantalla); se extrajo aqui
// para que el flujo unico (GrupoForm + DecanoApp) la use al crear o editar
// CUALQUIER grupo, sin duplicar codigo.

// Convierte "HH:MM" a minutos desde medianoche, para comparar franjas.
function horaAMinutos(hhmm) {
  if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return null;
  const partes = hhmm.split(":").map(Number);
  const h = partes[0];
  const m = partes[1];
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

// Busca cruces del grupo en edicion (documentoDocente + horarios, cada uno
// con su propio salon) contra TODOS los demas grupos ya guardados en el
// periodo (todosLosGrupos: filas de planeacion con su arreglo .horarios,
// de cualquier materia/programa/facultad que se le haya pasado). Excluye de
// la comparacion al propio grupo (propioId) para que editar un grupo sin
// cambiar nada no se marque como cruzado consigo mismo.
//
// grupo: { documentoDocente, horarios: [{dia, hora_inicio, hora_fin, salon}] }
// todosLosGrupos: [{ id, documento_docente, grupo, catalogo_asignatura, horarios: [...] }]
// devuelve: string[] con un mensaje por cada choque encontrado (vacio si no hay ninguno)
function detectarConflictosHorario(grupo, todosLosGrupos, propioId) {
  const mensajes = [];
  const documentoDocente = grupo.documentoDocente || "";
  const horarios = grupo.horarios || [];
  const hayAlgunSalon = horarios.some((h) => h.salon);
  if (!documentoDocente && !hayAlgunSalon) return mensajes;

  for (const h of horarios) {
    if (!h.hora_inicio || !h.hora_fin) continue;
    for (const g of todosLosGrupos || []) {
      if (g.id === propioId) continue;
      for (const hh of g.horarios || []) {
        if (hh.dia !== h.dia) continue;
        if (!seSuperponen(h.hora_inicio, h.hora_fin, hh.hora_inicio, hh.hora_fin)) continue;

        const asignatura = g.catalogo_asignatura || "otra materia";
        if (documentoDocente && g.documento_docente === documentoDocente) {
          mensajes.push(
            "Docente ocupado el " + h.dia + " " + hh.hora_inicio + "-" + hh.hora_fin +
            " con \"" + asignatura + "\" (grupo " + (g.grupo || "-") + ")."
          );
        }
        if (h.salon && hh.salon && hh.salon === h.salon) {
          mensajes.push(
            "Salon \"" + h.salon + "\" ocupado el " + h.dia + " " + hh.hora_inicio + "-" + hh.hora_fin +
            " con \"" + asignatura + "\" (grupo " + (g.grupo || "-") + ")."
          );
        }
      }
    }
  }
  return mensajes;
}

module.exports = { seSuperponen, detectarConflictosHorario };
