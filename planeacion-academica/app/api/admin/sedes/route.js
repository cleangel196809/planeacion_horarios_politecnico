const { query } = require("@/lib/db");
const { requireStaff } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

// Lista completa (incluidas inactivas) para la pantalla de administración de
// sedes; a diferencia de /api/sedes (que solo devuelve las activas para los
// formularios normales).
async function GET() {
  try {
    requireStaff();
    const { rows } = await query("SELECT id, nombre, activa FROM sedes ORDER BY nombre");
    return ok({ sedes: rows });
  } catch (err) {
    return jsonError(err);
  }
}

// Crea una sede nueva. El nombre se guarda tal cual se escribe (en
// mayúsculas, para que combine con la convención del resto de la app) y
// queda disponible de inmediato en los selectores de sede.
async function POST(req) {
  try {
    requireStaff();
    const body = await req.json();
    const nombre = String(body.nombre || "").trim().toUpperCase();
    if (!nombre) {
      const err = new Error("El nombre de la sede es obligatorio.");
      err.status = 400;
      throw err;
    }
    const { rows } = await query(
      `INSERT INTO sedes (nombre) VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET activa = TRUE
       RETURNING id, nombre, activa`,
      [nombre]
    );
    return ok({ sede: rows[0] }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

// Activa/desactiva una sede (no se borra del todo para no dejar huérfanos
// los salones/grupos que ya la usan; una sede desactivada simplemente deja
// de aparecer como opción para elegir en formularios nuevos).
async function PATCH(req) {
  try {
    requireStaff();
    const body = await req.json();
    if (!body.id) {
      const err = new Error("Se requiere id.");
      err.status = 400;
      throw err;
    }
    if (typeof body.activa !== "boolean") {
      const err = new Error("Se requiere activa (true/false).");
      err.status = 400;
      throw err;
    }
    const { rows } = await query(
      "UPDATE sedes SET activa = $1 WHERE id = $2 RETURNING id, nombre, activa",
      [body.activa, body.id]
    );
    return ok({ sede: rows[0] });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET, POST, PATCH };
