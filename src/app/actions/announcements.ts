"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { announcements, announcementReads } from "@/db/schema";
import { verifySession, assertNotImpersonating } from "@/lib/dal";
import { AnnouncementFormSchema, AnnouncementFormState } from "@/lib/definitions";

// Admin-only, farm-scoped — a real check server-side, not just a hidden
// button, same standard as every other admin-only write in this app.
export async function postAnnouncement(
  _state: AnnouncementFormState,
  formData: FormData
): Promise<AnnouncementFormState> {
  const session = await verifySession();
  if (session.role !== "admin") {
    return { message: "Only farm admins can post announcements." };
  }

  const parsed = AnnouncementFormSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await db.insert(announcements).values({
    farmId: session.farmId,
    authorId: session.userId,
    body: parsed.data.body,
  });

  revalidatePath("/dashboard/messages");
  return { message: "success" };
}

// Marking an announcement read/unread is per-viewer state, not a farm-wide
// write, so unlike postAnnouncement it's open to any farm member — just
// blocked during spectator mode, like every other write reachable from an
// employee-role session.
export async function markAnnouncementRead(announcementId: string) {
  const session = await verifySession();
  assertNotImpersonating(session);

  await db
    .insert(announcementReads)
    .values({ announcementId, userId: session.userId })
    .onConflictDoNothing();

  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard", "layout");
}

export async function markAnnouncementUnread(announcementId: string) {
  const session = await verifySession();
  assertNotImpersonating(session);

  await db
    .delete(announcementReads)
    .where(and(eq(announcementReads.announcementId, announcementId), eq(announcementReads.userId, session.userId)));

  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard", "layout");
}
