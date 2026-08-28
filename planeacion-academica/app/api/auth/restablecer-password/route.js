const { query } = require("@/lib/db");
const { hashPassword } = require("@/lib/auth");
const { ok, jsonError } = require("@/lib/apiHelpers");

async function POST(req) {
  try {
    const { token, passwordNueva } = await req.json();
    if (!token || !passwordNueva || passwordNueva.length < 6) {
      const err = new Error("Enlace inválido o contraseña demasiado corta (mínimo 6 caracteres).");
      err.status = 400;
      throw err;
    }

    const { rows } = await query(
      "SELECT * FROM usuarios WHERE reset_token = $1 AND reset_token_expira > now() AND activo = TRUE",
      [token]
    );
    const user = rows[0];
    if (!user) {
      const err = new Error("El enlace no es válido o ya expiró. Solicita uno nuevo.");
      err.status = 400;
      throw err;
    }

    const passwordHash = await hashPassword(passwordNueva);
    await query(
      `UPDATE usuarios
       SET password_hash = $1, debe_cambiar_password = FALSE, reset_token = NULL, reset_token_expira = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    return ok({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { POST };
