const { query } = require("@/lib/db");
const { requireStaff } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

const LIMITE = 500;

async function GET(req) {
  try {
    requireStaff();
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo");
    const facultad = searchParams.get("facultad");
    const q = (searchParams.get("q") || "").trim();

    if (!periodo) {
      const err = new Error("Debes indicar el período.");
      err.status = 400;
      throw err;
    }

    const params = [periodo];
    const condiciones = ["periodo = $1"];
    if (facultad) {
      params.push(facultad);
      condiciones.push(`facultad = $${params.length}`);
    }
    if (q.length >= 2) {
      params.push(`%${q}%`);
      condiciones.push(`(nombre_completo ILIKE $${params.length} OR documento ILIKE $${params.length})`);
    }

    const { rows: totalRows } = await query(
      `SELECT COUNT(*)::int AS total FROM estudiantes WHERE ${condiciones.join(" AND ")}`,
      params
    );

    const { rows } = await query(
      `SELECT * FROM estudiantes WHERE ${condiciones.join(" AND ")}
       ORDER BY nombre_completo LIMIT ${LIMITE}`,
      params
    );

    return ok({ estudiantes: rows, total: totalRows[0]?.total || 0, limite: LIMITE });
  } catch (err) {
    return jsonError(err);
  }
}

async function DELETE(req) {
  try {
    requireStaff();
    const body = await req.json();

    // Borrado masivo: todo el archivo cargado para un período (y, si se
    // indica, una facultad), para poder limpiar una carga hecha por error
    // antes de volver a subir el archivo correcto.
    if (body.periodo) {
      const params = [body.periodo];
      let where = "periodo = $1";
      if (body.facultad) {
        params.push(body.facultad);
        where += " AND facultad = $2";
      }
      const { rowCount } = await query(`DELETE FROM estudiantes WHERE ${where}`, params);
      return ok({ success: true, eliminados: rowCount });
    }

    if (!body.id) {
      const err = new Error("Se requiere id, o periodo (y opcionalmente facultad).");
      err.status = 400;
      throw err;
    }
    await query("DELETE FROM estudiantes WHERE id = $1", [body.id]);
    return ok({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET, DELETE };
