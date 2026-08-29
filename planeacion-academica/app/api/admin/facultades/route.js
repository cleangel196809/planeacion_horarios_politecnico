const { query } = require("@/lib/db");
const { requireStaff } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

// Lista de facultades que ya tienen decano/coordinador (para el selector de
// "entrar a diligenciar como esta facultad"). Es una versión reducida de
// /api/admin/usuarios (que además trae usuarios, correos, etc. y por eso está
// restringida solo al admin): esta ruta solo expone los nombres de facultad.
async function GET() {
  try {
    requireStaff();
    const { rows } = await query(
      `SELECT DISTINCT facultad FROM usuarios
       WHERE rol IN ('decano', 'coordinador') AND facultad IS NOT NULL
       ORDER BY facultad`
    );
    return ok({ facultades: rows.map((r) => r.facultad) });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
