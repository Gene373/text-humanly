import { config, isMailerConfigured } from '../config.ts';
import { logger } from '../logger.ts';
import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isMailerConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

function renderEmail(link: string): { subject: string; text: string; html: string } {
  const subject = 'Ссылка для входа — Текст по-человечески';
  const text = [
    'Здравствуйте!',
    '',
    'Чтобы войти в «Текст по-человечески», перейдите по ссылке:',
    link,
    '',
    `Ссылка действует ${config.magicLinkTtlMinutes} минут и срабатывает один раз.`,
    'Если вы не запрашивали вход, просто проигнорируйте письмо.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:32px;background:#F7F8FB;font-family:Inter,Arial,sans-serif;color:#1A1D24;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;">Вход в «Текст по-человечески»</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:26px;color:#6B7280;">
          Нажмите кнопку ниже, чтобы войти. Ссылка действует ${config.magicLinkTtlMinutes} минут и срабатывает один раз.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${link}" style="display:inline-block;background:#2F5BEA;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:12px;">
            Войти
          </a>
        </p>
        <p style="margin:0;font-size:13px;line-height:18px;color:#6B7280;">
          Если кнопка не работает, скопируйте ссылку: <br />
          <a href="${link}" style="color:#2F5BEA;word-break:break-all;">${link}</a>
        </p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendMagicLink(email: string, link: string): Promise<void> {
  const mailer = getTransporter();

  if (!mailer) {
    logger.warn({ email, link }, 'SMTP не настроен — ссылка для входа выведена в лог');
    return;
  }

  const { subject, text, html } = renderEmail(link);
  await mailer.sendMail({ from: config.smtp.from, to: email, subject, text, html });
  logger.info({ email }, 'письмо со ссылкой для входа отправлено');
}
