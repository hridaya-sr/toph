import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "./session";
import { db } from "@/db";
import { users, farms } from "@/db/schema";

export const verifySession = cache(async () => {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  return {
    isAuth: true,
    userId: session.userId,
    farmId: session.farmId,
    role: session.role,
    impersonatedBy: session.impersonatedBy ?? null,
  };
});

// "Switch User" (see switchUser/returnToAdmin in actions/auth.ts) lets an
// admin see exactly what an employee sees, but that's meant to be read-
// only spectating, not a way to act as them — an admin should never be
// able to create a log, complete a shift, or edit a profile "as" someone
// else just by impersonating them. Every write that's reachable from an
// employee-role session (as opposed to writes already gated by an
// explicit role === "admin" check, which impersonation can't bypass
// anyway since the impersonated session's role is the target user's, not
// the admin's own) calls this first.
export function assertNotImpersonating(session: { impersonatedBy: string | null }) {
  if (session.impersonatedBy) {
    throw new Error("You're viewing as this user — switch back to your own account to make changes.");
  }
}

// Like verifySession, but returns null instead of redirecting.
// Useful in places (e.g. root page, proxy-adjacent checks) that need to
// branch on auth state rather than force a redirect.
export const getOptionalSession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) return null;
  return {
    isAuth: true,
    userId: session.userId,
    farmId: session.farmId,
    role: session.role,
  };
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarColor: users.avatarColor,
      avatarImage: users.avatarImage,
      farmId: users.farmId,
      farmName: farms.name,
    })
    .from(users)
    .innerJoin(farms, eq(users.farmId, farms.id))
    .where(eq(users.id, session.userId))
    .limit(1);

  const user = rows[0];
  if (!user) {
    redirect("/login");
  }

  return { ...user, impersonatedBy: session.impersonatedBy };
});
