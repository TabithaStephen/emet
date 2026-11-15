/**
 * Demo sign-in for the prototype.
 *
 * ⚠️ NOT REAL AUTHENTICATION. Credentials are compared in the browser against
 * the list below, and the session is a plain cookie with no signature. Anyone
 * who can open dev tools can forge it. It exists so the product can demonstrate
 * two distinct roles and a route gate; it is not a security boundary, and it
 * must be replaced by a real identity provider before anything ships.
 *
 * The credentials here were NOT specified anywhere earlier in the project — no
 * prior login, role or password definition exists in the codebase. They are a
 * reasonable set, deliberately obvious, and shown on the sign-in screen so the
 * demo needs no cheat sheet. Change them freely.
 */

export type Role = "creator" | "approver";

export interface DemoAccount {
  email: string;
  password: string;
  role: Role;
  name: string;
  firstName: string;
  jobTitle: string;
  initials: string;
  /** Where this role lands after signing in. */
  landing: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "john.doe@emet.demo",
    password: "creator123",
    role: "creator",
    name: "John Doe",
    firstName: "John",
    jobTitle: "Brand governance lead",
    initials: "JD",
    landing: "/",
  },
  {
    email: "approver@emet.app",
    password: "approver123",
    role: "approver",
    name: "Rafael Castellan",
    firstName: "Rafael",
    jobTitle: "Compliance approver",
    initials: "RC",
    landing: "/approvals",
  },
];

export const ROLE_LABEL: Record<Role, string> = {
  creator: "Creator",
  approver: "Approver",
};

export const ROLE_BLURB: Record<Role, string> = {
  creator: "Define brand rules, run audits, submit work for review.",
  approver: "Review flagged content and approve or return it.",
};

/** Cookie the route gate reads. Readable by the server, hence not localStorage. */
export const SESSION_COOKIE = "emet_session";

export interface Session {
  email: string;
  role: Role;
  name: string;
  firstName: string;
  jobTitle: string;
  initials: string;
}

export function accountFor(role: Role): DemoAccount {
  return DEMO_ACCOUNTS.find((a) => a.role === role) ?? DEMO_ACCOUNTS[0];
}

/**
 * Checks an email and password against the demo list.
 * Returns the session on success, or null. Comparison is case-insensitive on
 * the email and exact on the password.
 */
export function authenticate(
  email: string,
  password: string,
  role: Role,
): Session | null {
  const account = DEMO_ACCOUNTS.find(
    (a) =>
      a.role === role &&
      a.email.toLowerCase() === email.trim().toLowerCase() &&
      a.password === password,
  );
  if (!account) return null;
  return {
    email: account.email,
    role: account.role,
    name: account.name,
    firstName: account.firstName,
    jobTitle: account.jobTitle,
    initials: account.initials,
  };
}

/** Serialises a session for the cookie. Encoded, NOT encrypted or signed. */
export function encodeSession(session: Session): string {
  return encodeURIComponent(JSON.stringify(session));
}

export function decodeSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<Session>;
    if (
      typeof parsed?.email === "string" &&
      (parsed.role === "creator" || parsed.role === "approver") &&
      typeof parsed.name === "string"
    ) {
      return {
        email: parsed.email,
        role: parsed.role,
        name: parsed.name,
        firstName: parsed.firstName ?? parsed.name.split(" ")[0],
        jobTitle: parsed.jobTitle ?? "",
        initials: parsed.initials ?? parsed.name.slice(0, 2).toUpperCase(),
      };
    }
  } catch {
    // Malformed cookie: treat as signed out.
  }
  return null;
}

/**
 * Validates a `?next=` redirect target.
 *
 * Only internal, single-slash paths are accepted. Anything absolute, scheme
 * relative (`//host`), or otherwise foreign returns null, so the sign-in screen
 * can never be used to bounce someone to another site.
 */
export function safeNextPath(raw: string | string[] | undefined): string | null {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== "string") return null;
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;
  // A backslash can be normalised to a slash by some browsers.
  if (candidate.includes("\\")) return null;
  return candidate;
}
