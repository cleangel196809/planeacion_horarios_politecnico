-- Migración idempotente: solo es necesaria si ya habías ejecutado db/schema.sql
-- ANTES de que existiera la recuperación de contraseña por correo. Si vas a
-- crear la base de datos desde cero, no necesitas correr este archivo: ya
-- está incluido en db/schema.sql.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expira TIMESTAMPTZ;
