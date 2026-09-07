const { query } = require("@/lib/db");
const { requireUser } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function GET(req) {
  try {
    requireUser();
    const { searchParams } = new URL(req.url);
    const sede = searchParams.get("sede");
    if (!sede) return ok({ salones: [] });

    const { rows } = await query(
      `SELECT id, sede, nombre, planta, capacidad, identificador
       FROM salones WHERE sede = $1 ORDER BY planta NULLS LAST, nombre`,
      [sede]
    );
    return ok({ salones: rows });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
