## ADDED Requirements

### Requirement: E2E test for complete password recovery flow

The system SHALL have automated E2E tests that verify the entire password recovery journey from forgot-password through reset-password and successful login.

#### Scenario: Happy path: forgot → email → reset → login

- **WHEN** E2E test executes: POST /auth/forgot-password for test user
- **THEN** system creates password reset token
- **AND** sends email (intercepted in test)
- **WHEN** test extracts token from email
- **AND** submits POST /auth/reset-password with token and new password
- **THEN** password is updated
- **WHEN** test attempts login with new password
- **THEN** login succeeds with valid JWT token

### Requirement: Tests verify token validation rules

The system SHALL have tests that verify all token validation scenarios.

#### Scenario: Expired token is rejected

- **WHEN** test creates token with past expiration time (manually in test DB)
- **AND** attempts to use it
- **THEN** system returns 400 "Token inválido o expirado."

#### Scenario: Already-used token is rejected

- **WHEN** test creates and uses a token once
- **AND** attempts to use the same token again
- **THEN** system returns 400 "Token inválido o expirado."

#### Scenario: Nonexistent token is rejected

- **WHEN** test submits random token string
- **THEN** system returns 400 "Token inválido o expirado."

### Requirement: Tests verify rate limiting

The system SHALL have tests that confirm rate limit enforcement.

#### Scenario: 5 consecutive forgot-password requests succeed

- **WHEN** test makes 5 POST /auth/forgot-password requests for same (email, IP)
- **THEN** all return HTTP 200

#### Scenario: 6th request hits rate limit

- **WHEN** test makes 6th POST /auth/forgot-password request for same (email, IP)
- **THEN** system returns HTTP 429

#### Scenario: Different IP bypasses rate limit

- **WHEN** test changes IP and makes 6th request to /auth/forgot-password
- **THEN** system returns HTTP 200 (new IP bucket)

### Requirement: Tests verify password validation

The system SHALL have tests that confirm password strength requirements.

#### Scenario: Weak password is rejected

- **WHEN** test attempts reset-password with "12345678" (numbers only)
- **THEN** system returns HTTP 400 with validation error
- **AND** password is NOT changed

#### Scenario: Strong password is accepted

- **WHEN** test attempts reset-password with "MyPassword123"
- **THEN** system returns HTTP 200
- **AND** password is successfully changed

### Requirement: Tests verify email notifications

The system SHALL have tests that confirm emails are sent at appropriate times.

#### Scenario: Password reset email is sent on forgot-password

- **WHEN** test calls POST /auth/forgot-password
- **THEN** system sends email with reset link

#### Scenario: Confirmation email is sent on successful reset

- **WHEN** test successfully resets password with valid token
- **THEN** system sends confirmation email to user

### Requirement: Tests verify privacy (email enumeration protection)

The system SHALL have tests confirming user enumeration is not possible.

#### Scenario: Same response for known and unknown emails

- **WHEN** test calls POST /auth/forgot-password for known user
- **THEN** response is HTTP 200 with message "Si el email está registrado..."
- **WHEN** test calls POST /auth/forgot-password for unknown email
- **THEN** response is identical (same HTTP code, same message)

### Requirement: Tests verify token cleanup

The system SHALL have tests confirming automatic token cleanup works.

#### Scenario: Only one valid token exists per user

- **WHEN** test requests password reset twice for same user
- **AND** checks token table
- **THEN** only one unused token exists for that user
- **AND** first token is deleted from database

### Requirement: Tests are fast and deterministic

The system SHALL have E2E tests that run in <10 seconds total and pass consistently.

#### Scenario: Test suite runs in under 10 seconds

- **WHEN** running `npm run test:e2e -- password-recovery`
- **THEN** all tests complete in <10 seconds

#### Scenario: Tests are repeatable

- **WHEN** running test suite 3 times consecutively
- **THEN** all runs have identical results (no flaky tests)

### Requirement: Test coverage is tracked

The system SHALL measure and maintain >90% code coverage for password recovery flows.

#### Scenario: Code coverage report shows 90%+ coverage

- **WHEN** running test suite with coverage reporting
- **THEN** coverage report includes password recovery code
- **AND** shows >90% line coverage for forgot-password, reset-password, and related services
