const { requireAdmin } = require("@/lib/session");
const { generarBackupSQL } = require("@/lib/dbBackup");
const { jsonError } = require("@/lib/apiHelpers");

// Descarga una copia de seguridad completa de la base de datos (todas las
// tablas, ver lib/dbBackup.js) como un archivo .sql listo para pegar en el
// editor SQL de Neon si algún día hay que restaurar. Solo el admin puede
// generarla, porque incluye datos de todos los usuarios (incluida la
// contraseña cifrada) y de todas las facultades.
async function GET() {
  try {
    requireAdmin();
    const { sql } = await generarBackupSQL();
    const buffer = Buffer.from(sql, "utf-8");
    const fecha = new Date().toISOString().slice(0, 10);

    // Content-Length explícito: ver nota en /api/planeacion/exportar sobre
    // por qué esto evita el aviso "Necesita permiso para descargarse" en Chrome.
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="backup_planeacion_academica_${fecha}.sql"`,
        "Content-Length": String(buffer.length)
      }
    });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
