const { query, withTransaction } = require("@/lib/db");
const { requireEditor } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

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

async function getOwned(id, user) {
  const { rows } = await query("SELECT * FROM planeacion WHERE id = $1", [id]);
  const row = rows[0];
  if (!row) {
    const err = new Error("El registro no existe.");
    err.status = 404;
    throw err;
  }
  if (user.rol === "decano" && row.facultad !== user.facultad) {
    const err = new Error("No tienes permiso sobre este registro.");
    err.status = 403;
    throw err;
  }
  return row;
}

async function PUT(req, { params }) {
  try {
    const user = requireEditor();
    const id = Number(params.id);
    const existing = await getOwned(id, user);

    const body = await req.json();
    const campos = [
      "grupo",
      "codigo_moodle",
      "codigo_teams",
      "enlace_teams",
      "estado",
      "modalidad",
      "jornada",
      "capacidad",
      "documento_docente",
      "nombre_docente",
      "correo_institucional",
      "codigo_moodle_a_duplicar",
      "observaciones"
    ];

    const sets = [];
    const values = [];
    for (const campo of campos) {
      if (campo in body) {
        values.push(body[campo] === "" ? null : body[campo]);
        sets.push(`${campo} = $${values.length}`);
      }
    }
    values.push(user.id);
    sets.push(`modificado_por = $${values.length}`);
    sets.push("updated_at = now()");
    values.push(id);

    const horariosLimpios = validarHorarios(body.horarios);

    const actualizado = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE planeacion SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values
      );

      if (Array.isArray(body.horarios)) {
        await client.query("DELETE FROM planeacion_horario WHERE planeacion_id = $1", [id]);
        for (let i = 0; i < horariosLimpios.length; i++) {
          const h = horariosLimpios[i];
          await client.query(
            `INSERT INTO planeacion_horario (planeacion_id, dia, hora_inicio, hora_fin, salon, orden)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, h.dia, h.hora_inicio, h.hora_fin, h.salon, i]
          );
        }
      }

      return rows[0];
    });

    const { rows: horarios } = await query(
      "SELECT * FROM planeacion_horario WHERE planeacion_id = $1 ORDER BY orden",
      [id]
    );

    return ok({ planeacion: { ...actualizado, horarios } });
  } catch (err) {
    return jsonError(err);
  }
}

async function DELETE(req, { params }) {
  try {
    const user = requireEditor();
    const id = Number(params.id);
    await getOwned(id, user);
    await query("DELETE FROM planeacion WHERE id = $1", [id]);
    return ok({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { PUT, DELETE };
