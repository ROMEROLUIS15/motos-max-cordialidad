## ADDED Requirements

### Requirement: System sends password reset email

The system SHALL send a transactional email to the user containing a one-time password reset link. The email SHALL include the user's name, the reset link (valid 15 min), and a warning to ignore if not requested.

#### Scenario: Reset email sent

- **WHEN** a user requests a password reset and the email exists
- **THEN** an email is sent to the registered address with subject "Recuperación de contraseña — Motos Max Cordialidad"
- **AND** the email body includes the reset URL: `https://app.motosmaxcordialidad.com/auth/reset-password?token={rawToken}`
- **AND** the email states the link expires in 15 minutes

### Requirement: System sends password changed notification

The system SHALL send a confirmation email when a password is successfully reset.

#### Scenario: Password changed notification

- **WHEN** a password reset is completed successfully
- **THEN** an email is sent to the user with subject "Tu contraseña ha sido cambiada — Motos Max Cordialidad"
- **AND** the email body states the password was changed and asks the user to contact support if they did not request it
