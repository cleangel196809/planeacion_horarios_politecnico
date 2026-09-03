const { query } = require("./db");

// Tablas incluidas en la copia de seguridad, en el orden en que se
// reinsertan al restaurar (padres antes que hijos, respetando las llaves
// foráneas del esquema en db/schema.sql). "serial: true" marca las tablas
// con id autoincremental, para las que además se reajusta la secuencia
// después de insertar (si no, la próxima fila nueva podría chocar con un id
// que ya vino en la copia). "conflicto" indica la columna que identifica una
// fila ya existente, para que restaurar sobre una base que ya tenga datos
// no falle por duplicados (ON CONFLICT ... DO NOTHING): una copia de
// seguridad debe poderse volver a pegar sin miedo a romper nada.
const TABLAS_BACKUP = [
  {
    nombre: "usuarios",
    columnas: [
      "id", "username", "password_hash", "rol", "nombre", "facultad", "email",
      "activo", "debe_cambiar_password", "reset_token", "reset_token_expira", "created_at"
    ],
    serial: true
  },
  { nombre: "sedes", columnas: ["id", "nombre", "activa", "created_at"], serial: true },
  {
    nombre: "catalogo",
    columnas: [
      "id", "periodo", "llave", "codigo", "facultad", "programa", "plan",
      "asignatura", "ciclo", "creditos", "created_at"
    ],
    serial: true
  },
  {
    nombre: "docentes",
    columnas: ["documento", "nombre_completo", "correo_institucional", "facultad"],
    conflicto: "documento"
  },
  {
    nombre: "salones",
    columnas: ["id", "sede", "nombre", "planta", "capacidad", "identificador", "observaciones"],
    serial: true
  },
  {
    nombre: "estudiantes",
    columnas: [
      "id", "periodo", "documento", "nombre_completo", "facultad", "programa", "plan",
      "ciclo", "asignatura", "grupo", "correo", "telefono", "cargado_por", "created_at"
    ],
    serial: true
  },
  {
    nombre: "planeacion",
    columnas: [
      "id", "catalogo_id", "periodo", "facultad", "grupo", "codigo_moodle", "codigo_teams",
      "enlace_teams", "estado", "modalidad", "jornada", "capacidad", "documento_docente",
      "nombre_docente", "correo_institucional", "codigo_moodle_a_duplicar", "observaciones",
      "creado_por", "modificado_por", "created_at", "updated_at"
    ],
    serial: true
  },
  {
    nombre: "planeacion_horario",
    columnas: ["id", "planeacion_id", "dia", "hora_inicio", "hora_fin", "salon", "orden"],
    serial: true
  }
];

// Escapa un valor de JS para incrustarlo literal en una sentencia SQL.
// (No se usan parámetros $1, $2... aquí porque el resultado es un archivo de
// texto para pegar en el editor SQL de Neon/psql, no una consulta que corra
// esta misma app.)
function sqlValor(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

// Genera el contenido completo del archivo .sql de respaldo: un INSERT por
// tabla (envuelto en una sola transacción BEGIN/COMMIT) más el resumen de
// cuántas filas trajo cada una, para mostrarlo en el panel de admin.
async function generarBackupSQL() {
  const partes = [];
  partes.push('-- Copia de seguridad de la base de datos "Planeación Académica"');
  partes.push(`-- Generada: ${new Date().toISOString()}`);
  partes.push("-- Para restaurar: pega este archivo completo en el editor SQL de Neon (o psql)");
  partes.push("-- sobre una base donde ya se ejecutó db/schema.sql.");
  partes.push("");
  partes.push("BEGIN;");
  partes.push("");

  const resumen = [];

  for (const tabla of TABLAS_BACKUP) {
    const { rows } = await query(`SELECT ${tabla.columnas.join(", ")} FROM ${tabla.nombre}`);
    resumen.push({ tabla: tabla.nombre, filas: rows.length });

    if (rows.length === 0) {
      partes.push(`-- ${tabla.nombre}: sin filas`);
      partes.push("");
      continue;
    }

    const conflictoCol = tabla.conflicto || (tabla.serial ? "id" : null);
    const valores = rows
      .map((r) => `  (${tabla.columnas.map((c) => sqlValor(r[c])).join(", ")})`)
      .join(",\n");

    partes.push(
      `INSERT INTO ${tabla.nombre} (${tabla.columnas.join(", ")}) VALUES\n${valores}` +
        (conflictoCol ? `\nON CONFLICT (${conflictoCol}) DO NOTHING;` : ";")
    );

    if (tabla.serial) {
      partes.push(
        `SELECT setval(pg_get_serial_sequence('${tabla.nombre}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM ${tabla.nombre}), 1));`
      );
    }
    partes.push("");
  }

  partes.push("COMMIT;");
  partes.push("");

  return { sql: partes.join("\n"), resumen };
}

module.exports = { generarBackupSQL, TABLAS_BACKUP };
