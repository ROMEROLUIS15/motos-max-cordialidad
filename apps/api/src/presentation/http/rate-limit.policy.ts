/**
 * Rate-limiting policy for the global throttlers registered in `app.module.ts`.
 *
 * The ceilings are not round numbers picked by feel: they are derived from what
 * a legitimate caller actually does. The web client keeps some screens fresh on
 * a timer (`usePolling`), so those routes receive a steady, predictable rate
 * with the app merely open. A limit below that rate would throttle normal use —
 * and it would do so invisibly, since a background refresh has no user watching
 * it fail. `rate-limit.policy.spec.ts` pins these numbers against the client's
 * real polling intervals so the two can never drift apart unnoticed.
 *
 * Auth routes are not covered by these ceilings: they carry their own, much
 * tighter `@Throttle()` overrides (login, refresh, reset-password) because
 * there the caller is anonymous and the threat is credential guessing, not
 * usage. See docs/SECURITY.md.
 */

/** Fastest polling interval used by the web client (`usePolling`). */
export const CLIENT_POLL_INTERVAL_MS = 30_000;

/** Requests one polling screen sends per hour with the tab simply open. */
export const CLIENT_POLL_REQUESTS_PER_HOUR = 3_600_000 / CLIENT_POLL_INTERVAL_MS; // 120

/**
 * Headroom over the client's own traffic. Covers a user working on top of the
 * polling, a reload, and the fact that `usePolling` fires an extra request when
 * a hidden tab becomes visible again.
 */
export const RATE_LIMIT_HEADROOM = 5;

/** 60/minute per caller per route: absorbs bursts, ~30x the polling rate. */
export const RATE_LIMIT_PER_MINUTE = 60;

/** 600/hour per caller per route: 5x what a polling screen generates. */
export const RATE_LIMIT_PER_HOUR = CLIENT_POLL_REQUESTS_PER_HOUR * RATE_LIMIT_HEADROOM; // 600
