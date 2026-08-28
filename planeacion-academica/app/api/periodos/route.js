const { query } = require("@/lib/db");
const { requireUser } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function GET(req) {
  try {
    const user = requireUser();
    const { searchParams } = new URL(req.url);

    // Para decano/coordinador la facultad siempre es la propia (no se puede
    // elegir). Para admin, es opcional: si la manda (por ejemplo desde la
    // vista "actuar como decano de una facultad"), filtra por esa facultad;
    // si no la manda, ve los períodos de todas las facultades.
    const facultad =
      user.rol === "decano" || user.rol === "coordinador"
        ? user.facultad
        : searchParams.get("facultad");

    const params = [];
    let where = "";
    if (facultad) {
      where = "WHERE facultad = $1";
      params.push(facultad);
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
