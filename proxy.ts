import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth-shared";

/**
 * Route gate for the demo sign-in.
 *
 * Runs before every page request, so typing a protected URL straight into the
 * address bar redirects to /login instead of rendering the page. That is the
 * part a client-side guard cannot do.
 *
 * ⚠️ This is a demo gate, not authorization. The session cookie is unsigned, so
 * it can be forged by anyone with dev tools, and Next's own docs note that
 * proxy "should not be used as a full session management or authorization
 * solution". Real protection belongs on the server beside the data.
 */

/** Reachable without a session. */
const PUBLIC_PATHS = ["/login"];

function landingFor(role: string): string {
  return role === "approver" ? "/approvals" : "/";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  // Already signed in and visiting /login: send them to their own workspace.
  if (PUBLIC_PATHS.includes(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL(landingFor(session.role), request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    // An API should answer, not redirect — a redirect would hand the caller
    // an HTML login page where it expected JSON.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          ok: false,
          code: "unauthenticated",
          message: "Sign in to use this endpoint.",
        },
        { status: 401 },
      );
    }

    const url = new URL("/login", request.url);
    // Remember where they were headed, so sign-in can return them there.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
