## ADDED Requirements

### Requirement: Rate limit per user email and IP combination

The system SHALL enforce separate rate limits for POST /auth/forgot-password based on the combination of requesting IP address and target email address.

> **Implementación real:** `ForgotPasswordThrottlerGuard` (guard standalone con store
> en memoria). Límite: **3 requests por IP+email cada 15 minutos** (ventana fija que
> se reinicia al expirar el TTL). No usa ThrottlerModule para evitar la interacción
> de contadores duplicados entre el guard global y el de ruta.

#### Scenario: Same IP, same email, 3 requests succeed

- **WHEN** same IP makes 3 requests to /auth/forgot-password for the same email within 15 minutes
- **THEN** all 3 requests return HTTP 200 (though only last token is valid)

#### Scenario: Same IP, same email, 4th request fails

- **WHEN** same IP makes a 4th request to /auth/forgot-password for the same email within 15 minutes
- **THEN** system returns HTTP 429 (Too Many Requests)
- **AND** includes message "Demasiados intentos. Espera aproximadamente N minuto(s)." with the remaining wait time

#### Scenario: Same IP, different emails, limit applies per email

- **WHEN** same IP makes requests to /auth/forgot-password for 3 different emails
- **THEN** each email has its own counter of 3 requests / 15 minutes
- **AND** can make 3 requests per email before hitting limit

#### Scenario: Different IPs, same email, limit applies per IP

- **WHEN** IP 192.168.1.1 makes 3 requests for user@example.com
- **AND** IP 192.168.1.2 makes 3 requests for user@example.com
- **THEN** both IPs can each make 3 requests (separate counters)

#### Scenario: Rate limit resets after 15 minutes

- **WHEN** user hits rate limit at T+0:00 (request 4)
- **AND** waits until T+0:16
- **AND** makes another request
- **THEN** the request succeeds (limit counter reset)

### Requirement: Global per-route rate limit (circuit breaker)

The system SHALL enforce a global rate limit per IP and route as a safety valve, independent of the per-user limits.

> **Implementación real:** `GlobalThrottlerGuard` (APP_GUARD, clave `IP:path`) con
> dos ventanas del ThrottlerModule: **60 req/min** y **100 req/hora por IP+ruta**.
> No es un límite agregado entre todos los usuarios (eso requeriría un store
> compartido tipo Redis); limita por IP, que es lo alcanzable con store en memoria
> en una única instancia (plan free de Render).

#### Scenario: Circuit breaker per IP and route

- **WHEN** a single IP makes 100 requests to /auth/forgot-password within 1 hour (regardless of email)
- **AND** attempts the 101st request
- **THEN** system returns HTTP 429, regardless of individual IP+email counters

### Requirement: Rate limit applies to reset password endpoint

The system SHALL enforce rate limiting on POST /auth/reset-password **by IP only** (not IP+email), because the reset endpoint receives `{ token, password }` and does not include an email field.

> **Implementación real:** `@Throttle({ default: { limit: 5, ttl: 900_000 } })` —
> **5 requests por IP cada 15 minutos**.

#### Scenario: Rate limit for reset attempts per IP

- **WHEN** same IP makes 5 attempts to /auth/reset-password within 15 minutes
- **THEN** 6th attempt returns HTTP 429

#### Scenario: Failed reset attempts count toward limit

- **WHEN** user makes 5 failed reset attempts from same IP (invalid tokens)
- **AND** makes a 6th attempt with valid token within the window
- **THEN** the 6th attempt is rejected with HTTP 429 (limit hit, not token error)
- **AND** user must wait before retrying

> **Design note:** Unlike forgot-password, the reset endpoint cannot key by email
> because the request body only contains `token` and `password`. IP-only rate
> limiting is sufficient here because each token is single-use and the token
> itself provides brute-force protection (256-bit entropy).

### Requirement: Rate limit error message is clear

The system SHALL inform user of rate limit state and when they can retry.

#### Scenario: User receives retry-after guidance

- **WHEN** user exceeds rate limit
- **THEN** error response includes approximate time before they can retry
- **AND** message is: "Demasiados intentos. Espera aproximadamente 12 minutos." (or similar)

#### Scenario: Rate limit response includes HTTP 429 status

- **WHEN** user exceeds rate limit
- **THEN** system returns HTTP 429 (standard rate limit code)
- **AND** not confused with 400 Bad Request
