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
// Formato de almacenamiento (IMPORTANTE, no es el PHC string "pelado"):
// se guarda como "argon2$" + <cadena PHC estándar>, es decir exactamente
// el formato que produce el hasher Argon2 INCORPORADO de Django
// (django.contrib.auth.hashers.Argon2PasswordHasher). Se eligió ese
// formato -y no el PHC estándar sin prefijo- porque así SIIHAPI no
// necesita ningún hasher personalizado: puede usar directo el hasher
// que Django ya trae, sin escribir código nuevo. Se probó cruzado
// (hash generado aquí en Node, verificado en Python con argon2-cffi
// exactamente como lo hace Django) y funciona.
//
// Las cuentas que ya existían antes de esta migración siguen teniendo su
// hash bcrypt guardado en la base — verifyPassword detecta el formato y
// verifica con el algoritmo correcto en cada caso, así que ningún login
// existente se rompe. Esas cuentas se renuevan a Argon2id automáticamente
// la próxima vez que inicien sesión con éxito (ver app/api/auth/login/route.js).
async function hashPassword(password) {
  const phc = await argon2.hash(password); // "$argon2id$v=19$m=...,t=...,p=...$salt$hash"
  return "argon2" + phc; // "argon2$argon2id$v=19$...$salt$hash" (formato Django)
}

async function verifyPassword(password, hash) {
  if (typeof hash === "string" && hash.startsWith("argon2$argon2id")) {
    const phc = hash.slice("argon2".length); // vuelve a "$argon2id$..."
    return argon2.verify(phc, password);
  }
  return bcrypt.compare(password, hash);
}

function esHashAntiguo(hash) {
  return typeof hash === "string" && !hash.startsWith("argon2$argon2id");
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
