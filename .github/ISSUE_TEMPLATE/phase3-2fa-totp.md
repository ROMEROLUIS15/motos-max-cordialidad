---
name: '[Phase 3] Two-Factor Authentication (2FA)'
about: Add optional TOTP-based 2FA for all user accounts
title: '[Phase 3] Implement TOTP-based two-factor authentication'
labels: security, phase-3, authentication
assignees: ''
---

## Context

Currently the system relies solely on password-based authentication. Adding TOTP
(Time-based One-Time Password) 2FA provides a second factor that protects accounts
even when passwords are compromised. This is especially important for `OWNER` and
`ADMIN` roles.

## Proposed implementation

### Backend

- Add `totpSecret VARCHAR(64) NULL` and `totpEnabled BOOLEAN DEFAULT false` to `User`.
- `POST /auth/2fa/setup` — generates a TOTP secret, returns QR code URI.
- `POST /auth/2fa/verify-setup` — verifies the first TOTP code and enables 2FA.
- `POST /auth/2fa/disable` — disables 2FA (requires password confirmation).
- Modify `POST /auth/login` — if `totpEnabled`, return `{ requiresTotp: true, sessionId }`.
- `POST /auth/2fa/challenge` — validates TOTP code and returns final JWT.

### Library

Use `otplib` (already available in JS ecosystem) for TOTP generation and validation.

### Frontend

- Setup wizard: QR code scan + confirmation code.
- Login flow: after password, redirect to TOTP input if `requiresTotp: true`.
- Recovery codes: generate 8 single-use backup codes at setup.

## Acceptance criteria

- [ ] TOTP setup flow works with Google Authenticator and Authy
- [ ] Login blocked without valid TOTP when 2FA is enabled
- [ ] Recovery codes allow login when TOTP device is lost
- [ ] 2FA can be disabled with password confirmation
- [ ] E2E tests cover full 2FA login flow

## Priority

Only mandatory for `OWNER` and `ADMIN` roles (Phase 3a). Optional for other roles (Phase 3b).
