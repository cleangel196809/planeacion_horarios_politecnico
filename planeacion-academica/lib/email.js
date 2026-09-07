const nodemailer = require("nodemailer");
const { DIAS } = require("./constants");

let transporter;

function smtpConfigurado() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true", // true para el puerto 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

/**
 * Envía el correo de recuperación de contraseña. Si el SMTP no está
 * configurado, no hace nada y devuelve false (no lanza error): así el flujo
 * de "olvidé mi contraseña" sigue funcionando (el token queda guardado en la
 * base de datos) aunque el correo institucional aún no se haya configurado.
 */
async function enviarCorreoRecuperacion({ to, nombre, resetUrl }) {
  if (!smtpConfigurado()) {
    // eslint-disable-next-line no-console
    console.warn(
      `[email] SMTP no configurado: no se envió el correo de recuperación a ${to}. Enlace: ${resetUrl}`
    );
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "Recupera tu acceso a Planeación Académica",
      text: `Hola ${nombre || ""},\n\nRecibimos una solicitud para restablecer tu contraseña en Planeación Académica.\n\nSi fuiste tú, entra a este enlace dentro de los próximos 30 minutos para definir una nueva contraseña:\n${resetUrl}\n\nSi no solicitaste esto, puedes ignorar este correo.`,
      html: `<p>Hola ${nombre || ""},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña en <strong>Planeación Académica</strong>.</p>
        <p>Si fuiste tú, haz clic en el siguiente enlace dentro de los próximos 30 minutos para definir una nueva contraseña:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Si no solicitaste esto, puedes ignorar este correo.</p>`
    });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] Error enviando correo de recuperación:", err.message);
    return false;
  }
}

/* ==========================================================================
   Envío masivo del horario (secretaría académica). Reutiliza el mismo
   transporte y el mismo patrón "si SMTP no está configurado, no falla: solo
   avisa por consola y devuelve false" que enviarCorreoRecuperacion, para que
   la pantalla de envío masivo pueda usarse (y probarse) aunque el SMTP
   institucional todavía no esté configurado en este entorno.
   ========================================================================== */

function labelDia(v) {
  const d = DIAS.find((x) => x.value === v);
  return d ? d.label : v;
}

// "Lunes 07:00-08:30 (Salón X); Miércoles 07:00-08:30 (Salón X)"
function formatearHorarios(horarios) {
  if (!horarios || horarios.length === 0) return "Horario por definir";
  return horarios
    .map((h) => {
      const rango = `${h.hora_inicio || "?"}-${h.hora_fin || "?"}`;
      const salon = h.salon ? ` (Salón ${h.salon})` : "";
      return `${labelDia(h.dia)} ${rango}${salon}`;
    })
    .join("; ");
}

function filaClaseTexto(c) {
  const docente = c.nombre_docente ? ` · Docente: ${c.nombre_docente}` : "";
  return `- ${c.asignatura} (grupo ${c.grupo || "—"}, ${c.sede || "—"})${docente}: ${formatearHorarios(c.horarios)}`;
}

function filaClaseHtml(c, incluirDocente) {
  return `<tr>
    <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${c.asignatura || ""}</td>
    <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${c.grupo || "—"}</td>
    <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${c.sede || "—"}</td>
    ${incluirDocente ? `<td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${c.nombre_docente || "—"}</td>` : ""}
    <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${formatearHorarios(c.horarios)}</td>
  </tr>`;
}

// Núcleo compartido por los tres envíos de horario de abajo: arma el correo
// (texto plano + tabla HTML) a partir de una lista de "clases" ya resuelta
// por quien llama (cada una con asignatura/grupo/sede/horarios y,
// opcionalmente, nombre_docente) y lo envía con el mismo transporte SMTP
// tolerante a no-configurado que usa enviarCorreoRecuperacion.
async function enviarHorarioPorCorreo({ to, nombre, asunto, introduccion, clases, incluirDocente, contexto }) {
  if (!smtpConfigurado()) {
    // eslint-disable-next-line no-console
    console.warn(`[email] SMTP no configurado: no se envió el horario (${contexto}) a ${to}.`);
    return false;
  }
  if (!to) return false;

  try {
    const filasTexto = (clases || []).map(filaClaseTexto).join("\n") || "(sin materias para este período)";
    const filasHtml = (clases || []).map((c) => filaClaseHtml(c, incluirDocente)).join("");

    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: asunto,
      text: `Hola ${nombre || ""},\n\n${introduccion}\n\n${filasTexto}`,
      html: `<p>Hola ${nombre || ""},</p>
        <p>${introduccion}</p>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #1d4ed8;">Asignatura</th>
              <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #1d4ed8;">Grupo</th>
              <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #1d4ed8;">Sede</th>
              ${incluirDocente ? '<th style="text-align:left;padding:4px 8px;border-bottom:2px solid #1d4ed8;">Docente</th>' : ""}
              <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #1d4ed8;">Horario</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>`
    });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] Error enviando horario (${contexto}) a ${to}:`, err.message);
    return false;
  }
}

// Un docente recibe únicamente sus propias clases.
async function enviarCorreoHorarioDocente({ to, nombre, periodo, clases }) {
  return enviarHorarioPorCorreo({
    to,
    nombre,
    asunto: `Tu horario de clases - ${periodo}`,
    introduccion: `Este es tu horario de clases para el período <strong>${periodo}</strong>:`,
    clases,
    incluirDocente: false,
    contexto: "docente"
  });
}

// Un decano recibe el horario completo de su facultad.
async function enviarCorreoHorarioDecano({ to, nombre, periodo, facultad, clases }) {
  return enviarHorarioPorCorreo({
    to,
    nombre,
    asunto: `Horario de ${facultad} - ${periodo}`,
    introduccion: `Este es el horario completo de <strong>${facultad}</strong> para el período <strong>${periodo}</strong>:`,
    clases,
    incluirDocente: true,
    contexto: "decano"
  });
}

// Un estudiante recibe únicamente las materias en las que está matriculado.
async function enviarCorreoHorarioEstudiante({ to, nombre, periodo, clases }) {
  return enviarHorarioPorCorreo({
    to,
    nombre,
    asunto: `Tu horario de clases - ${periodo}`,
    introduccion: `Este es tu horario de clases para el período <strong>${periodo}</strong>:`,
    clases,
    incluirDocente: true,
    contexto: "estudiante"
  });
}

module.exports = {
  enviarCorreoRecuperacion,
  smtpConfigurado,
  enviarCorreoHorarioDocente,
  enviarCorreoHorarioDecano,
  enviarCorreoHorarioEstudiante
};
