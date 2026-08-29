-- Migración idempotente: agrega el rol "secretaria_academica" (gestiona
-- sedes, salones, grupos de todas las facultades y el archivo base de
-- estudiantes) y las tablas nuevas que necesita. Corre esto una sola vez
-- sobre tu base de datos (Neon) si ya habías ejecutado db/schema.sql antes
-- de que existiera este rol.

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('admin', 'decano', 'coordinador', 'secretaria_academica'));

-- Catálogo de sedes (ver comentario en db/schema.sql).
CREATE TABLE IF NOT EXISTS sedes (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL UNIQUE,
  activa     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sedes (nombre) VALUES
  ('CALLE 73'), ('CALLE 80'), ('NORTE'), ('SUR'), ('ASISTIDA POR TECNOLOGIA')
ON CONFLICT (nombre) DO NOTHING;

-- Archivo base de estudiantes (ver comentario en db/schema.sql).
CREATE TABLE IF NOT EXISTS estudiantes (
  id              SERIAL PRIMARY KEY,
  periodo         TEXT NOT NULL,
  documento       TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  facultad        TEXT,
  programa        TEXT,
  plan            TEXT,
  ciclo           TEXT,
  asignatura      TEXT,
  grupo           TEXT,
  correo          TEXT,
  telefono        TEXT,
  cargado_por     INTEGER REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (periodo, documento, asignatura, grupo)
);

CREATE INDEX IF NOT EXISTS idx_estudiantes_periodo_facultad ON estudiantes (periodo, facultad);
