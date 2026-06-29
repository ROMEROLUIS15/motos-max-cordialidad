import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

export interface MailUser {
  email: string;
  fullName: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailer: MailerService) {}

  async sendPasswordResetEmail(user: MailUser, token: string): Promise<void> {
    const url = `${this._baseUrl}/auth/reset-password?token=${token}`;
    try {
      await this.mailer.sendMail({
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
      this.logger.error(`failed to send reset email to ${user.email}`, exc as Error);
    }
  }

  async sendPasswordChangedNotification(user: MailUser): Promise<void> {
    try {
      await this.mailer.sendMail({
        to: user.email,
        subject: 'Tu contraseña ha sido cambiada — Motos Max Cordialidad',
        html: `<p>Hola ${user.fullName},</p>
<p>Tu contraseña fue cambiada exitosamente.</p>
<p>Si no realizaste este cambio, contacta a soporte inmediatamente.</p>`,
      });
      this.logger.log(`password changed notification sent to ${user.email}`);
    } catch (exc) {
      this.logger.error(`failed to send change notification to ${user.email}`, exc as Error);
    }
  }

  private get _baseUrl(): string {
    return process.env['FRONTEND_URL'] ?? 'https://app.motosmaxcordialidad.com';
  }
}
