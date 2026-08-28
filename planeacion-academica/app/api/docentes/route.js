const { query } = require("@/lib/db");
const { requireUser } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function GET(req) {
  try {
    const user = requireUser();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const facultad = searchParams.get("facultad");

    // Decano/coordinador solo pueden ver los docentes de su propia facultad;
    // admin puede pedir cualquiera (o ninguna, para ver todos).
    const facultadFiltro = user.rol === "decano" || user.rol === "coordinador" ? user.facultad : facultad;

    const params = [];
    const condiciones = [];
    if (facultadFiltro) {
      params.push(facultadFiltro);
      condiciones.push(`facultad = $${params.length}`);
    }
    if (q.length >= 2) {
      params.push(`%${q}%`);
      condiciones.push(`(nombre_completo ILIKE $${params.length} OR documento ILIKE $${params.length})`);
    }
    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    // Con facultad (el caso normal de la lista desplegable) se trae la lista
    // completa de esa facultad; sin facultad ni búsqueda no se devuelve nada,
    // para no descargar el catálogo entero de docentes por accidente.
    if (!facultadFiltro && q.length < 2) return ok({ docentes: [] });

    const { rows } = await query(
      `SELECT documento, nombre_completo, correo_institucional, facultad
       FROM docentes ${where} ORDER BY nombre_completo LIMIT 500`,
      params
    );
    return ok({ docentes: rows });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
