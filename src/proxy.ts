import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/session";
import { db } from "@/db";
import { users } from "@/db/schema";

// Optimistic auth check — cookie-only, no DB hit, per Next.js guidance for
// code that runs on every request. Real authorization still happens in the
// DAL (src/lib/dal.ts) next to the data.
const protectedRoutes = ["/dashboard"];
const publicRoutes = ["/login", "/signup", "/"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route));
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decrypt(cookie);

  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublicRoute && session?.userId && path !== "/") {
    // A signed, unexpired cookie doesn't guarantee the account behind it
    // still exists — an admin can now delete an employee (deleteEmployee in
    // src/app/actions/employees.ts) out from under a still-live session.
    // Without this check, that stale cookie loops forever: /dashboard's own
    // getCurrentUser() DB check bounces them to /login because the row is
    // gone, and this rule would just bounce them straight back to
    // /dashboard again. This is the one DB call in this file — deliberately
    // confined to the rare "already has a cookie, landing on a public
    // route" case rather than every protected-route request, so the
    // no-DB-hit guarantee above still holds for the common path. Proxy
    // (formerly Middleware) runs on the Node.js runtime by default as of
    // Next.js 16, so this DB call — using the same node-postgres pool as
    // everything else — is not an Edge-runtime problem here.
    const stillExists = await db.select({ id: users.id }).from(users).where(eq(users.id, session.userId)).limit(1);
    if (stillExists.length === 0) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
