let pool;

// En Vercel la conexión TCP normal (puerto 5432) a Neon funciona sin
// problema, así que ahí se sigue usando el driver "pg" de siempre. Muchas
// redes locales/institucionales, en cambio, bloquean el puerto 5432 de
// salida (es justo lo que le pasó a este proyecto al intentar correr
// scripts/seed.js en local). Para poder levantar la app en local sin
// depender de que esa red permita el 5432, cuando NO se corre en Vercel se
// usa el driver "serverless" de Neon (@neondatabase/serverless): habla el
// mismo protocolo de Postgres pero lo túnel por WebSocket sobre el puerto
// 443 (HTTPS), que casi ninguna red bloquea. Su Pool/Client tiene la misma
// API que "pg" (pool.query, pool.connect, BEGIN/COMMIT, etc.), así que el
// resto de este archivo y del código que lo usa no necesita cambiar.
function crearPool(connectionString) {
  if (process.env.VERCEL) {
    const { Pool } = require("pg");
    const esLocalhost = /localhost|127\.0\.0\.1/.test(connectionString);
    return new Pool({
      connectionString,
      ssl: esLocalhost ? undefined : { rejectUnauthorized: false }
    });
  }

  const { Pool, neonConfig } = require("@neondatabase/serverless");
  neonConfig.webSocketConstructor = require("ws");
  return new Pool({ connectionString });
}

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
    pool = crearPool(connectionString);
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
