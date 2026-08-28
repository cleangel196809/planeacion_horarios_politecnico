const { NextResponse } = require("next/server");

function jsonError(err) {
  const status = err.status || 500;
  const message = status === 500 ? "Ocurrió un error inesperado. Intenta de nuevo." : err.message;
  if (status === 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  return NextResponse.json({ error: message }, { status });
}

function ok(data, init) {
  return NextResponse.json(data, init);
}

module.exports = { jsonError, ok };
