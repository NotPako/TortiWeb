import nodemailer, { type Transporter } from 'nodemailer';

let _transporter: Transporter | null = null;

/**
 * Transporte SMTP configurado por variables de entorno:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM.
 * Con un Gmail con "app password" o cualquier proveedor SMTP estándar sirve.
 */
function getTransporter(): Transporter {
  if (_transporter) return _transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error(
      'Faltan variables de entorno SMTP_HOST / SMTP_USER / SMTP_PASSWORD.'
    );
  }
  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return _transporter;
}

function getFromAddress(): string {
  return process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'tortiweb@localhost';
}

export async function sendPasswordResetEmail(args: {
  to: string;
  username: string;
  resetUrl: string;
}): Promise<void> {
  const { to, username, resetUrl } = args;
  await getTransporter().sendMail({
    from: `TortiWeb <${getFromAddress()}>`,
    to,
    subject: 'TortiWeb · Restablece tu contraseña',
    text: [
      `Hola ${username},`,
      '',
      'Alguien (esperemos que tú) ha pedido restablecer la contraseña de tu cuenta de TortiWeb.',
      '',
      `Para elegir una nueva contraseña, abre este enlace (caduca en 1 hora):`,
      resetUrl,
      '',
      'Si no has sido tú, ignora este correo: tu contraseña seguirá siendo la misma.',
    ].join('\n'),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #a25400;">🍳 TortiWeb</h2>
        <p>Hola <strong>${username}</strong>,</p>
        <p>Alguien (esperemos que tú) ha pedido restablecer la contraseña de tu cuenta de TortiWeb.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}"
             style="background: #f59300; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Elegir nueva contraseña
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">El enlace caduca en 1 hora. Si no has sido tú, ignora este correo: tu contraseña seguirá siendo la misma.</p>
      </div>
    `,
  });
}
