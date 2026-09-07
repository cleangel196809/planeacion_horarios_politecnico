const { query } = require("@/lib/db");
const { requireStaff } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");
const {
  smtpConfigurado,
  enviarCorreoHorarioDocente,
  enviarCorreoHorarioDecano,
  enviarCorreoHorarioEstudiante
} = require("@/lib/email");

// NOTA sobre escala: esta ruta envía los correos de forma síncrona, dentro
// de la misma petición HTTP (en tandas de a 5, ver enviarEnTandas). Para un
// período con unos pocos cientos de destinatarios funciona bien, pero en
// una plataforma serverless (Vercel/Render) con límite de tiempo por
// petición, una facultad con miles de estudiantes podría no alcanzar a
// terminar antes de que la plataforma corte la función. Si eso llega a
// pasar, la solución no es "optimizar" este archivo sino mover el envío a
// un job en segundo plano (cola, cron, etc.) que no dependa de una sola
// petición HTTP — igual que se documentó para la importación masiva de
// Excel en otros proyectos hermanos de esta institución.

async function attachHorarios(rows) {
  const ids = rows.map((r) => r.id).filter((id) => id != null);
  if (ids.length === 0) return rows.map((r) => ({ ...r, horarios: [] }));
  const { rows: horarios } = await query(
    `SELECT * FROM planeacion_horario WHERE planeacion_id = ANY($1::int[]) ORDER BY planeacion_id, orden`,
    [ids]
  );
  const map = new Map();
  for (const h of horarios) {
    const list = map.get(h.planeacion_id) || [];
    list.push(h);
    map.set(h.planeacion_id, list);
  }
  return rows.map((r) => ({ ...r, horarios: map.get(r.id) || [] }));
}

async function enviarEnTandas(items, fn, tam = 5) {
  let enviados = 0;
  let omitidos = 0;
  for (let i = 0; i < items.length; i += tam) {
    const tanda = items.slice(i, i + tam);
    const resultados = await Promise.allSettled(tanda.map(fn));
    for (const r of resultados) {
      if (r.status === "fulfilled" && r.value) enviados++;
      else omitidos++;
    }
  }
  return { enviados, omitidos, total: items.length };
}

// Cada docente recibe SOLO sus propias clases del período (y, si se indicó,
// solo de una facultad puntual).
async function enviarADocentes(periodo, facultad) {
  const params = [periodo];
  let where =
    "p.periodo = $1 AND p.documento_docente IS NOT NULL AND p.correo_institucional IS NOT NULL AND p.correo_institucional <> ''";
  if (facultad) {
    params.push(facultad);
    where += ` AND p.facultad = $${params.length}`;
  }
  const { rows: docentes } = await query(
    `SELECT DISTINCT p.documento_docente, p.nombre_docente, p.correo_institucional
     FROM planeacion p WHERE ${where}`,
    params
  );

  return enviarEnTandas(docentes, async (d) => {
    const paramsClases = [periodo, d.documento_docente];
    let whereClases = "p.periodo = $1 AND p.documento_docente = $2";
    if (facultad) {
      paramsClases.push(facultad);
      whereClases += ` AND p.facultad = $${paramsClases.length}`;
    }
    const { rows } = await query(
      `SELECT p.id, p.grupo, p.modalidad AS sede, p.nombre_docente, c.asignatura
       FROM planeacion p JOIN catalogo c ON c.id = p.catalogo_id
       WHERE ${whereClases} ORDER BY c.asignatura`,
      paramsClases
    );
    const clases = await attachHorarios(rows);
    return enviarCorreoHorarioDocente({
      to: d.correo_institucional,
      nombre: d.nombre_docente,
      periodo,
      clases
    });
  });
}

// Cada decano recibe el horario COMPLETO de su propia facultad (no solo sus
// materias, porque el decano ve/gestiona toda la facultad).
async function enviarADecanos(periodo, facultad) {
  const params = [];
  let where = "rol = 'decano' AND activo = TRUE AND email IS NOT NULL AND email <> ''";
  if (facultad) {
    params.push(facultad);
    where += ` AND facultad = $${params.length}`;
  }
  const { rows: decanos } = await query(
    `SELECT nombre, facultad, email FROM usuarios WHERE ${where}`,
    params
  );

  return enviarEnTandas(decanos, async (dec) => {
    const { rows } = await query(
      `SELECT p.id, p.grupo, p.modalidad AS sede, p.nombre_docente, c.asignatura
       FROM planeacion p JOIN catalogo c ON c.id = p.catalogo_id
       WHERE p.periodo = $1 AND p.facultad = $2 ORDER BY c.asignatura, p.grupo`,
      [periodo, dec.facultad]
    );
    const clases = await attachHorarios(rows);
    return enviarCorreoHorarioDecano({
      to: dec.email,
      nombre: dec.nombre,
      periodo,
      facultad: dec.facultad,
      clases
    });
  });
}

// Cada estudiante recibe SOLO las materias en las que aparece matriculado
// en el archivo base de estudiantes (columnas asignatura/grupo de esa
// tabla), con el horario que tenga programado ese grupo si ya existe.
async function enviarAEstudiantes(periodo, facultad) {
  const params = [periodo];
  let where = "periodo = $1 AND correo IS NOT NULL AND correo <> ''";
  if (facultad) {
    params.push(facultad);
    where += ` AND facultad = $${params.length}`;
  }
  const { rows: filas } = await query(
    `SELECT documento, nombre_completo, correo, facultad, asignatura, grupo
     FROM estudiantes WHERE ${where} ORDER BY nombre_completo`,
    params
  );

  const porEstudiante = new Map();
  for (const f of filas) {
    if (!porEstudiante.has(f.documento)) {
      porEstudiante.set(f.documento, {
        documento: f.documento,
        nombre: f.nombre_completo,
        correo: f.correo,
        facultad: f.facultad,
        materias: []
      });
    }
    if (f.asignatura) porEstudiante.get(f.documento).materias.push({ asignatura: f.asignatura, grupo: f.grupo });
  }

  return enviarEnTandas([...porEstudiante.values()], async (est) => {
    const clases = [];
    for (const m of est.materias) {
      let fila = null;
      if (m.grupo) {
        const { rows } = await query(
          `SELECT p.id, p.grupo, p.modalidad AS sede, p.nombre_docente, c.asignatura
           FROM planeacion p JOIN catalogo c ON c.id = p.catalogo_id
           WHERE p.periodo = $1 AND p.facultad = $2 AND c.asignatura = $3 AND p.grupo = $4
           LIMIT 1`,
          [periodo, est.facultad, m.asignatura, m.grupo]
        );
        fila = rows[0] || null;
      }
      if (fila) {
        const [conHorario] = await attachHorarios([fila]);
        clases.push(conHorario);
      } else {
        clases.push({ asignatura: m.asignatura, grupo: m.grupo, sede: null, nombre_docente: null, horarios: [] });
      }
    }
    return enviarCorreoHorarioEstudiante({ to: est.correo, nombre: est.nombre, periodo, clases });
  });
}

async function POST(req) {
  try {
    requireStaff();
    const body = await req.json();
    const periodo = body.periodo;
    const facultad = body.facultad || null;
    const destinatarios = Array.isArray(body.destinatarios) ? body.destinatarios : [];

    if (!periodo) {
      const err = new Error("Debes indicar el período.");
      err.status = 400;
      throw err;
    }
    if (destinatarios.length === 0) {
      const err = new Error(
        "Selecciona al menos un tipo de destinatario (docentes, decanos o estudiantes)."
      );
      err.status = 400;
      throw err;
    }

    const resultado = {};
    if (destinatarios.includes("docentes")) resultado.docentes = await enviarADocentes(periodo, facultad);
    if (destinatarios.includes("decanos")) resultado.decanos = await enviarADecanos(periodo, facultad);
    if (destinatarios.includes("estudiantes")) resultado.estudiantes = await enviarAEstudiantes(periodo, facultad);

    return ok({ resultado, smtpConfigurado: smtpConfigurado() });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { POST };
