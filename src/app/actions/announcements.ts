"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { verifySession } from "@/lib/dal";
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
