const ExcelJS = require("exceljs");

function normalizeHeader(h) {
  return String(h || "").trim().toUpperCase();
}

function findSheet(workbook, nameFragment) {
  return workbook.worksheets.find((ws) =>
    normalizeHeader(ws.name).includes(normalizeHeader(nameFragment))
  );
}

function buildHeaderMap(headerRow) {
  const map = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    map[colNumber - 1] = normalizeHeader(cell.value);
  });
  return map;
}

// ExcelJS no siempre entrega valores primitivos: celdas con fórmula llegan como
// { formula, result }, texto enriquecido como { richText: [...] } y algunas
// como { text }. Esta función normaliza cualquiera de esas formas a texto.
function unwrapCellValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "object") return v;
  if (v instanceof Date) return v;
  if ("result" in v) return unwrapCellValue(v.result);
  if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
  if ("text" in v) return v.text;
  if ("hyperlink" in v) return v.text || v.hyperlink;
  return null;
}

function toStringOrNull(v) {
  const raw = unwrapCellValue(v);
  if (raw === null || raw === undefined || raw === "") return null;
  return String(raw).trim();
}

function toNumberOrNull(v) {
  const raw = unwrapCellValue(v);
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

/**
 * Lee un archivo Excel (buffer) con la misma estructura de la plantilla
 * PLANEACION y extrae el catálogo base de asignaturas (y, si existe,
 * el catálogo de docentes) para un período dado.
 */
async function parseCatalogoExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const planeacionSheet = findSheet(workbook, "PLANEACION");
  if (!planeacionSheet) {
    throw new Error(
      "No se encontró una hoja llamada 'PLANEACION' en el archivo. Verifica que sea el mismo formato de la plantilla."
    );
  }

  const headerMap = buildHeaderMap(planeacionSheet.getRow(1));
  const idx = {
    LLAVE: headerMap.findIndex((h) => h === "LLAVE"),
    CODIGO: headerMap.findIndex((h) => h === "CODIGO"),
    FACULTAD: headerMap.findIndex((h) => h === "FACULTAD"),
    PROGRAMA: headerMap.findIndex((h) => h.startsWith("PROGRAMA")),
    PLAN: headerMap.findIndex((h) => h === "PLAN"),
    ASIGNATURA: headerMap.findIndex((h) => h === "ASIGNATURA"),
    CICLO: headerMap.findIndex((h) => h === "CICLO"),
    CREDITOS: headerMap.findIndex((h) => h === "CREDITOS")
  };

  const requiredCols = ["FACULTAD", "PROGRAMA", "ASIGNATURA"];
  for (const col of requiredCols) {
    if (idx[col] === -1) {
      throw new Error(
        `La hoja PLANEACION no tiene una columna reconocible para "${col}". Revisa los encabezados de la fila 1.`
      );
    }
  }

  const catalogo = [];
  let fila = 1;
  planeacionSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado
    const get = (i) => (i === -1 ? null : row.getCell(i + 1).value);

    const facultad = toStringOrNull(get(idx.FACULTAD));
    const programa = toStringOrNull(get(idx.PROGRAMA));
    const asignatura = toStringOrNull(get(idx.ASIGNATURA));

    if (!facultad || !programa || !asignatura) return; // fila vacía o incompleta

    const codigo = toStringOrNull(get(idx.CODIGO));
    const llave = toStringOrNull(get(idx.LLAVE)) || codigo || `FILA-${rowNumber}`;

    catalogo.push({
      llave,
      codigo,
      facultad,
      programa,
      plan: toStringOrNull(get(idx.PLAN)),
      asignatura,
      ciclo: toStringOrNull(get(idx.CICLO)),
      creditos: toNumberOrNull(get(idx.CREDITOS))
    });
    fila++;
  });

  if (catalogo.length === 0) {
    throw new Error(
      "No se encontraron filas con FACULTAD, PROGRAMA y ASIGNATURA diligenciados en la hoja PLANEACION."
    );
  }

  // Docentes es opcional.
  let docentes = [];
  const docentesSheet = findSheet(workbook, "DOCENTES");
  if (docentesSheet) {
    const dHeaderMap = buildHeaderMap(docentesSheet.getRow(1));
    const dIdx = {
      DOC: dHeaderMap.findIndex((h) => h.includes("NIT") || h.includes("DOCUMENTO")),
      NOMBRE: dHeaderMap.findIndex((h) => h.includes("NOMBRE")),
      CORREO: dHeaderMap.findIndex((h) => h.includes("CORREO")),
      FACULTAD: dHeaderMap.findIndex((h) => h === "FACULTAD"),
      SEDE: dHeaderMap.findIndex((h) => h === "SEDE")
    };
    if (dIdx.DOC !== -1 && dIdx.NOMBRE !== -1) {
      docentesSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const get = (i) => (i === -1 ? null : row.getCell(i + 1).value);
        const documento = toStringOrNull(get(dIdx.DOC));
        const nombre = toStringOrNull(get(dIdx.NOMBRE));
        if (!documento || !nombre) return;
        const facultadDoc = toStringOrNull(get(dIdx.FACULTAD));
        docentes.push({
          documento,
          nombre_completo: nombre,
          correo_institucional: toStringOrNull(get(dIdx.CORREO)),
          facultad: facultadDoc && facultadDoc !== "#N/A" ? facultadDoc : null
        });
      });
    }
  }

  return { catalogo, docentes };
}

module.exports = { parseCatalogoExcel };
