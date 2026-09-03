const { cookies } = require("next/headers");
const { query } = require("@/lib/db");
const { verifyPassword, hashPassword, esHashAntiguo, signSession, COOKIE_NAME } = require("@/lib/auth");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function POST(req) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      const err = new Error("Usuario y contraseña son obligatorios.");
      err.status = 400;
      throw err;
    }

    const { rows } = await query(
      "SELECT * FROM usuarios WHERE username = $1 AND activo = TRUE",
      [String(username).trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user) {
      const err = new Error("Usuario o contraseña incorrectos.");
      err.status = 401;
      throw err;
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      const err = new Error("Usuario o contraseña incorrectos.");
      err.status = 401;
      throw err;
    }

    // Renovación silenciosa: si la cuenta todavía tenía un hash bcrypt (de
    // antes de la migración a Argon2id), se reemplaza por uno Argon2id
    // ahora que ya sabemos que la contraseña en texto plano es correcta.
    if (esHashAntiguo(user.password_hash)) {
      const nuevoHash = await hashPassword(password);
      await query("UPDATE usuarios SET password_hash = $1 WHERE id = $2", [
        nuevoHash,
        user.id
      ]);
    }

    const token = signSession(user);
    cookies().set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return ok({
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
        facultad: user.facultad,
        debeCambiarPassword: user.debe_cambiar_password
      }
    });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { POST };
