const { withTransaction } = require("@/lib/db");
const { requireStaff } = require("@/lib/session");
const { parseEstudiantesExcel } = require("@/lib/excelImport");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function POST(req) {
  try {
    const user = requireStaff();

    const formData = await req.formData();
    const file = formData.get("archivo");
    const periodo = formData.get("periodo");
    if (!file || typeof file === "string") {
      const err = new Error("Debes adjuntar el archivo Excel de estudiantes.");
      err.status = 400;
      throw err;
    }
    if (!periodo) {
      const err = new Error("Debes indicar el período.");
      err.status = 400;
      throw err;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { estudiantes } = await parseEstudiantesExcel(buffer);

    const result = await withTransaction(async (client) => {
      let insertados = 0;
      const facultades = new Set();
      for (const e of estudiantes) {
        await client.query(
          `INSERT INTO estudiantes (
             periodo, documento, nombre_completo, facultad, programa, plan, ciclo,
             asignatura, grupo, correo, telefono, cargado_por
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (periodo, documento, asignatura, grupo) DO UPDATE SET
             nombre_completo = EXCLUDED.nombre_completo,
             facultad = EXCLUDED.facultad,
             programa = EXCLUDED.programa,
             plan = EXCLUDED.plan,
             ciclo = EXCLUDED.ciclo,
             correo = EXCLUDED.correo,
             telefono = EXCLUDED.telefono`,
          [
            periodo,
            e.documento,
            e.nombre_completo,
            e.facultad,
            e.programa,
            e.plan,
            e.ciclo,
            e.asignatura,
            e.grupo,
            e.correo,
            e.telefono,
            user.id
          ]
        );
        insertados++;
        if (e.facultad) facultades.add(e.facultad);
      }
      return { insertados, facultades: [...facultades].sort() };
    });

    return ok({
      success: true,
      estudiantesCargados: result.insertados,
      facultades: result.facultades,
      periodo
    });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { POST };
