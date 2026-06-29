## ADDED Requirements

### Requirement: Auth flow supports password recovery

The authentication system SHALL integrate with the password recovery flow by verifying the user's email exists during forgot-password and updating the password hash during reset-password.

#### Scenario: Forgot-password looks up user by email

- **WHEN** a forgot-password request arrives with a valid email
- **THEN** the system queries `User` by email (ignoring tenantId) to verify existence
- **AND** creates a `PasswordResetToken` associated with that user

#### Scenario: Reset-password updates user password hash

- **WHEN** a reset-password request arrives with a valid token and new password
- **THEN** the system updates `User.passwordHash` using bcryptjs with salt rounds 12
- **AND** updates `User.updatedAt` timestamp
- **AND** the existing refresh tokens for that user are NOT revoked (optional: could be a future improvement)
