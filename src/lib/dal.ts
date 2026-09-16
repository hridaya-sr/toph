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
  };
});

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

  return user;
});
