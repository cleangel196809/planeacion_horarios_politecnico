-- Esquema de base de datos para "Planeación Académica"
-- Ejecutar una sola vez sobre la base de datos PostgreSQL (Neon, Supabase, etc.)

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('admin', 'decano')),
  nombre        TEXT NOT NULL,
  facultad      TEXT,              -- NULL para admin; obligatorio para decano
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  debe_cambiar_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catálogo base de asignaturas ofertables, cargado por el admin desde el Excel
-- de cada ciclo (columnas fijas: FACULTAD, PROGRAMA, PLAN, ASIGNATURA, CICLO, CREDITOS).
CREATE TABLE IF NOT EXISTS catalogo (
  id         SERIAL PRIMARY KEY,
  periodo    TEXT NOT NULL,
  llave      TEXT NOT NULL,
  codigo     TEXT,
  facultad   TEXT NOT NULL,
  programa   TEXT NOT NULL,
  plan       TEXT,
  asignatura TEXT NOT NULL,
  ciclo      TEXT,
  creditos   NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- LLAVE por sí sola no siempre es única en los datos reales (una misma
  -- asignatura puede reutilizar el mismo código bajo dos planes/ciclos
  -- distintos), así que la clave de importación incluye plan y ciclo.
  UNIQUE (periodo, llave, plan, ciclo)
);

CREATE INDEX IF NOT EXISTS idx_catalogo_periodo_facultad ON catalogo (periodo, facultad);

-- Catálogo opcional de docentes (para autocompletar en el formulario).
CREATE TABLE IF NOT EXISTS docentes (
  documento             TEXT PRIMARY KEY,
  nombre_completo       TEXT NOT NULL,
  correo_institucional  TEXT,
  facultad              TEXT
);

-- Un registro de planeacion = un grupo/oferta concreta de una asignatura del
-- catálogo, diligenciado por el decano de la facultad correspondiente.
CREATE TABLE IF NOT EXISTS planeacion (
  id                       SERIAL PRIMARY KEY,
  catalogo_id              INTEGER NOT NULL REFERENCES catalogo(id) ON DELETE CASCADE,
  periodo                  TEXT NOT NULL,
  facultad                 TEXT NOT NULL,
  grupo                    TEXT,
  codigo_moodle            TEXT,
  codigo_teams             TEXT,
  enlace_teams             TEXT,
  estado                   TEXT NOT NULL DEFAULT 'Sin reportar', -- Sin reportar | Reportado | No aplica
  modalidad                TEXT,   -- Sede: CALLE 73 | NORTE | SUR | ASISTIDA POR TECNOLOGIA
  jornada                  TEXT,   -- DIURNA | ESPECIAL | NOCHE | SABADO
  capacidad                INTEGER,
  documento_docente        TEXT,
  nombre_docente           TEXT,
  correo_institucional     TEXT,
  codigo_moodle_a_duplicar TEXT,
  observaciones            TEXT,
  creado_por               INTEGER REFERENCES usuarios(id),
  modificado_por           INTEGER REFERENCES usuarios(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planeacion_periodo_facultad ON planeacion (periodo, facultad);
CREATE INDEX IF NOT EXISTS idx_planeacion_catalogo ON planeacion (catalogo_id);

-- Días/horas/salón de un grupo. Un grupo puede tener varias filas (una por
-- día de la semana en que se dicta). Al exportar, se ubican en las columnas
-- LUN/MAR/MCL/JUE/VIE de la plantilla en el orden en que fueron capturadas
-- (ver README para el detalle de por qué SABADO también cabe en ese esquema).
CREATE TABLE IF NOT EXISTS planeacion_horario (
  id             SERIAL PRIMARY KEY,
  planeacion_id  INTEGER NOT NULL REFERENCES planeacion(id) ON DELETE CASCADE,
  dia            TEXT NOT NULL CHECK (dia IN ('LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO')),
  hora_inicio    TEXT,  -- formato 'HH:MM'
  hora_fin       TEXT,
  salon          TEXT,
  orden          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_horario_planeacion ON planeacion_horario (planeacion_id);
