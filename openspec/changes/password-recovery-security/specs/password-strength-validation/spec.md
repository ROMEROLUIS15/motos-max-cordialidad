## ADDED Requirements

### Requirement: Password must contain mixed character types

The system SHALL validate that new passwords meet minimum complexity requirements: at least one uppercase letter, one lowercase letter, and one number. This validation SHALL apply to **all password-setting endpoints**: POST /auth/reset-password and any user creation/update endpoint that sets a password.

#### Scenario: Password with uppercase, lowercase, and number is accepted

- **WHEN** user submits password "MyPassword123" to POST /auth/reset-password
- **THEN** system accepts the password
- **AND** returns HTTP 200 with "Contraseña actualizada exitosamente."

#### Scenario: Password with only lowercase letters is rejected

- **WHEN** user submits password "abcdefgh" to POST /auth/reset-password
- **THEN** system returns HTTP 400 with validation error
- **AND** includes message about uppercase requirement

#### Scenario: Password with only numbers is rejected

- **WHEN** user submits password "12345678" to POST /auth/reset-password
- **THEN** system returns HTTP 400 with validation error
- **AND** includes message about letter requirement

#### Scenario: Password with only uppercase letters is rejected

- **WHEN** user submits password "ABCDEFGH" to POST /auth/reset-password
- **THEN** system returns HTTP 400 with validation error

#### Scenario: Password with uppercase, lowercase, number, and symbol is accepted

- **WHEN** user submits password "MyPassword123!" to POST /auth/reset-password
- **THEN** system accepts the password (symbol is bonus, not required)
- **AND** returns HTTP 200

### Requirement: Password must be at least 8 characters

The system SHALL enforce a minimum password length of 8 characters, combined with complexity requirements.

#### Scenario: 7-character password is rejected

- **WHEN** user submits password "Abcde1!" (7 chars, meets complexity) to POST /auth/reset-password
- **THEN** system returns HTTP 400 with length requirement message

#### Scenario: 8-character password with complexity is accepted

- **WHEN** user submits password "Ab123456" (8 chars, has uppercase/lowercase/number) to POST /auth/reset-password
- **THEN** system accepts the password
- **AND** returns HTTP 200

#### Scenario: 100-character password is accepted

- **WHEN** user submits a 100-character password with mixed complexity
- **THEN** system accepts the password
- **AND** applies bcrypt hashing (handles long strings safely)

### Requirement: Validation errors are clear to client

The system SHALL provide specific error messages indicating which password requirements failed.

#### Scenario: Missing uppercase letter error

- **WHEN** user submits "abcdefgh123" (no uppercase)
- **THEN** error message includes text about "mayúscula" or "uppercase"

#### Scenario: Missing number error

- **WHEN** user submits "AbcDefgh" (no number)
- **THEN** error message includes text about "número" or "number"

#### Scenario: Missing lowercase letter error

- **WHEN** user submits "ABCDEFGH1" (no lowercase)
- **THEN** error message includes text about "minúscula" or "lowercase"
