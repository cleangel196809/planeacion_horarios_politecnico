const { query } = require("@/lib/db");
const { requireAdmin } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function GET(req) {
  try {
    requireAdmin();
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo");
    if (!periodo) {
      const err = new Error("Debes indicar el período.");
      err.status = 400;
      throw err;
    }

    const { rows: catalogoPorFacultad } = await query(
      `SELECT facultad, COUNT(*)::int AS total_catalogo
       FROM catalogo WHERE periodo = $1 GROUP BY facultad`,
      [periodo]
    );

    const { rows: planeacionPorFacultad } = await query(
      `SELECT facultad,
              COUNT(*)::int AS total_grupos,
              COUNT(*) FILTER (WHERE estado = 'Reportado')::int AS reportados,
              COUNT(*) FILTER (WHERE estado = 'Sin reportar')::int AS sin_reportar,
              COUNT(*) FILTER (WHERE estado = 'No aplica')::int AS no_aplica
       FROM planeacion WHERE periodo = $1 GROUP BY facultad`,
      [periodo]
    );

    const facultades = new Map();
    for (const row of catalogoPorFacultad) {
      facultades.set(row.facultad, {
        facultad: row.facultad,
        totalCatalogo: row.total_catalogo,
        totalGrupos: 0,
        reportados: 0,
        sinReportar: 0,
        noAplica: 0
      });
    }
    for (const row of planeacionPorFacultad) {
      const entry = facultades.get(row.facultad) || {
        facultad: row.facultad,
        totalCatalogo: 0,
        totalGrupos: 0,
        reportados: 0,
        sinReportar: 0,
        noAplica: 0
      };
      entry.totalGrupos = row.total_grupos;
      entry.reportados = row.reportados;
      entry.sinReportar = row.sin_reportar;
      entry.noAplica = row.no_aplica;
      facultades.set(row.facultad, entry);
    }

    return ok({ periodo, facultades: [...facultades.values()] });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
