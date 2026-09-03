const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const argon2 = require("@node-rs/argon2");
const jwt = require("jsonwebtoken");

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos

function generarTokenRecuperacion() {
  return {
    token: crypto.randomBytes(32).toString("hex"),
    expira: new Date(Date.now() + RESET_TOKEN_TTL_MS)
  };
}

const COOKIE_NAME = "planeacion_session";
const TOKEN_TTL = "12h";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Falta la variable de entorno JWT_SECRET.");
  }
  return secret;
}

// Migración de hashing: todas las contraseñas NUEVAS (usuarios creados,
// cambios/reseteos de contraseña) se guardan con Argon2id — el mismo
// algoritmo que ya usa SIIHAPI, necesario para el login único entre los
// tres servicios (ver ESQUEMA_UNIFICADO_NOTAS.md sección 2).
//
// Las cuentas que ya existían antes de esta migración siguen teniendo su
// hash bcrypt guardado en la base — verifyPassword detecta el formato y
// verifica con el algoritmo correcto en cada caso, así que ningún login
// existente se rompe. Esas cuentas se renuevan a Argon2id automáticamente
// la próxima vez que inicien sesión con éxito (ver app/api/auth/login/route.js).
async function hashPassword(password) {
  return argon2.hash(password);
}

async function verifyPassword(password, hash) {
  if (typeof hash === "string" && hash.startsWith("$argon2")) {
    return argon2.verify(hash, password);
  }
  return bcrypt.compare(password, hash);
}

function esHashAntiguo(hash) {
  return typeof hash === "string" && !hash.startsWith("$argon2");
}

function signSession(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      rol: user.rol,
      nombre: user.nombre,
      facultad: user.facultad || null
    },
    getSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

function verifySession(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch (err) {
    return null;
  }
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  esHashAntiguo,
  signSession,
  verifySession,
  generarTokenRecuperacion
};
