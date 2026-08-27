const ExcelJS = require("exceljs");
const HEADERS = require("./templateHeaders");

// La plantilla sólo tiene columnas de día para LUN/MAR/MCL/JUE/VIE. Cada
// horario capturado para uno de esos días va SIEMPRE a su columna real
// correspondiente (miércoles -> columnas MCL, nunca a otra). La plantilla no
// tiene columna propia para SÁBADO pero la jornada "SABADO" sí existe en los
// datos reales de la institución (ver hoja CERRADOS de la plantilla original),
// así que un horario en sábado ocupa el primer slot Lunes-Viernes que haya
// quedado libre en esa fila. Si los 5 slots ya están ocupados (un grupo con
// clase los 6 días), el excedente se anota en OBSERVACIONES en vez de
// perderse. Ver README para el detalle de esta regla.
const SLOT_COLUMNS = [
  { inicio: "LUN H INICIAL", fin: "LUN HORA FINAL", salon: "LUN SALON" },
  { inicio: "MAR H INICIAL2", fin: "MAR HORA FINAL3", salon: "MAR SALON" },
  { inicio: "MCL HORA INICIAL", fin: "MCL HORA FINAL6", salon: "MCL SALON" },
  { inicio: "JUE HORA INICIAL2", fin: "JUE HORA FINAL63", salon: "JUE SALON" },
  { inicio: "VIE HORA INICIAL22", fin: "VIE HORA FINAL633", salon: "VIE SALON4" }
];

const SLOT_INDEX_POR_DIA = {
  LUNES: 0,
  MARTES: 1,
  MIERCOLES: 2,
  JUEVES: 3,
  VIERNES: 4
  // SABADO no tiene slot fijo: se asigna dinámicamente al primero libre.
};

// Distribuye los horarios de un grupo en los 5 slots de la plantilla,
// respetando el día real de cada uno y devolviendo los que no cupieron.
function ubicarHorariosEnSlots(horarios) {
  const asignados = new Array(SLOT_COLUMNS.length).fill(null);
  const sinUbicar = [];

  for (const h of horarios) {
    const idx = SLOT_INDEX_POR_DIA[h.dia];
    if (idx !== undefined && !asignados[idx]) {
      asignados[idx] = h;
    } else {
      sinUbicar.push(h);
    }
  }

  const restantes = [];
  for (const h of sinUbicar) {
    const libre = asignados.findIndex((slot) => slot === null);
    if (libre === -1) {
      restantes.push(h);
    } else {
      asignados[libre] = h;
    }
  }

  return { asignados, restantes };
}

function styleHeaderRow(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E40AF" }
  };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 30;
}

function addSheetWithHeaders(workbook, name, headers) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(headers);
  styleHeaderRow(sheet.getRow(1));
  sheet.columns = headers.map(() => ({ width: 18 }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return sheet;
}

/**
 * planeacionRows: filas ya unidas (JOIN) de catalogo + planeacion, cada una
 * con un array `horarios` (ordenado) de { dia, hora_inicio, hora_fin, salon }.
 */
async function buildPlaneacionExcel(planeacionRows, docentesRows = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Planeación Académica";
  workbook.created = new Date();

  const sheet = addSheetWithHeaders(workbook, "PLANEACION", HEADERS.PLANEACION);

  for (const r of planeacionRows) {
    const rowObj = {
      LLAVE: r.llave,
      CODIGO: r.codigo,
      FACULTAD: r.facultad,
      "PROGRAMA  ": r.programa,
      PLAN: r.plan,
      ASIGNATURA: r.asignatura,
      CICLO: r.ciclo,
      CREDITOS: r.creditos,
      GRUPO: r.grupo,
      "CODIGO MOODLE": r.codigo_moodle,
      "CODIGO TEAMS": r.codigo_teams,
      "ENLACE TEAMS": r.enlace_teams,
      ESTADO: r.estado,
      MODALIDAD: r.modalidad,
      "JORNADA ": r.jornada,
      CAPACIDAD: r.capacidad,
      DOCUMENTO_DOCENTE: r.documento_docente,
      NOMBRE_DOCENTE: r.nombre_docente,
      "CORREO INSTITUCIONAL ": r.correo_institucional,
      "CODIGO MOODLE A DUPLICAR": r.codigo_moodle_a_duplicar,
      " PERIODO ": r.periodo,
      "FECHA MODIFICACION": r.updated_at ? new Date(r.updated_at) : null,
      " MODIFICACION  ": r.modificado_por_nombre || null,
      " OBSERVACIONES ": r.observaciones,
      "LLAVE HORARIOS": null,
      "ID REFLEJO": null
    };

    const horarios = Array.isArray(r.horarios) ? r.horarios : [];
    const { asignados, restantes } = ubicarHorariosEnSlots(horarios);

    asignados.forEach((h, i) => {
      if (!h) return;
      const slot = SLOT_COLUMNS[i];
      rowObj[slot.inicio] = h.hora_inicio || null;
      rowObj[slot.fin] = h.hora_fin || null;
      rowObj[slot.salon] = h.salon || null;
    });

    if (restantes.length > 0) {
      const extra = restantes
        .map((h) => `${h.dia} ${h.hora_inicio || ""}-${h.hora_fin || ""} ${h.salon || ""}`.trim())
        .join(" | ");
      rowObj[" OBSERVACIONES "] = [rowObj[" OBSERVACIONES "], `Días adicionales: ${extra}`]
        .filter(Boolean)
        .join(" — ");
    }

    const values = HEADERS.PLANEACION.map((h) => (h in rowObj ? rowObj[h] : null));
    const row = sheet.addRow(values);
    const fechaModCol = HEADERS.PLANEACION.indexOf("FECHA MODIFICACION") + 1;
    if (fechaModCol > 0 && rowObj["FECHA MODIFICACION"]) {
      row.getCell(fechaModCol).numFmt = "yyyy-mm-dd hh:mm";
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: HEADERS.PLANEACION.length }
  };

  // Hoja de docentes (para que el archivo sirva de referencia cruzada).
  const docSheet = addSheetWithHeaders(workbook, "DOCENTES", HEADERS.DOCENTES);
  for (const d of docentesRows) {
    docSheet.addRow([
      d.documento,
      d.nombre_completo,
      d.correo_institucional,
      d.facultad || "#N/A",
      "#N/A"
    ]);
  }

  // Hojas que se conservan con la misma estructura de columnas que la
  // plantilla original, pero vacías: no forman parte del flujo de captura
  // de esta aplicación (reflejos y cierres se gestionan en el sistema
  // existente de Consulta de Horarios).
  addSheetWithHeaders(workbook, "REFLEJOS", HEADERS.REFLEJOS);
  addSheetWithHeaders(workbook, "CERRADOS", HEADERS.CERRADOS);

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildPlaneacionExcel, SLOT_COLUMNS };
