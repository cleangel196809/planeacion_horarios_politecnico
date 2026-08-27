const { query } = require("@/lib/db");
const { requireUser } = require("@/lib/session");
const { verifyPassword, hashPassword } = require("@/lib/auth");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function POST(req) {
  try {
    const user = requireUser();
    const { passwordActual, passwordNueva } = await req.json();
    if (!passwordActual || !passwordNueva || passwordNueva.length < 6) {
      const err = new Error("La nueva contraseña debe tener al menos 6 caracteres.");
      err.status = 400;
      throw err;
    }

    const { rows } = await query("SELECT * FROM usuarios WHERE id = $1", [user.id]);
    const dbUser = rows[0];
    const validPassword = await verifyPassword(passwordActual, dbUser.password_hash);
    if (!validPassword) {
      const err = new Error("La contraseña actual no es correcta.");
      err.status = 401;
      throw err;
    }

    const newHash = await hashPassword(passwordNueva);
    await query(
      "UPDATE usuarios SET password_hash = $1, debe_cambiar_password = FALSE WHERE id = $2",
      [newHash, user.id]
    );

    return ok({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { POST };
