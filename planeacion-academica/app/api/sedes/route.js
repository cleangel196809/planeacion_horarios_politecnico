const { query } = require("@/lib/db");
const { requireUser } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");
const { SEDES: SEDES_ETIQUETAS } = require("@/lib/constants");

// Lista de sedes activas, en el mismo formato {value, label} que antes se
// tomaba del arreglo fijo lib/constants.js#SEDES, para que los formularios
// (salón, grupo, catálogo real) puedan agregar las sedes nuevas que cree la
// secretaría académica sin tener que redesplegar la aplicación. Las sedes
// originales conservan su etiqueta bonita (p. ej. "Calle 73"); una sede
// nueva usa su propio nombre tal cual se escribió.
async function GET() {
  try {
    requireUser();
    const { rows } = await query(
      "SELECT nombre FROM sedes WHERE activa = TRUE ORDER BY nombre"
    );
    const sedes = rows.map((r) => ({
      value: r.nombre,
      label: SEDES_ETIQUETAS.find((s) => s.value === r.nombre)?.label || r.nombre
    }));
    return ok({ sedes });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
