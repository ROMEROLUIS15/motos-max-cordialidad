---
name: '[Phase 2] Cancel Password Reset via Email Link'
about: Allow users to cancel an in-flight password reset by clicking a link in the notification email
title: '[Phase 2] Add cancel-email link to password reset flow'
labels: security, phase-2, password-recovery, ux
assignees: ''
---

## Context

When a user receives a "Your password was changed" notification email, they currently
have no in-band way to immediately revoke the change if it was fraudulent. A "cancel
this change" link in the notification email would allow the legitimate user to
trigger an account lock and alert support without requiring a support call.

## Proposed implementation

1. **Schema change**: Add `cancelTokenHash VARCHAR(64) UNIQUE NULL` to `PasswordResetToken`.
2. **Cancel token generation**: At reset time, generate a second random token (cancel token),
   hash it, store it in `cancelTokenHash`, and include it in the "password changed" notification email.
3. **Cancel endpoint**: `POST /auth/cancel-password-reset` — receives the cancel token,
   finds the record, locks the user account (`isActive = false`), and notifies support.

```
Email: "Tu contraseña fue cambiada. ¿No fuiste tú? Haz clic aquí para cancelar y bloquear tu cuenta."
Link:  https://app.example.com/auth/cancel-reset?token=<cancelToken>
```

## Acceptance criteria

- [ ] Cancel token stored in `PasswordResetToken.cancelTokenHash`
- [ ] Cancel link included in "password changed" notification email
- [ ] `POST /auth/cancel-password-reset` locks user account
- [ ] Locked account cannot log in
- [ ] Support is notified via email when a cancel is triggered
- [ ] Cancel token expires 24 hours after the reset
- [ ] E2E test: cancel flow locks the account

## Security notes

- The cancel token must be single-use (mark `canceledAt` on use).
- The cancel token must NOT be the same as the reset token.
- Locking the account requires manual admin reactivation to prevent self-DoS abuse.
