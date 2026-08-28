-- Migración idempotente: agrega el rol "coordinador" (solo consulta, atado a
-- una facultad como el decano) al CHECK de usuarios.rol. Corre esto una sola
-- vez sobre tu base de datos (Neon) si ya habías ejecutado db/schema.sql
-- antes de que existiera este rol.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('admin', 'decano', 'coordinador'));
