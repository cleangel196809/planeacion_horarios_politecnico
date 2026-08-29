const { withTransaction } = require("@/lib/db");
const { requireStaff } = require("@/lib/session");
const { parseSalonesExcel } = require("@/lib/excelImport");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function POST(req) {
  try {
    requireStaff();

    const formData = await req.formData();
    const file = formData.get("archivo");
    if (!file || typeof file === "string") {
      const err = new Error("Debes adjuntar el archivo Excel de salones.");
      err.status = 400;
      throw err;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { salones, sedes, hojasIgnoradas } = await parseSalonesExcel(buffer);

    const insertados = await withTransaction(async (client) => {
      let n = 0;
      for (const s of salones) {
        await client.query(
          `INSERT INTO salones (sede, nombre, planta, capacidad, identificador, observaciones)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (sede, nombre) DO UPDATE SET
             planta = EXCLUDED.planta,
             capacidad = EXCLUDED.capacidad,
             identificador = EXCLUDED.identificador,
             observaciones = EXCLUDED.observaciones`,
          [s.sede, s.nombre, s.planta, s.capacidad, s.identificador, s.observaciones]
        );
        n++;
      }
      return n;
    });

    return ok({
      success: true,
      salonesCargados: insertados,
      sedes,
      hojasIgnoradas
    });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { POST };
