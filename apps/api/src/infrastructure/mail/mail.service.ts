import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailUser {
  email: string;
  fullName: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = createTransport({
      host: process.env['SMTP_HOST'] ?? 'smtp.gmail.com',
      port: Number(process.env['SMTP_PORT']) || 587,
      auth: {
        user: process.env['SMTP_USER'] ?? '',
        pass: process.env['SMTP_PASS'] ?? '',
      },
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  async sendPasswordResetEmail(user: MailUser, token: string): Promise<void> {
    const url = `${this._baseUrl}/reset-password?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: `"Motos Max Cordialidad" <${process.env['SMTP_FROM'] ?? 'noreply@motosmaxcordialidad.com'}>`,
        to: user.email,
        subject: 'Recuperación de contraseña — Motos Max Cordialidad',
        html: `<p>Hola ${user.fullName},</p>
<p>Recibimos una solicitud para restablecer tu contraseña.</p>
<p><a href="${url}">Restablecer contraseña</a></p>
<p>Este enlace expira en 15 minutos.</p>
<p>Si no solicitaste esto, ignora este mensaje.</p>`,
      });
      this.logger.log(`password reset email sent to ${user.email}`);
    } catch (exc) {
      this.logger.error(`failed to send reset email to ${user.email}: ${(exc as Error).message}`);
    }
  }

  async sendPasswordChangedNotification(user: MailUser): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Motos Max Cordialidad" <${process.env['SMTP_FROM'] ?? 'noreply@motosmaxcordialidad.com'}>`,
        to: user.email,
        subject: 'Tu contraseña ha sido cambiada — Motos Max Cordialidad',
        html: `<p>Hola ${user.fullName},</p>
<p>Tu contraseña fue cambiada exitosamente.</p>
<p>Si no realizaste este cambio, contacta a soporte inmediatamente.</p>`,
      });
      this.logger.log(`password changed notification sent to ${user.email}`);
    } catch (exc) {
      this.logger.error(
        `failed to send change notification to ${user.email}: ${(exc as Error).message}`,
      );
    }
  }

  private get _baseUrl(): string {
    return process.env['FRONTEND_URL'] ?? 'https://app.motosmaxcordialidad.com';
  }
}
