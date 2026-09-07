const { withTransaction } = require("@/lib/db");
const { requireAdmin } = require("@/lib/session");
const { parseDocentesExcel } = require("@/lib/excelImport");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function POST(req) {
  try {
    requireAdmin();

    const formData = await req.formData();
    const file = formData.get("archivo");
    if (!file || typeof file === "string") {
      const err = new Error("Debes adjuntar el archivo Excel de docentes.");
      err.status = 400;
      throw err;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { docentes } = await parseDocentesExcel(buffer);

    const result = await withTransaction(async (client) => {
      let insertados = 0;
      const facultades = new Set();
      for (const d of docentes) {
        await client.query(
          `INSERT INTO docentes (documento, nombre_completo, correo_institucional, facultad)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (documento) DO UPDATE SET
             nombre_completo = EXCLUDED.nombre_completo,
             correo_institucional = EXCLUDED.correo_institucional,
             facultad = COALESCE(EXCLUDED.facultad, docentes.facultad)`,
          [d.documento, d.nombre_completo, d.correo_institucional, d.facultad]
        );
        insertados++;
        if (d.facultad) facultades.add(d.facultad);
      }
      return { insertados, facultades: [...facultades].sort() };
    });

    return ok({
      success: true,
      docentesCargados: result.insertados,
      facultades: result.facultades
    });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { POST };
