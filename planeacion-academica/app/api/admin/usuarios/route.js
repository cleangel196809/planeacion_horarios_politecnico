const { query } = require("@/lib/db");
const { requireAdmin } = require("@/lib/session");
const { hashPassword } = require("@/lib/auth");
const { jsonError, ok } = require("@/lib/apiHelpers");

async function GET() {
  try {
    requireAdmin();
    const { rows } = await query(
      `SELECT id, username, nombre, rol, facultad, email, activo, debe_cambiar_password, created_at
       FROM usuarios ORDER BY rol, facultad NULLS FIRST, nombre`
    );
    return ok({ usuarios: rows });
  } catch (err) {
    return jsonError(err);
  }
}

const ROLES_ASIGNABLES = ["decano", "coordinador"];

async function POST(req) {
  try {
    requireAdmin();
    const { username, nombre, facultad, password, email, rol } = await req.json();
    if (!username || !nombre || !facultad || !password) {
      const err = new Error("Usuario, nombre, facultad y contraseña son obligatorios.");
      err.status = 400;
      throw err;
    }
    if (password.length < 6) {
      const err = new Error("La contraseña debe tener al menos 6 caracteres.");
      err.status = 400;
      throw err;
    }

    // Solo el admin puede crear decano o coordinador (nunca otro admin desde
    // aquí); por defecto se crea decano si no se especifica, para no romper
    // integraciones existentes que no envíen "rol".
    const rolFinal = ROLES_ASIGNABLES.includes(rol) ? rol : "decano";

    const cleanUsername = String(username).trim().toLowerCase();
    const existing = await query("SELECT id FROM usuarios WHERE username = $1", [cleanUsername]);
    if (existing.rows.length > 0) {
      const err = new Error("Ya existe un usuario con ese nombre de usuario.");
      err.status = 409;
      throw err;
    }

    const passwordHash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO usuarios (username, password_hash, rol, nombre, facultad, email, debe_cambiar_password)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, username, nombre, rol, facultad, email, activo`,
      [cleanUsername, passwordHash, rolFinal, nombre, facultad, email ? String(email).trim() : null]
    );

    return ok({ usuario: rows[0] }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

async function PATCH(req) {
  try {
    requireAdmin();
    const body = await req.json();
    const { id } = body;
    if (!id) {
      const err = new Error("Se requiere id.");
      err.status = 400;
      throw err;
    }

    if (typeof body.activo === "boolean") {
      await query("UPDATE usuarios SET activo = $1 WHERE id = $2 AND rol IN ('decano', 'coordinador')", [
        body.activo,
        id
      ]);
    }
    if (typeof body.email === "string") {
      await query("UPDATE usuarios SET email = $1 WHERE id = $2 AND rol IN ('decano', 'coordinador')", [
        body.email.trim() || null,
        id
      ]);
    }

    return ok({ success: true });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET, POST, PATCH };
