const { query } = require("@/lib/db");
const { requireUser } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function GET(req) {
  try {
    const user = requireUser();
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo");
    if (!periodo) {
      const err = new Error("Debes indicar el período.");
      err.status = 400;
      throw err;
    }

    const facultad =
      user.rol === "decano" || user.rol === "coordinador"
        ? user.facultad
        : searchParams.get("facultad");

    const params = [periodo];
    let where = "WHERE c.periodo = $1";
    if (facultad) {
      params.push(facultad);
      where += ` AND c.facultad = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT c.*,
              COUNT(p.id)::int AS grupos_creados
       FROM catalogo c
       LEFT JOIN planeacion p ON p.catalogo_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.programa, c.ciclo, c.asignatura`,
      params
    );

    return ok({ catalogo: rows });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
