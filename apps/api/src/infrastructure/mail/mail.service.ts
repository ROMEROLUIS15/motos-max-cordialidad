import { Injectable, Logger } from '@nestjs/common';
import sgMail from '@sendgrid/mail';

export interface MailUser {
  email: string;
  fullName: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor() {
    sgMail.setApiKey(process.env['SENDGRID_API_KEY'] ?? '');
    this.logger.log(`SendGrid init — key_len:${(process.env['SENDGRID_API_KEY'] ?? '').length}`);
  }

  async sendPasswordResetEmail(user: MailUser, token: string): Promise<void> {
    const url = `${this._baseUrl}/reset-password?token=${token}`;
    await sgMail.send({
      from: process.env['SMTP_FROM'] ?? 'motosmaxcordialidad@gmail.com',
      to: user.email,
      subject: 'Recuperación de contraseña — Motos Max Cordialidad',
      html: `<p>Hola ${user.fullName},</p>
<p>Recibimos una solicitud para restablecer tu contraseña.</p>
<p><a href="${url}">Restablecer contraseña</a></p>
<p>Este enlace expira en 15 minutos.</p>
<p>Si no solicitaste esto, ignora este mensaje.</p>`,
    });
    this.logger.log(`password reset email sent to ${user.email}`);
  }

  async sendPasswordChangedNotification(user: MailUser): Promise<void> {
    await sgMail.send({
      from: process.env['SMTP_FROM'] ?? 'motosmaxcordialidad@gmail.com',
      to: user.email,
      subject: 'Tu contraseña ha sido cambiada — Motos Max Cordialidad',
      html: `<p>Hola ${user.fullName},</p>
<p>Tu contraseña fue cambiada exitosamente.</p>
<p>Si no realizaste este cambio, contacta a soporte inmediatamente.</p>`,
    });
    this.logger.log(`password changed notification sent to ${user.email}`);
  }

  private get _baseUrl(): string {
    return process.env['FRONTEND_URL'] ?? 'https://motos-max-cordialidad.pages.dev';
  }
}
