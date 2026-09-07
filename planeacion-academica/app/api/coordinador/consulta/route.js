const { query } = require("@/lib/db");
const { requireUser } = require("@/lib/session");
const { jsonError, ok } = require("@/lib/apiHelpers");

// Adjunta a cada fila (que debe traer .id, el id de planeacion o null/
// undefined si la materia todavia no tiene grupo) su arreglo .horarios.
async function attachHorarios(rows) {
  const ids = rows.map((r) => r.id).filter((id) => id != null);
  if (ids.length === 0) return rows.map((r) => ({ ...r, horarios: [] }));
  const { rows: horarios } = await query(
    `SELECT * FROM planeacion_horario WHERE planeacion_id = ANY($1::int[]) ORDER BY planeacion_id, orden`,
    [ids]
  );
  const map = new Map();
  for (const h of horarios) {
    const list = map.get(h.planeacion_id) || [];
    list.push(h);
    map.set(h.planeacion_id, list);
  }
  return rows.map((r) => ({ ...r, horarios: r.id != null ? map.get(r.id) || [] : [] }));
}

// Consulta unificada para el rol "coordinador" (y cualquier rol que ya
// pudiera ver planeacion: decano, secretaria academica, admin): permite
// buscar por cedula de docente, cedula de estudiante, grupo o nombre de
// materia, ademas del listado completo de siempre (sin filtros). Cada
// filtro busca en una tabla distinta, asi que solo se combinan entre si los
// que tiene sentido combinar (grupo/docente/materia sobre catalogo+
// planeacion); "cedula de estudiante" es un caso aparte porque el vinculo
// estudiante->materia vive en la tabla "estudiantes" (columnas asignatura y
// grupo, ver db/schema.sql), no en una tabla de inscripciones.
async function GET(req) {
  try {
    const user = requireUser();
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo");
    if (!periodo) {
      const err = new Error("Debes indicar el período.");
      err.status = 400;
      throw err;
    }

    const facultadFiltro =
      user.rol === "decano" || user.rol === "coordinador" ? user.facultad : searchParams.get("facultad");

    const cedulaDocente = (searchParams.get("cedula_docente") || "").trim();
    const cedulaEstudiante = (searchParams.get("cedula_estudiante") || "").trim();
    const grupo = (searchParams.get("grupo") || "").trim();
    const materia = (searchParams.get("materia") || "").trim();

    if (cedulaEstudiante) {
      const paramsEst = [periodo, `%${cedulaEstudiante}%`];
      let whereEst = "periodo = $1 AND documento ILIKE $2";
      if (facultadFiltro) {
        paramsEst.push(facultadFiltro);
        whereEst += ` AND facultad = $${paramsEst.length}`;
      }
      const { rows: filasEstudiante } = await query(
        `SELECT * FROM estudiantes WHERE ${whereEst} ORDER BY nombre_completo, asignatura LIMIT 300`,
        paramsEst
      );

      const filas = [];
      for (const est of filasEstudiante) {
        let grupoInfo = null;
        if (est.asignatura && est.grupo) {
          const { rows } = await query(
            `SELECT p.*, c.asignatura, c.programa, c.plan, c.ciclo, c.creditos
             FROM planeacion p
             JOIN catalogo c ON c.id = p.catalogo_id
             WHERE p.periodo = $1 AND p.facultad = $2 AND c.asignatura = $3 AND p.grupo = $4
             LIMIT 1`,
            [periodo, est.facultad || facultadFiltro || "", est.asignatura, est.grupo]
          );
          grupoInfo = rows[0] || null;
        }
        const [conHorario] = grupoInfo ? await attachHorarios([grupoInfo]) : [null];
        filas.push({
          estudiante_documento: est.documento,
          estudiante_nombre: est.nombre_completo,
          estudiante_correo: est.correo,
          asignatura: conHorario?.asignatura || est.asignatura || "—",
          programa: conHorario?.programa || est.programa || "",
          plan: conHorario?.plan || est.plan || "",
          ciclo: conHorario?.ciclo || est.ciclo || "",
          grupo: est.grupo,
          modalidad: conHorario?.modalidad || null,
          jornada: conHorario?.jornada || null,
          estado: conHorario?.estado || null,
          nombre_docente: conHorario?.nombre_docente || null,
          horarios: conHorario?.horarios || [],
          sinProgramar: !conHorario
        });
      }
      return ok({ tipo: "estudiante", filas });
    }

    const params = [periodo];
    let where = "c.periodo = $1";
    if (facultadFiltro) {
      params.push(facultadFiltro);
      where += ` AND c.facultad = $${params.length}`;
    }
    if (materia) {
      params.push(`%${materia}%`);
      where += ` AND c.asignatura ILIKE $${params.length}`;
    }
    if (grupo) {
      params.push(`%${grupo}%`);
      where += ` AND p.grupo ILIKE $${params.length}`;
    }
    if (cedulaDocente) {
      params.push(`%${cedulaDocente}%`);
      where += ` AND (p.documento_docente ILIKE $${params.length} OR p.nombre_docente ILIKE $${params.length})`;
    }

    // Buscar por grupo o por docente solo tiene sentido sobre grupos que YA
    // existen (INNER JOIN); sin esos filtros se conserva el LEFT JOIN para
    // seguir viendo tambien las materias sin programar todavia.
    const necesitaGrupo = Boolean(grupo || cedulaDocente);
    const join = necesitaGrupo
      ? "JOIN planeacion p ON p.catalogo_id = c.id"
      : "LEFT JOIN planeacion p ON p.catalogo_id = c.id";

    const { rows } = await query(
      `SELECT c.asignatura, c.programa, c.plan, c.ciclo, c.creditos,
              p.id, p.grupo, p.modalidad, p.jornada, p.estado,
              p.documento_docente, p.nombre_docente, p.correo_institucional
       FROM catalogo c ${join}
       WHERE ${where}
       ORDER BY c.programa, c.asignatura, p.grupo
       LIMIT 500`,
      params
    );

    const filas = await attachHorarios(rows);
    const tipo = materia ? "materia" : cedulaDocente ? "docente" : grupo ? "grupo" : "todos";
    return ok({ tipo, filas });
  } catch (err) {
    return jsonError(err);
  }
}

module.exports = { GET };
