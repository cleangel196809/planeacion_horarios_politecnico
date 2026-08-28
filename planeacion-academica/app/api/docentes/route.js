const { query } = require("@/lib/db");
const { requireUser } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function GET(req) {
  try {
    requireUser();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) return ok({ docentes: [] });

    const { rows } = await query(
      `SELECT documento, nombre_completo, correo_institucional
       FROM docentes
       WHERE nombre_completo ILIKE $1 OR documento ILIKE $1
       ORDER BY nombre_completo
       LIMIT 15`,
      [`%${q}%`]
    );
    return ok({ docentes: rows });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
