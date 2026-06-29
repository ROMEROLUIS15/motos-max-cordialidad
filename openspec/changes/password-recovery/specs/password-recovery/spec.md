## ADDED Requirements

### Requirement: User can request a password reset email

The system SHALL allow any user to request a password reset link by providing their email address. The system MUST respond with HTTP 200 regardless of whether the email exists. If the email exists, the system SHALL generate a cryptographically secure token, persist it hashed, and send a reset link via email.

#### Scenario: Valid email sends reset link

- **WHEN** a POST request is made to `/api/auth/forgot-password` with `{ "email": "user@taller.com" }`
- **THEN** the system responds with HTTP 200 and `{ "message": "Si el email está registrado, recibirás un link de recuperación." }`
- **AND** if the email exists, a `PasswordResetToken` record is created with SHA-256 hash of the token and a 15-minute expiry
- **AND** an email is sent to that address with a reset link containing the raw token

#### Scenario: Non-existent email returns 200

- **WHEN** a POST request is made to `/api/auth/forgot-password` with a non-existent email
- **THEN** the system responds with HTTP 200 and the same generic message
- **AND** no `PasswordResetToken` record is created

#### Scenario: Rate limiting applies

- **WHEN** more than 3 requests are made from the same IP within 1 hour
- **THEN** the system responds with HTTP 429 (Too Many Requests)

### Requirement: User can reset password with a valid token

The system SHALL allow a user to reset their password by providing a valid token and a new password. The token MUST be single-use, expire after 15 minutes, and be consumed after successful reset.

#### Scenario: Successful password reset

- **WHEN** a POST request is made to `/api/auth/reset-password` with `{ "token": "abc123...", "password": "NuevaClaveSegura2026!" }`
- **THEN** the system responds with HTTP 200
- **AND** the user's password is updated using bcryptjs
- **AND** the token is consumed (deleted or marked as used)
- **AND** an email notification is sent to the user confirming the password change

#### Scenario: Expired token fails

- **WHEN** a POST request is made with a token created more than 15 minutes ago
- **THEN** the system responds with HTTP 400 and `{ "message": "El token ha expirado. Solicita uno nuevo." }`

#### Scenario: Used token fails

- **WHEN** a POST request is made with a token that was already consumed
- **THEN** the system responds with HTTP 400 and `{ "message": "Token inválido o ya utilizado." }`

#### Scenario: Weak password rejected

- **WHEN** a POST request is made with a password shorter than 8 characters
- **THEN** the system responds with HTTP 400 and a validation error
