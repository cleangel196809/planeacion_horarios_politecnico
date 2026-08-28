const crypto = require("crypto");
const bcrypt = require("bcryptjs");
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

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
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
  signSession,
  verifySession,
  generarTokenRecuperacion
};
