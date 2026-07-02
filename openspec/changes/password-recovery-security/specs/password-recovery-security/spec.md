## MODIFIED Requirements

> These requirements **replace** the following scenarios from the `password-recovery` capability spec (Change 1):
>
> - "Scenario: Expired token fails" (previously returned distinct message)
> - "Scenario: Used token fails" (previously returned distinct message)
>
> Reason: Distinct error messages enable information disclosure attacks (CWE-214).

### Requirement: Unified error messages on token validation failure

The system SHALL return the same error message for all token validation failures (invalid, already used, or expired) to prevent information disclosure attacks.

#### Scenario: Token not found returns generic error

- **WHEN** user submits an invalid token to POST /auth/reset-password
- **THEN** system returns HTTP 400 with message "Token inválido o expirado."

#### Scenario: Already-used token returns generic error

- **WHEN** user attempts to reuse a token that was already consumed
- **THEN** system returns HTTP 400 with message "Token inválido o expirado."

#### Scenario: Expired token returns generic error

- **WHEN** user submits a token after 15 minutes expiration window
- **THEN** system returns HTTP 400 with message "Token inválido o expirado."

---

## ADDED Requirements

### Requirement: Single valid token per user at any time

The system SHALL automatically delete all previously unused password reset tokens when generating a new token, ensuring only one valid token exists per user.

#### Scenario: Requesting password reset twice clears first token

- **WHEN** user requests password reset via POST /auth/forgot-password
- **AND** already has an unused token
- **THEN** system deletes the old token before creating a new one
- **AND** only the new token is valid

#### Scenario: Used token remains in database for audit

- **WHEN** user resets password successfully with a token
- **AND** later views user audit logs
- **THEN** the used token remains in database with usedAt timestamp

### Requirement: Email delivery errors are handled without leaking user existence

The system SHALL maintain anti-enumeration protection even when email delivery fails. The response to the client MUST always be HTTP 200 with the generic message, regardless of email delivery outcome. Failures SHALL be handled internally.

> This requirement **clarifies** the interaction between email error handling and anti-enumeration.
> Returning HTTP 500 only when an email exists would allow attackers to enumerate valid emails
> by observing response codes during SMTP outages.

#### Scenario: Resend failure is handled silently to client

- **WHEN** POST /auth/forgot-password is called for a registered email
- **AND** Resend email API returns an error
- **THEN** system returns HTTP 200 with the same generic message "Si el email está registrado, recibirás un link de recuperación."
- **AND** system logs the error internally at ERROR level with correlation ID
- **AND** system triggers an internal alert (e.g., Sentry, structured log) for ops monitoring

#### Scenario: Token remains valid after email failure

- **WHEN** email send fails after token is created in database
- **THEN** token remains valid for its 15-minute expiration window
- **AND** user can retry forgot-password to receive a new email (previous token is cleaned up)

#### Scenario: Password change notification failure does not block reset

- **WHEN** password is reset successfully
- **AND** the confirmation email fails to send
- **THEN** the password reset is NOT rolled back (change is already committed)
- **AND** system logs the notification failure at ERROR level

### Requirement: Automatic cleanup of expired tokens

The system SHALL automatically delete password reset tokens that are both expired AND unused.

#### Scenario: Cleanup job runs hourly

- **WHEN** scheduled job runs every hour
- **THEN** system finds all tokens where `expiresAt < NOW() AND usedAt IS NULL`
- **AND** deletes them from the database
- **AND** logs count of deleted tokens for monitoring

#### Scenario: Cleanup preserves used tokens for audit trail

- **WHEN** cleanup job runs
- **AND** a token has `usedAt IS NOT NULL` (was successfully consumed)
- **THEN** the token is NOT deleted, regardless of its expiration time
- **AND** used tokens are retained indefinitely for audit purposes

#### Scenario: Cleanup preserves unexpired tokens

- **WHEN** cleanup job runs
- **AND** a token has `expiresAt > NOW()` and `usedAt IS NULL`
- **THEN** the token is NOT deleted (still valid for the user)

### Requirement: No information about email validity in response

The system SHALL return the same response whether the email exists or not, maintaining user privacy.

#### Scenario: Unknown email receives generic response

- **WHEN** user requests password reset for non-existent email
- **THEN** system returns HTTP 200 with message "Si el email está registrado, recibirás un link de recuperación."
- **AND** no token is created
- **AND** request is logged for security monitoring

#### Scenario: Known email receives same generic response

- **WHEN** user requests password reset for registered email
- **THEN** system returns HTTP 200 with same generic message
- **AND** token IS created (but caller doesn't know)
- **AND** email is sent (silently to caller)
