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

// --- Importación del archivo real "carreras y materias" -------------------
// Este archivo NO tiene una hoja llamada PLANEACION: es un export de tabla de
// Excel con encabezados "Columna1..N" en la fila 1 y los encabezados reales
// en la fila 2 (NOMBRE_FACULTAD, COD_PLAN, NOM_PLAN, COD_ASIGNATURA,
// ASIGNATURA, CICLO, CREDITOS, GRUPO, JORNADA, SEDE, IDENTIFICADOR,
// FLG_VIRTUAL, SEMILLA). Se detecta la fila de encabezado real buscando la
// columna NOMBRE_FACULTAD en vez de asumir que siempre es la fila 2.

// La jornada del archivo trae más variantes de las 5 categorías que maneja
// la aplicación (Diurno, Especial, Nocturno, Sabatino, Virtual), así que se
// normalizan aquí. "Tarde" no tiene una categoría propia entre esas 5; se
// agrupa con "Especial" por ser la franja intermedia más cercana.
const JORNADA_MAP = {
  DIURNO: "DIURNA",
  "DIURNO TECNICO LABORAL": "DIURNA",
  ESPECIAL: "ESPECIAL",
  TARDE: "ESPECIAL",
  NOCTURNA: "NOCHE",
  "NOCHE TECNICO LABORAL": "NOCHE",
  SABADO: "SABADO"
};

const SEDE_MAP = {
  "SEDE CALLE 73": "CALLE 73",
  "SEDE NORTE": "NORTE",
  "SEDE SUR": "SUR"
};

function esVirtual(valor) {
  return String(valor || "").trim().toUpperCase() === "S";
}

function normalizarJornadaReal(valorOriginal, flgVirtual) {
  if (flgVirtual) return "VIRTUAL";
  const clave = String(valorOriginal || "").trim().toUpperCase();
  return JORNADA_MAP[clave] || null;
}

function normalizarSedeReal(valorOriginal, flgVirtual) {
  // Si la asignatura es asistida por tecnología, se considera de sede
  // virtual aunque el archivo traiga una sede física asociada; el decano
  // puede corregirlo manualmente al confirmar la fila.
  if (flgVirtual) return "ASISTIDA POR TECNOLOGIA";
  const clave = String(valorOriginal || "").trim().toUpperCase();
  return SEDE_MAP[clave] || null;
}

function encontrarFilaEncabezadoReal(sheet) {
  for (let r = 1; r <= 5; r++) {
    const row = sheet.getRow(r);
    let encontrada = false;
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (normalizeHeader(unwrapCellValue(cell.value)) === "NOMBRE_FACULTAD") encontrada = true;
    });
    if (encontrada) return r;
  }
  return null;
}

/**
 * Lee el archivo real de "carreras y materias" (distinto de la plantilla
 * PLANEACION) y devuelve el catálogo con GRUPO/JORNADA/SEDE ya normalizados,
 * más la lista de facultades encontradas (para crear un decano por cada una)
 * y los valores de jornada que no se pudieron reconocer (para avisarle al
 * administrador, por ejemplo variantes nuevas no contempladas).
 */
async function parseCatalogoRealExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("El archivo no tiene ninguna hoja de cálculo.");
  }

  const filaEncabezado = encontrarFilaEncabezadoReal(sheet);
  if (!filaEncabezado) {
    throw new Error(
      "No se encontró la columna NOMBRE_FACULTAD en las primeras filas del archivo. Verifica que sea el archivo de carreras y materias correcto."
    );
  }

  const headerMap = buildHeaderMap(sheet.getRow(filaEncabezado));
  const idx = {
    FACULTAD: headerMap.findIndex((h) => h === "NOMBRE_FACULTAD"),
    COD_PLAN: headerMap.findIndex((h) => h === "COD_PLAN"),
    NOM_PLAN: headerMap.findIndex((h) => h === "NOM_PLAN"),
    COD_ASIGNATURA: headerMap.findIndex((h) => h === "COD_ASIGNATURA"),
    ASIGNATURA: headerMap.findIndex((h) => h === "ASIGNATURA"),
    CICLO: headerMap.findIndex((h) => h === "CICLO"),
    CREDITOS: headerMap.findIndex((h) => h === "CREDITOS"),
    GRUPO: headerMap.findIndex((h) => h === "GRUPO"),
    JORNADA: headerMap.findIndex((h) => h === "JORNADA"),
    SEDE: headerMap.findIndex((h) => h === "SEDE"),
    IDENTIFICADOR: headerMap.findIndex((h) => h === "IDENTIFICADOR"),
    FLG_VIRTUAL: headerMap.findIndex((h) => h === "FLG_VIRTUAL")
  };

  const requeridos = ["FACULTAD", "NOM_PLAN", "ASIGNATURA"];
  for (const col of requeridos) {
    if (idx[col] === -1) {
      throw new Error(
        `No se encontró en el archivo la columna equivalente a "${col}". Revisa los encabezados de la fila ${filaEncabezado}.`
      );
    }
  }

  const catalogo = [];
  const facultadesEncontradas = new Set();
  const jornadasNoReconocidas = new Set();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= filaEncabezado) return; // encabezados (y la fila "Columna1..N" si existe)
    const get = (i) => (i === -1 ? null : row.getCell(i + 1).value);

    const facultad = toStringOrNull(get(idx.FACULTAD));
    const programa = toStringOrNull(get(idx.NOM_PLAN));
    const asignatura = toStringOrNull(get(idx.ASIGNATURA));
    if (!facultad || !programa || !asignatura) return; // fila vacía o incompleta

    const flgVirtual = esVirtual(get(idx.FLG_VIRTUAL));

    const jornadaOriginal = toStringOrNull(get(idx.JORNADA));
    const jornada = normalizarJornadaReal(jornadaOriginal, flgVirtual);
    if (!flgVirtual && jornadaOriginal && !jornada) {
      jornadasNoReconocidas.add(jornadaOriginal);
    }

    const sede = normalizarSedeReal(toStringOrNull(get(idx.SEDE)), flgVirtual);
    const identificador = toStringOrNull(get(idx.IDENTIFICADOR));
    const codigoAsignatura = toStringOrNull(get(idx.COD_ASIGNATURA));

    facultadesEncontradas.add(facultad);

    catalogo.push({
      llave: identificador || codigoAsignatura || `FILA-${rowNumber}`,
      codigo: codigoAsignatura,
      facultad,
      programa,
      plan: toStringOrNull(get(idx.COD_PLAN)),
      asignatura,
      ciclo: toStringOrNull(get(idx.CICLO)),
      creditos: toNumberOrNull(get(idx.CREDITOS)),
      grupo: toStringOrNull(get(idx.GRUPO)),
      jornada,
      sede
    });
  });

  if (catalogo.length === 0) {
    throw new Error(
      "No se encontraron filas con NOMBRE_FACULTAD, NOM_PLAN y ASIGNATURA diligenciados en el archivo."
    );
  }

  return {
    catalogo,
    facultades: [...facultadesEncontradas].sort(),
    jornadasNoReconocidas: [...jornadasNoReconocidas].sort()
  };
}

module.exports = { parseCatalogoExcel, parseCatalogoRealExcel };
