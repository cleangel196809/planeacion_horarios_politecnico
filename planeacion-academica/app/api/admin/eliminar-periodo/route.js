const { query, withTransaction } = require("@/lib/db");
const { requireAdmin } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

// Elimina TODOS los datos de un período (catálogo, planeación con sus
// horarios y el archivo de estudiantes cargado para ese período). Pensada
// para limpiar un ciclo cargado por error o ya cerrado hace tiempo, antes de
// empezar el siguiente, sin tener que borrar toda la base de datos.
//
// Reglas de integridad (las "normas del CRUD" para un borrado seguro):
// - Solo admin puede ejecutarla (no secretaría académica ni decano/coordinador).
// - El período y el texto de confirmación deben coincidir EXACTAMENTE: es la
//   forma de asegurarnos de que quien borra sabe qué está borrando y no fue
//   un clic accidental (además del diálogo de confirmación en el navegador).
// - Corre dentro de una sola transacción (BEGIN/COMMIT vía withTransaction):
//   si algo falla a mitad de camino, no queda la base de datos en un estado
//   a medias — o se borra todo, o no se borra nada.
// - Borra explícitamente en el orden hijo -> padre (horarios -> planeación ->
//   catálogo) en vez de dejarlo solo en manos del ON DELETE CASCADE del
//   esquema, así se puede contar e informar cuántas filas se borraron de
//   cada tabla.
async function DELETE(req) {
  try {
    requireAdmin();
    const body = await req.json();
    const periodo = String(body.periodo || "").trim();
    const confirmacion = String(body.confirmacion || "").trim();

    if (!periodo) {
      const err = new Error("Debes indicar el período a eliminar.");
      err.status = 400;
      throw err;
    }
    if (confirmacion !== periodo) {
      const err = new Error(
        "El texto de confirmación no coincide con el período. Escríbelo exactamente igual."
      );
      err.status = 400;
      throw err;
    }

    const { rows: existe } = await query(
      `SELECT
         (SELECT COUNT(*) FROM catalogo WHERE periodo = $1)::int AS catalogo,
         (SELECT COUNT(*) FROM estudiantes WHERE periodo = $1)::int AS estudiantes`,
      [periodo]
    );
    if (existe[0].catalogo === 0 && existe[0].estudiantes === 0) {
      const err = new Error(`No se encontraron datos del período "${periodo}".`);
      err.status = 404;
      throw err;
    }

    const eliminado = await withTransaction(async (client) => {
      const { rowCount: horarios } = await client.query(
        `DELETE FROM planeacion_horario
         WHERE planeacion_id IN (SELECT id FROM planeacion WHERE periodo = $1)`,
        [periodo]
      );
      const { rowCount: planeacion } = await client.query(
        "DELETE FROM planeacion WHERE periodo = $1",
        [periodo]
      );
      const { rowCount: catalogo } = await client.query(
        "DELETE FROM catalogo WHERE periodo = $1",
        [periodo]
      );
      const { rowCount: estudiantes } = await client.query(
        "DELETE FROM estudiantes WHERE periodo = $1",
        [periodo]
      );
      return { horarios, planeacion, catalogo, estudiantes };
    });

    return ok({ periodo, eliminado });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { DELETE };
