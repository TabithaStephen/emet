/**
 * Fallback profile for the first paint.
 *
 * A placeholder until authentication exists — there is no auth in this phase, so
 * this is the same identity the app already displayed, lifted into one place
 * rather than a new one invented for the welcome section.
 *
 * The real identity now comes from the signed-in session; this is only what the
 * greeting shows before the cookie has been read on the client. It mirrors the
 * Creator account in `auth-shared.ts` and must be kept in step with it.
 */
export const CURRENT_USER = {
  name: "John Doe",
  /** Used for the greeting — first names only, deliberately. */
  firstName: "John",
  role: "Brand governance lead",
  initials: "JD",
} as const;
