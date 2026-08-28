// Crea (o actualiza la contraseña de) el usuario administrador inicial.
// Uso: DATABASE_URL=... ADMIN_USERNAME=admin ADMIN_PASSWORD=... node scripts/seed.js
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL;
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const nombre = process.env.ADMIN_NOMBRE || "Administrador";

  if (!connectionString) throw new Error("Falta DATABASE_URL");
  if (!password) throw new Error("Falta ADMIN_PASSWORD");

  const esLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: esLocal ? undefined : { rejectUnauthorized: false }
  });

  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO usuarios (username, password_hash, rol, nombre, facultad, debe_cambiar_password)
     VALUES ($1, $2, 'admin', $3, NULL, FALSE)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, activo = TRUE`,
    [username, hash, nombre]
  );

  console.log(`Usuario admin "${username}" listo.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
