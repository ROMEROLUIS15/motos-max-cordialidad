/**
 * User-facing 429 message with an approximate wait time.
 * Shared by ForgotPasswordThrottlerGuard and ThrottlerExceptionFilter so the
 * wording stays consistent across every rate-limited endpoint.
 */
export function retryAfterMessage(minutes: number | null): string {
  if (minutes === null) return 'Demasiados intentos. Por favor, intenta más tarde.';
  return `Demasiados intentos. Espera aproximadamente ${minutes} minuto${minutes !== 1 ? 's' : ''}.`;
}
