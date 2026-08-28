-- Migración idempotente para la carga del archivo real "carreras y materias":
-- agrega a catalogo las columnas GRUPO, JORNADA y SEDE que trae ese archivo,
-- para que el decano pueda revisarlas/editarlas y confirmarlas antes de que
-- se conviertan en un grupo de planeación (y por lo tanto aparezcan en el
-- Excel entregable). Si ya ejecutaste db/schema.sql antes de esta fecha,
-- corre este archivo una sola vez sobre tu base de datos (Neon).
ALTER TABLE catalogo ADD COLUMN IF NOT EXISTS grupo   TEXT;
ALTER TABLE catalogo ADD COLUMN IF NOT EXISTS jornada TEXT; -- DIURNA | ESPECIAL | NOCHE | SABADO | VIRTUAL
ALTER TABLE catalogo ADD COLUMN IF NOT EXISTS sede    TEXT; -- CALLE 73 | NORTE | SUR | ASISTIDA POR TECNOLOGIA
