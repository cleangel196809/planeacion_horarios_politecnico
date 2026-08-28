const { query } = require("@/lib/db");
const { requireUser } = require("@/lib/session");
const { buildPlaneacionExcel } = require("@/lib/excelExport");
const { jsonError } = require("@/lib/apiHelpers");

// Permite a un decano descargar únicamente el avance de su propia facultad.
async function GET(req) {
  try {
    const user = requireUser();
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo");
    if (!periodo) {
      const err = new Error("Debes indicar el período.");
      err.status = 400;
      throw err;
    }
    const facultad =
      user.rol === "decano" || user.rol === "coordinador"
        ? user.facultad
        : searchParams.get("facultad");
    if (!facultad) {
      const err = new Error("Debes indicar la facultad a exportar.");
      err.status = 400;
      throw err;
    }

    const { rows: planeacionRows } = await query(
      `SELECT p.*, c.llave, c.codigo, c.facultad AS catalogo_facultad, c.programa, c.plan,
              c.asignatura, c.ciclo, c.creditos, u.nombre AS modificado_por_nombre
       FROM planeacion p
       JOIN catalogo c ON c.id = p.catalogo_id
       LEFT JOIN usuarios u ON u.id = p.modificado_por
       WHERE p.periodo = $1 AND p.facultad = $2
       ORDER BY c.programa, c.asignatura, p.grupo`,
      [periodo, facultad]
    );

    const ids = planeacionRows.map((r) => r.id);
    let horariosPorPlaneacion = new Map();
    if (ids.length > 0) {
      const { rows: horarios } = await query(
        `SELECT * FROM planeacion_horario WHERE planeacion_id = ANY($1::int[]) ORDER BY planeacion_id, orden`,
        [ids]
      );
      for (const h of horarios) {
        const list = horariosPorPlaneacion.get(h.planeacion_id) || [];
        list.push(h);
        horariosPorPlaneacion.set(h.planeacion_id, list);
      }
    }

    const rowsForExcel = planeacionRows.map((r) => ({
      ...r,
      facultad: r.catalogo_facultad,
      horarios: horariosPorPlaneacion.get(r.id) || []
    }));

    const buffer = await buildPlaneacionExcel(rowsForExcel, []);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="PLANEACION_${facultad}_${periodo}.xlsx"`
      }
    });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
