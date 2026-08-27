const { query } = require("@/lib/db");
const { requireUser } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function GET() {
  try {
    const user = requireUser();
    const params = [];
    let where = "";
    if (user.rol === "decano") {
      where = "WHERE facultad = $1";
      params.push(user.facultad);
    }
    const { rows } = await query(
      `SELECT DISTINCT periodo FROM catalogo ${where} ORDER BY periodo DESC`,
      params
    );
    return ok({ periodos: rows.map((r) => r.periodo) });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
