"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { farms } from "@/db/schema";
import { verifySession } from "@/lib/dal";
import { generateJoinCode } from "@/lib/join-code";

// Admin-only: rotates the calling admin's own farm's invite code, so a
// leaked code stops working immediately. Scoped to session.farmId — same
// pattern as createActivityLog's farm-scoped writes — so an admin can only
// ever regenerate their own farm's code, never another farm's.
export async function regenerateJoinCode() {
  const session = await verifySession();
  if (session.role !== "admin") {
    throw new Error("Only farm admins can regenerate the invite code.");
  }

  await db.update(farms).set({ joinCode: generateJoinCode() }).where(eq(farms.id, session.farmId));

  revalidatePath("/dashboard/settings");
}
