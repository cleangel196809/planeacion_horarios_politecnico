const { cookies } = require("next/headers");
const { COOKIE_NAME, verifySession } = require("./auth");

// Lee y valida la sesión actual a partir de la cookie httpOnly.
// Devuelve null si no hay sesión o el token es inválido/expiró.
function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

function requireUser() {
  const user = getCurrentUser();
  if (!user) {
    const err = new Error("No autenticado");
    err.status = 401;
    throw err;
  }
  return user;
}

function requireAdmin() {
  const user = requireUser();
  if (user.rol !== "admin") {
    const err = new Error("Se requiere rol de administrador");
    err.status = 403;
    throw err;
  }
  return user;
}

module.exports = { getCurrentUser, requireUser, requireAdmin };
