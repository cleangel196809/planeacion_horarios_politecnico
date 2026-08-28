const { withTransaction } = require("@/lib/db");
const { requireAdmin } = require("@/lib/session");
const { parseCatalogoRealExcel } = require("@/lib/excelImport");
const { hashPassword } = require("@/lib/auth");
const { jsonError, ok } = require("@/lib/apiHelpers");

// Contraseña temporal legible (sin caracteres ambiguos como 0/O, 1/l/I).
function generarPassword() {
  const alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 10; i++) {
    pass += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return pass;
}

function slugUsuario(facultad) {
  const normalizado = String(facultad)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return `decano.${normalizado}`;
}

async function POST(req) {
  try {
    requireAdmin();

    const formData = await req.formData();
    const file = formData.get("archivo");
    const periodo = String(formData.get("periodo") || "").trim();

    if (!file || typeof file === "string") {
      const err = new Error("Debes adjuntar el archivo de carreras y materias.");
      err.status = 400;
      throw err;
    }
    if (!periodo) {
      const err = new Error("Debes indicar el período (por ejemplo 2026-3T).");
      err.status = 400;
      throw err;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { catalogo, facultades, jornadasNoReconocidas } = await parseCatalogoRealExcel(buffer);

    const result = await withTransaction(async (client) => {
      let catalogoInsertados = 0;
      for (const item of catalogo) {
        await client.query(
          `INSERT INTO catalogo (periodo, llave, codigo, facultad, programa, plan, asignatura, ciclo, creditos, grupo, jornada, sede)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (periodo, llave, plan, ciclo) DO UPDATE SET
             codigo = EXCLUDED.codigo,
             facultad = EXCLUDED.facultad,
             programa = EXCLUDED.programa,
             plan = EXCLUDED.plan,
             asignatura = EXCLUDED.asignatura,
             ciclo = EXCLUDED.ciclo,
             creditos = EXCLUDED.creditos,
             grupo = EXCLUDED.grupo,
             jornada = EXCLUDED.jornada,
             sede = EXCLUDED.sede`,
          [
            periodo,
            item.llave,
            item.codigo,
            item.facultad,
            item.programa,
            item.plan,
            item.asignatura,
            item.ciclo,
            item.creditos,
            item.grupo,
            item.jornada,
            item.sede
          ]
        );
        catalogoInsertados++;
      }

      // Un decano por cada facultad encontrada en el archivo, solo si esa
      // facultad todavía no tiene un usuario decano asignado.
      const nuevosDecanos = [];
      for (const facultad of facultades) {
        const existente = await client.query(
          "SELECT id FROM usuarios WHERE rol = 'decano' AND facultad = $1",
          [facultad]
        );
        if (existente.rows.length > 0) continue;

        const username = slugUsuario(facultad);
        const usernameOcupado = await client.query("SELECT id FROM usuarios WHERE username = $1", [
          username
        ]);
        if (usernameOcupado.rows.length > 0) continue; // ya hay alguien con ese usuario; no se toca

        const password = generarPassword();
        const passwordHash = await hashPassword(password);
        await client.query(
          `INSERT INTO usuarios (username, password_hash, rol, nombre, facultad, debe_cambiar_password)
           VALUES ($1,$2,'decano',$3,$4,TRUE)`,
          [username, passwordHash, `Decano(a) de ${facultad}`, facultad]
        );
        nuevosDecanos.push({ facultad, username, password });
      }

      return { catalogoInsertados, nuevosDecanos };
    });

    return ok({
      success: true,
      periodo,
      asignaturasCargadas: result.catalogoInsertados,
      facultades,
      jornadasNoReconocidas,
      nuevosDecanos: result.nuevosDecanos
    });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { POST };
