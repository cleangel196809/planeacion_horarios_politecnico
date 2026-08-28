const { query } = require("@/lib/db");
const { generarTokenRecuperacion } = require("@/lib/auth");
const { enviarCorreoRecuperacion } = require("@/lib/email");
const { ok, jsonError } = require("@/lib/apiHelpers");

// Calcula la URL pública de la app para armar el enlace del correo.
// Usa NEXT_PUBLIC_APP_URL si la definiste explícitamente; si no, la deduce
// del propio request (funciona igual en local, en un preview de Vercel o en
// producción, sin necesidad de configurar nada).
function baseUrlDesdeRequest(req) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Siempre responde el mismo mensaje genérico, exista o no el usuario, para no
// revelar qué nombres de usuario están registrados.
const MENSAJE_GENERICO = {
  mensaje:
    "Si el usuario existe y tiene un correo registrado, te enviamos un enlace para restablecer la contraseña."
};

async function POST(req) {
  try {
    const { username } = await req.json();
    if (!username) {
      const err = new Error("Debes indicar tu usuario.");
      err.status = 400;
      throw err;
    }

    const { rows } = await query(
      "SELECT * FROM usuarios WHERE username = $1 AND activo = TRUE",
      [String(username).trim().toLowerCase()]
    );
    const user = rows[0];

    // Solo se puede enviar el correo si el usuario existe y tiene un correo
    // asociado (columna email, o el propio username si parece un correo).
    const destino = user?.email || (user?.username?.includes("@") ? user.username : null);

    if (user && destino) {
      const { token, expira } = generarTokenRecuperacion();
      await query(
        "UPDATE usuarios SET reset_token = $1, reset_token_expira = $2 WHERE id = $3",
        [token, expira, user.id]
      );
      const resetUrl = `${baseUrlDesdeRequest(req)}/reset-password?token=${token}`;
      await enviarCorreoRecuperacion({ to: destino, nombre: user.nombre, resetUrl });
    }

    return ok(MENSAJE_GENERICO);
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { POST };
