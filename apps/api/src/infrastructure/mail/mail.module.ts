import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env['SMTP_HOST'] ?? 'smtp.sendgrid.net',
        port: Number(process.env['SMTP_PORT']) || 587,
        auth: {
          user: process.env['SMTP_USER'] ?? 'apikey',
          pass: process.env['SMTP_PASS'] ?? '',
        },
      },
      defaults: {
        from: `"Motos Max Cordialidad" <${process.env['SMTP_FROM'] ?? 'noreply@motosmaxcordialidad.com'}>`,
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
