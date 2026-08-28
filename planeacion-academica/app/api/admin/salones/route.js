const { query } = require("@/lib/db");
const { requireAdmin } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function GET(req) {
  try {
    requireAdmin();
    const { searchParams } = new URL(req.url);
    const sede = searchParams.get("sede");

    const params = [];
    let where = "";
    if (sede) {
      params.push(sede);
      where = "WHERE sede = $1";
    }
    const { rows } = await query(
      `SELECT id, sede, nombre, planta, capacidad, identificador, observaciones
       FROM salones ${where} ORDER BY sede, planta NULLS LAST, nombre`,
      params
    );
    return ok({ salones: rows });
  } catch (err) {
    return jsonError(err);
  }
}

// Crea o actualiza un salón individual. Si viene "id" es una edición de ese
// registro; si no, es un alta nueva (con upsert por sede+nombre para que
// cargar el mismo salón dos veces no duplique la fila).
async function POST(req) {
  try {
    requireAdmin();
    const body = await req.json();
    const sede = String(body.sede || "").trim();
    const nombre = String(body.nombre || "").trim();
    const planta = body.planta ? String(body.planta).trim() : null;
    const capacidad = body.capacidad === "" || body.capacidad == null ? null : Number(body.capacidad);
    const identificador = body.identificador ? String(body.identificador).trim() : null;
    const observaciones = body.observaciones ? String(body.observaciones).trim() : null;

    if (!sede || !nombre) {
      const err = new Error("Sede y nombre del salón son obligatorios.");
      err.status = 400;
      throw err;
    }

    if (body.id) {
      const { rows } = await query(
        `UPDATE salones SET sede = $1, nombre = $2, planta = $3, capacidad = $4,
                identificador = $5, observaciones = $6
         WHERE id = $7
         RETURNING id, sede, nombre, planta, capacidad, identificador, observaciones`,
        [sede, nombre, planta, capacidad, identificador, observaciones, body.id]
      );
      return ok({ salon: rows[0] });
    }

    const { rows } = await query(
      `INSERT INTO salones (sede, nombre, planta, capacidad, identificador, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (sede, nombre) DO UPDATE SET
         planta = EXCLUDED.planta,
         capacidad = EXCLUDED.capacidad,
         identificador = EXCLUDED.identificador,
         observaciones = EXCLUDED.observaciones
       RETURNING id, sede, nombre, planta, capacidad, identificador, observaciones`,
      [sede, nombre, planta, capacidad, identificador, observaciones]
    );
    return ok({ salon: rows[0] }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

async function DELETE(req) {
  try {
    requireAdmin();
    const body = await req.json();
    if (!body.id) {
      const err = new Error("Se requiere id.");
      err.status = 400;
      throw err;
    }
    await query("DELETE FROM salones WHERE id = $1", [body.id]);
    return ok({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET, POST, DELETE };
