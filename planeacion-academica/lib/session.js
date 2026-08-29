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

// El coordinador es un rol de SOLO CONSULTA sobre los datos de su facultad:
// puede ver el catálogo, la planeación y descargar el Excel, pero no puede
// crear, editar ni eliminar nada. La secretaría académica sí puede crear,
// editar y eliminar grupos de CUALQUIER facultad (igual que el admin cuando
// entra "como decano" de una facultad), porque su función incluye armar la
// programación de grupos. Usar esto (en vez de requireUser) en toda ruta que
// cree/actualice/borre catálogo o planeación.
function requireEditor() {
  const user = requireUser();
  if (user.rol !== "admin" && user.rol !== "decano" && user.rol !== "secretaria_academica") {
    const err = new Error("Tu rol solo tiene permiso de consulta.");
    err.status = 403;
    throw err;
  }
  return user;
}

// La secretaría académica administra datos maestros de infraestructura
// (sedes, salones) y el archivo base de estudiantes, igual que el admin.
// Usar esto en vez de requireAdmin en esas rutas.
function requireStaff() {
  const user = requireUser();
  if (user.rol !== "admin" && user.rol !== "secretaria_academica") {
    const err = new Error("Se requiere rol de administrador o de secretaría académica.");
    err.status = 403;
    throw err;
  }
  return user;
}

module.exports = { getCurrentUser, requireUser, requireAdmin, requireEditor, requireStaff };
