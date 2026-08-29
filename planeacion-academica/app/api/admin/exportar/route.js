const { query } = require("@/lib/db");
const { requireAdmin } = require("@/lib/session");
const { buildPlaneacionExcel } = require("@/lib/excelExport");
const { jsonError } = require("@/lib/apiHelpers");

async function GET(req) {
  try {
    requireAdmin();
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo");
    if (!periodo) {
      const err = new Error("Debes indicar el período a exportar.");
      err.status = 400;
      throw err;
    }

    const { rows: planeacionRows } = await query(
      `SELECT p.*, c.llave, c.codigo, c.facultad AS catalogo_facultad, c.programa, c.plan,
              c.asignatura, c.ciclo, c.creditos, u.nombre AS modificado_por_nombre
       FROM planeacion p
       JOIN catalogo c ON c.id = p.catalogo_id
       LEFT JOIN usuarios u ON u.id = p.modificado_por
       WHERE p.periodo = $1
       ORDER BY c.facultad, c.programa, c.asignatura, p.grupo`,
      [periodo]
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

    const { rows: docentesRows } = await query("SELECT * FROM docentes ORDER BY nombre_completo");

    const buffer = await buildPlaneacionExcel(rowsForExcel, docentesRows);

    // Content-Length explícito: ver nota en /api/planeacion/exportar sobre
    // por qué esto evita el aviso "Necesita permiso para descargarse" en Chrome.
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="PLANEACION_${periodo}.xlsx"`,
        "Content-Length": String(buffer.length)
      }
    });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
