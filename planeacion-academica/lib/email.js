const nodemailer = require("nodemailer");

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

module.exports = { enviarCorreoRecuperacion, smtpConfigurado };
