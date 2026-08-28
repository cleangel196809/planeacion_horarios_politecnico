const { query } = require("@/lib/db");
const { requireEditor } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

// Permite corregir, antes de confirmarla, una fila del catálogo cargada
// desde el archivo real de carreras y materias (facultad, plan/programa,
// ciclo, jornada, sede, grupo). Un decano solo puede editar filas de su
// propia facultad; el admin puede editar cualquiera.
const CAMPOS_EDITABLES = ["facultad", "programa", "plan", "ciclo", "jornada", "sede", "grupo"];

async function PATCH(req, { params }) {
  try {
    const user = requireEditor();
    const id = params.id;

    const { rows } = await query("SELECT * FROM catalogo WHERE id = $1", [id]);
    const item = rows[0];
    if (!item) {
      const err = new Error("No se encontró la asignatura del catálogo.");
      err.status = 404;
      throw err;
    }
    if (user.rol === "decano" && item.facultad !== user.facultad) {
      const err = new Error("No tienes permiso para editar esta asignatura.");
      err.status = 403;
      throw err;
    }

    const body = await req.json();
    const sets = [];
    const valores = [];
    for (const campo of CAMPOS_EDITABLES) {
      if (campo in body) {
        valores.push(body[campo] || null);
        sets.push(`${campo} = $${valores.length}`);
      }
    }
    if (sets.length === 0) {
      return ok({ catalogo: item });
    }

    valores.push(id);
    const { rows: actualizado } = await query(
      `UPDATE catalogo SET ${sets.join(", ")} WHERE id = $${valores.length} RETURNING *`,
      valores
    );

    return ok({ catalogo: actualizado[0] });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { PATCH };
