const { withTransaction } = require("@/lib/db");
const { requireAdmin } = require("@/lib/session");
const { parseCatalogoExcel } = require("@/lib/excelImport");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function POST(req) {
  try {
    requireAdmin();

    const formData = await req.formData();
    const file = formData.get("archivo");
    const periodo = String(formData.get("periodo") || "").trim();

    if (!file || typeof file === "string") {
      const err = new Error("Debes adjuntar el archivo Excel base.");
      err.status = 400;
      throw err;
    }
    if (!periodo) {
      const err = new Error("Debes indicar el período (por ejemplo 2026-2T).");
      err.status = 400;
      throw err;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { catalogo, docentes } = await parseCatalogoExcel(buffer);

    const result = await withTransaction(async (client) => {
      let catalogoInsertados = 0;
      for (const item of catalogo) {
        await client.query(
          `INSERT INTO catalogo (periodo, llave, codigo, facultad, programa, plan, asignatura, ciclo, creditos)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (periodo, llave, plan, ciclo) DO UPDATE SET
             codigo = EXCLUDED.codigo,
             facultad = EXCLUDED.facultad,
             programa = EXCLUDED.programa,
             plan = EXCLUDED.plan,
             asignatura = EXCLUDED.asignatura,
             ciclo = EXCLUDED.ciclo,
             creditos = EXCLUDED.creditos`,
          [
            periodo,
            item.llave,
            item.codigo,
            item.facultad,
            item.programa,
            item.plan,
            item.asignatura,
            item.ciclo,
            item.creditos
          ]
        );
        catalogoInsertados++;
      }

      let docentesInsertados = 0;
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
        docentesInsertados++;
      }

      return { catalogoInsertados, docentesInsertados };
    });

    return ok({
      success: true,
      periodo,
      asignaturasCargadas: result.catalogoInsertados,
      docentesCargados: result.docentesInsertados,
      facultades: [...new Set(catalogo.map((c) => c.facultad))]
    });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { POST };
