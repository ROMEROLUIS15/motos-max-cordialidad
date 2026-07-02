## Context

La API actual tiene autenticación con JWT (access + refresh tokens) y rate limiting con `@nestjs/throttler`. No existe ningún flujo de recuperación de contraseña. Los usuarios que olvidan su clave quedan bloqueados. No hay módulo de envío de emails.

El login usa bcryptjs (salt rounds 12) y soporta multi-tenant (email + tenantId). Cada usuario pertenece a un tenant.

## Goals / Non-Goals

**Goals:**

- Permitir al usuario solicitar un link de recuperación por email
- Permitir restablecer la contraseña con un token de un solo uso
- Token seguro (32 bytes aleatorios, hasheado en BD), expiración 15 min
- Rate limiting de 3 solicitudes/hora por IP
- Notificar al usuario por email cuando la contraseña cambie
- No revelar si un email existe o no en la BD

**Non-Goals:**

- No se agrega registro público de usuarios
- No se modifica el flujo actual de login/refresh/logout
- No se implementa MFA/2FA

## Decisions

### 1. Mailer: Resend (Direct SDK, HTTP API)

- **Alternativas consideradas:** `@sendgrid/mail`, `@nestjs-modules/mailer` + Nodemailer (SMTP), Mailgun API directa, AWS SES
- **Decisión:** SDK `resend` directo vía HTTP API. Historia: Nodemailer/SMTP quedó descartado porque Render free bloquea puertos SMTP salientes (587 y 465); SendGrid HTTP API funcionó pero la API key dio 401 persistente en Render. Resend usa HTTP (no bloqueado), SDK mínimo, y con `onboarding@resend.dev` permite enviar al email del dueño de la cuenta Resend sin verificar dominio — suficiente para el caso de uso (solo el OWNER recupera contraseña). Se encapsula en `MailService`; en dev (`NODE_ENV !== 'production'`) se imprime el link en consola en lugar de llamar a Resend.
- **Config requerida en Render:** `RESEND_API_KEY` y `SMTP_FROM` (sin dominio verificado: `onboarding@resend.dev`).

### 2. Token storage: Tabla independiente `PasswordResetToken`

- **Alternativas:** Redis con TTL, JWT firmado como token
- **Decisión:** Tabla Prisma independiente. El token sin hash se devuelve al usuario en el link; en BD solo se guarda `SHA-256(token)`. Esto evita que un ataque a la BD exponga tokens válidos. Redis agregaría otra dependencia; JWT como token de recovery es menos seguro porque es reversible si la clave se filtra.

### 3. Rate limiting: @nestjs/throttler por controlador

- Se reusa el `ThrottlerGuard` existente con `@Throttle({ default: { limit: 3, ttl: 3600000 } })` en el endpoint `forgot-password`. Esto da 3 intentos por hora por IP.

### 4. Respuesta siempre 200 en forgot-password

- Por seguridad, el endpoint siempre responde 200 aunque el email no exista. El mensaje es genérico: "Si el email está registrado, recibirás un link de recuperación."

### 5. Notificación de cambio

- Al completar el reset, se envía un email al usuario notificando que su contraseña fue cambiada. Si el cambio no fue iniciado por él, debe contactar a soporte.

### 6. No se inyecta MailerModule global

- Se crea un `MailModule` independiente con su propio `MailService` que expone `sendPasswordResetEmail()` y `sendPasswordChangedNotification()`. Esto mantiene el módulo de identidad limpio.

## Risks / Trade-offs

- **[Token interceptado]** Si el email es interceptado, cualquiera puede cambiar la contraseña. → Mitigación: expiración de 15 min, link de un solo uso, notificación al dueño del cambio.
- **[SMTP no configurado]** Si el tenant no tiene SMTP, el recovery no funciona. → Mitigación: usar SMTP por defecto de las variables de entorno como fallback.
- **[Rate limit compartido]** El rate limit de forgot-password es por IP, no por email. Un atacante puede bloquear a todos los usuarios de una IP compartida. → Mitigación: el límite de 3/h es suficientemente alto para no afectar usuarios legítimos.
- **[Fallo de SendGrid]** Si el proveedor SMTP falla, el usuario no recibe el email. → Mitigación: reintentar 1 vez con backoff de 2s, loguear el error para alertas.

## Migration Plan

1. `prisma migrate dev --name add_password_reset_token` — crear tabla
2. Instalar `@nestjs-modules/mailer` y `nodemailer`
3. Crear `MailModule` con `MailService`
4. Agregar `ForgotPasswordUseCase` y `ResetPasswordUseCase`
5. Agregar endpoints en `AuthController`
6. Agregar páginas en `apps/web` (forgot-password, reset-password)
7. Configurar variables de entorno SMTP en Render
8. Push a main → CI deploya

Rollback: `prisma migrate down` o eliminar la tabla + revertir cambios de código.

## Open Questions

- ¿Se debe permitir recovery sin tenantId? (usuarios multi-tenant vs un solo tenant)
- ¿Debe el token incluir el tenantId en el link?
- ¿Formato del email: texto plano o HTML?
