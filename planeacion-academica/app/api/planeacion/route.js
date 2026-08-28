const { query, withTransaction } = require("@/lib/db");
const { requireUser, requireEditor } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function attachHorarios(rows) {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return rows;
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

async function GET(req) {
  try {
    const user = requireUser();
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo");
    const catalogoId = searchParams.get("catalogo_id");
    if (!periodo) {
      const err = new Error("Debes indicar el período.");
      err.status = 400;
      throw err;
    }

    const params = [periodo];
    let where = "WHERE p.periodo = $1";
    if (user.rol === "decano" || user.rol === "coordinador") {
      params.push(user.facultad);
      where += ` AND p.facultad = $${params.length}`;
    } else {
      const facultad = searchParams.get("facultad");
      if (facultad) {
        params.push(facultad);
        where += ` AND p.facultad = $${params.length}`;
      }
    }
    if (catalogoId) {
      params.push(catalogoId);
      where += ` AND p.catalogo_id = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT p.* FROM planeacion p ${where} ORDER BY p.created_at`,
      params
    );

    return ok({ planeacion: await attachHorarios(rows) });
  } catch (err) {
    return jsonError(err);
  }
}

function validarHorarios(horarios) {
  if (!Array.isArray(horarios)) return [];
  const diasValidos = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
  return horarios
    .filter((h) => h && diasValidos.includes(h.dia))
    .map((h) => ({
      dia: h.dia,
      hora_inicio: h.hora_inicio || null,
      hora_fin: h.hora_fin || null,
      salon: h.salon || null
    }));
}

async function POST(req) {
  try {
    const user = requireEditor();
    const body = await req.json();
    const {
      catalogo_id,
      periodo,
      grupo,
      codigo_moodle,
      codigo_teams,
      enlace_teams,
      estado,
      modalidad,
      jornada,
      capacidad,
      documento_docente,
      nombre_docente,
      correo_institucional,
      codigo_moodle_a_duplicar,
      observaciones,
      horarios
    } = body;

    if (!catalogo_id || !periodo) {
      const err = new Error("catalogo_id y periodo son obligatorios.");
      err.status = 400;
      throw err;
    }

    const { rows: catalogoRows } = await query("SELECT * FROM catalogo WHERE id = $1", [
      catalogo_id
    ]);
    const catalogoItem = catalogoRows[0];
    if (!catalogoItem) {
      const err = new Error("La asignatura del catálogo no existe.");
      err.status = 404;
      throw err;
    }
    if (user.rol === "decano" && catalogoItem.facultad !== user.facultad) {
      const err = new Error("No tienes permiso para diligenciar esta facultad.");
      err.status = 403;
      throw err;
    }

    const horariosLimpios = validarHorarios(horarios);

    const nuevo = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO planeacion (
           catalogo_id, periodo, facultad, grupo, codigo_moodle, codigo_teams, enlace_teams,
           estado, modalidad, jornada, capacidad, documento_docente, nombre_docente,
           correo_institucional, codigo_moodle_a_duplicar, observaciones, creado_por, modificado_por
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
         RETURNING *`,
        [
          catalogo_id,
          periodo,
          catalogoItem.facultad,
          grupo || null,
          codigo_moodle || null,
          codigo_teams || null,
          enlace_teams || null,
          estado || "Sin reportar",
          modalidad || null,
          jornada || null,
          capacidad || null,
          documento_docente || null,
          nombre_docente || null,
          correo_institucional || null,
          codigo_moodle_a_duplicar || null,
          observaciones || null,
          user.id
        ]
      );
      const planeacionRow = rows[0];

      for (let i = 0; i < horariosLimpios.length; i++) {
        const h = horariosLimpios[i];
        await client.query(
          `INSERT INTO planeacion_horario (planeacion_id, dia, hora_inicio, hora_fin, salon, orden)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [planeacionRow.id, h.dia, h.hora_inicio, h.hora_fin, h.salon, i]
        );
      }

      return planeacionRow;
    });

    const [conHorarios] = await attachHorarios([nuevo]);
    return ok({ planeacion: conHorarios }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET, POST };
