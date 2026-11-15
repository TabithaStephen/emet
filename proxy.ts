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

/**
 * Reachable without a session.
 *
 * `/welcome` and `/login` bounce a signed-in visitor onward to their own
 * workspace — there is no reason to show them a front door they are already
 * through. `/demo` is in OPEN_PATHS instead, because a signed-in user should
 * still be able to walk the demo, for instance to show it to someone.
 */
const PUBLIC_PATHS = ["/welcome", "/login"];

/** Public, and never redirected away from, signed in or not. */
const OPEN_PATHS = ["/demo"];

function landingFor(role: string): string {
  return role === "approver" ? "/approvals" : "/";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  // The guided demo is open to everyone, in either state.
  if (OPEN_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Already signed in and visiting the front door: go to the workspace.
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

    // The bare root is a visitor arriving at the domain: show them the choice
    // between signing in and the guided demo. A deeper link is someone who
    // wants the app itself, so send them straight to sign-in and remember where
    // they were going.
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/welcome", request.url));
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
