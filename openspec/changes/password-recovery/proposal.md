## Why

Los usuarios no pueden recuperar su contraseña si la olvidan. Actualmente solo hay un flujo de login con JWT, sin opción de restablecimiento. Esto genera tickets a soporte y bloquea a los administradores del taller.

## What Changes

- Nuevo endpoint `POST /api/auth/forgot-password` que recibe un email y envía un link de recuperación
- Nuevo endpoint `POST /api/auth/reset-password` que recibe un token + nueva contraseña y la actualiza
- Nueva tabla `PasswordResetToken` en Prisma para almacenar tokens hasheados con expiración
- Módulo de envío de email (Nodemailer o similar) integrado con NestJS
- Rate limiting específico: 3 solicitudes de forgot-password por hora por IP
- Notificación al dueño del taller cuando se cambia la contraseña

## Capabilities

### New Capabilities

- `password-recovery`: Solicitud de restablecimiento de contraseña mediante email con token de un solo uso y expiración de 15 minutos
- `email-notification`: Envío de emails transaccionales desde la API (bienvenida, recuperación, notificaciones)

### Modified Capabilities

- `user-auth`: El flujo de autenticación existente se extiende para soportar restablecimiento de contraseña

## Non-goals

- No se implementa registro de usuarios (signup) público
- No se implementa cambio de contraseña desde perfil (solo recovery)
- No se implementa 2FA/MFA
- No se reemplaza el flujo actual de JWT

## Security & Rate limiting

- Token de recuperación: 32 bytes aleatorios via `crypto.randomBytes`, hasheado con SHA-256 antes de persistir
- Expiración del token: 15 minutos
- Rate limit: 3 solicitudes de forgot-password por hora por IP (`@Throttle`)
- Un solo token válido por usuario a la vez (el anterior se invalida)
- Notificación al email del usuario cuando se cambia la contraseña
- La respuesta del forgot-password siempre es 200 aunque el email no exista (no revelar usuarios)

## Impact

- `apps/api/` — nuevos endpoints en auth controller, nuevo use case, nuevo Prisma model + migración, nuevo módulo mailer
- `apps/web/` — nuevas páginas: forgot-password y reset-password
- Dependencias nuevas: `@nestjs-modules/mailer` + `nodemailer`
