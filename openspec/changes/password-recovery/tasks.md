## 1. Schema & Dependencies

- [x] 1.1 Add `PasswordResetToken` model to Prisma schema
- [x] 1.2 Install `@nestjs-modules/mailer` and `nodemailer`
- [x] 1.3 Run `prisma migrate dev --name add_password_reset_token`

## 2. Mail Module (Backend)

- [x] 2.1 Create `MailModule` with `MailService` in `apps/api/src/infrastructure/mail/`
- [x] 2.2 Configure `@nestjs-modules/mailer` with SMTP transport (env vars)
- [x] 2.3 Implement `sendPasswordResetEmail(user, token)` method
- [x] 2.4 Implement `sendPasswordChangedNotification(user)` method
- [x] 2.5 Register `MailModule` in `app.module.ts`

## 3. Password Reset Use Cases (Backend)

- [x] 3.1 Create `ForgotPasswordUseCase` — validate email, generate token, persist hash, call mailer
- [x] 3.2 Create `ResetPasswordUseCase` — validate token, hash new password, update user, consume token, notify
- [x] 3.3 Register both use cases in `IdentityModule`

## 4. API Endpoints (Backend)

- [x] 4.1 Add `POST /api/auth/forgot-password` to `AuthController` con `@Throttle({ limit: 3, ttl: 3600000 })`
- [x] 4.2 Add `POST /api/auth/reset-password` to `AuthController`
- [x] 4.3 Add Zod schemas for request/response validation

## 5. Frontend (Next.js)

- [ ] 5.1 Create `/auth/forgot-password` page with email input form
- [ ] 5.2 Create `/auth/reset-password` page with token + new password form
- [ ] 5.3 Add success/error states and loading indicators

## 6. Deploy & Verify

- [ ] 6.1 Configure SMTP env vars in Render dashboard
- [ ] 6.2 Push to main, verify migration runs on Neon
- [ ] 6.3 Test full flow: forgot → email → reset → login
