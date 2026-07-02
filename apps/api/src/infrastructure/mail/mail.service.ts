import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface MailUser {
  email: string;
  fullName: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  /** Null when RESEND_API_KEY is missing — `new Resend('')` throws at construction. */
  private readonly resend: Resend | null;

  /** True when running outside production (local dev, testing). */
  private get isDev(): boolean {
    return process.env['NODE_ENV'] !== 'production';
  }

  constructor() {
    const apiKey = process.env['RESEND_API_KEY'] ?? '';
    if (!apiKey && !this.isDev) {
      this.logger.error(
        'RESEND_API_KEY is not set — password reset emails WILL fail silently (HTTP 200 to client, no email sent)',
      );
    }
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendPasswordResetEmail(user: MailUser, token: string): Promise<void> {
    const url = `${this._baseUrl}/reset-password?token=${token}`;

    // ── Dev mode: print to console instead of calling Resend ──────────────
    // Resend's `onboarding@resend.dev` sender only works in production with a
    // verified domain. In local dev we log the link so the developer can test
    // the full reset flow without needing real email delivery.
    if (this.isDev) {
      this.logger.log(
        '\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '  📧  PASSWORD RESET LINK (dev — not sent via email)\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          `  To:   ${user.email}\n` +
          `  Name: ${user.fullName}\n` +
          `  URL:  ${url}\n` +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      );
      return;
    }

    // ── Production: send via Resend ────────────────────────────────────────
    if (!this.resend) {
      // Thrown so ForgotPasswordUseCase logs it at ERROR level; the HTTP
      // response stays 200 (anti-enumeration).
      throw new Error('RESEND_API_KEY is not configured — cannot send password reset email');
    }

    const { error } = await this.resend.emails.send({
      from: process.env['SMTP_FROM'] ?? 'Motos Max Cordialidad <noreply@motosmaxcordialidad.com>',
      to: user.email,
      subject: 'Recuperación de contraseña — Motos Max Cordialidad',
      html: `<p>Hola ${user.fullName},</p>
<p>Recibimos una solicitud para restablecer tu contraseña.</p>
<p><a href="${url}">Restablecer contraseña</a></p>
<p>Este enlace expira en 15 minutos.</p>
<p>Si no solicitaste esto, ignora este mensaje.</p>`,
    });

    if (error) {
      this.logger.error(`password reset email failed for ${user.email} — ${error.message}`);
      throw error;
    }

    this.logger.log(`password reset email sent to ${user.email}`);
  }

  async sendPasswordChangedNotification(user: MailUser): Promise<void> {
    if (this.isDev) {
      this.logger.log(`[DEV] Password changed notification would be sent to ${user.email}`);
      return;
    }

    if (!this.resend) {
      this.logger.error(
        `password changed notification skipped for ${user.email} — RESEND_API_KEY is not configured`,
      );
      return;
    }

    const { error } = await this.resend.emails.send({
      from: process.env['SMTP_FROM'] ?? 'Motos Max Cordialidad <noreply@motosmaxcordialidad.com>',
      to: user.email,
      subject: 'Tu contraseña ha sido cambiada — Motos Max Cordialidad',
      html: `<p>Hola ${user.fullName},</p>
<p>Tu contraseña fue cambiada exitosamente.</p>
<p>Si no realizaste este cambio, contacta a soporte inmediatamente.</p>`,
    });

    if (error) {
      this.logger.error(
        `password changed notification failed for ${user.email} — ${error.message}`,
      );
      // No lanzar excepción — el reset ya se completó; el fallo de notificación es secundario.
    } else {
      this.logger.log(`password changed notification sent to ${user.email}`);
    }
  }

  private get _baseUrl(): string {
    return process.env['FRONTEND_URL'] ?? 'https://motos-max-cordialidad.pages.dev';
  }
}
