const { Pool } = require("pg");

let pool;

function getPool() {
  if (!pool) {
    // La integración de Neon/Supabase con Vercel a veces nombra la variable
    // distinto según cómo se conecte (DATABASE_URL, POSTGRES_URL, etc.).
    // Se aceptan los nombres más comunes para evitar un despliegue roto por
    // un simple nombre de variable.
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.POSTGRES_PRISMA_URL;
    if (!connectionString) {
      throw new Error(
        "Falta la variable de entorno DATABASE_URL (cadena de conexión a PostgreSQL)."
      );
    }
    const esLocal = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: esLocal ? undefined : { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}

// Ejecuta una función dentro de una transacción, con COMMIT/ROLLBACK automático.
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getPool, query, withTransaction };
