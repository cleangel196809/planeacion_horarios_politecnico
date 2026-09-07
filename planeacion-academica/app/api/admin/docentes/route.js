const { query } = require("@/lib/db");
const { requireAdmin } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

// Listado completo para el módulo de administración (a diferencia de
// /api/docentes, que es de solo búsqueda y usan decano/coordinador).
async function GET(req) {
  try {
    requireAdmin();
    const { searchParams } = new URL(req.url);
    const facultad = searchParams.get("facultad");

    const params = [];
    let where = "";
    if (facultad) {
      params.push(facultad);
      where = "WHERE facultad = $1";
    }
    const { rows } = await query(
      `SELECT documento, nombre_completo, correo_institucional, facultad
       FROM docentes ${where} ORDER BY facultad NULLS LAST, nombre_completo`,
      params
    );
    return ok({ docentes: rows });
  } catch (err) {
    return jsonError(err);
  }
}

// Crea o actualiza un docente individual (upsert por documento): el mismo
// endpoint sirve tanto para "crear" como para "editar" desde el formulario
// de administración, y para el resultado de la carga por Excel.
async function POST(req) {
  try {
    requireAdmin();
    const body = await req.json();
    const documento = String(body.documento || "").trim();
    const nombreCompleto = String(body.nombre_completo || "").trim();
    const facultad = body.facultad ? String(body.facultad).trim() : null;
    const correo = body.correo_institucional ? String(body.correo_institucional).trim() : null;

    if (!documento || !nombreCompleto || !facultad) {
      const err = new Error("Documento, nombre completo y facultad son obligatorios.");
      err.status = 400;
      throw err;
    }

    const { rows } = await query(
      `INSERT INTO docentes (documento, nombre_completo, correo_institucional, facultad)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (documento) DO UPDATE SET
         nombre_completo = EXCLUDED.nombre_completo,
         correo_institucional = EXCLUDED.correo_institucional,
         facultad = EXCLUDED.facultad
       RETURNING documento, nombre_completo, correo_institucional, facultad`,
      [documento, nombreCompleto, correo, facultad]
    );

    return ok({ docente: rows[0] }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

async function DELETE(req) {
  try {
    requireAdmin();
    const body = await req.json();
    const documento = String(body.documento || "").trim();
    if (!documento) {
      const err = new Error("Se requiere documento.");
      err.status = 400;
      throw err;
    }
    await query("DELETE FROM docentes WHERE documento = $1", [documento]);
    return ok({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET, POST, DELETE };
