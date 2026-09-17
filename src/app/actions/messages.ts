"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { directMessages } from "@/db/schema";
import { verifySession, assertNotImpersonating } from "@/lib/dal";
import { DirectMessageSchema, DirectMessageState } from "@/lib/definitions";
import { assertUserBelongsToFarm } from "@/app/actions/logs";

// Any farm member can message any other farm member — admin-to-employee,
// employee-to-employee, either direction. Scoped to the sender's own farm
// the same way every other write in this app is.
export async function sendDirectMessage(
  _state: DirectMessageState,
  formData: FormData
): Promise<DirectMessageState> {
  const session = await verifySession();
  assertNotImpersonating(session);

  const parsed = DirectMessageSchema.safeParse({
    recipientId: formData.get("recipientId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { recipientId, body } = parsed.data;

  if (recipientId === session.userId) {
    return { message: "You can't message yourself." };
  }
  await assertUserBelongsToFarm(recipientId, session.farmId);

  await db.insert(directMessages).values({
    farmId: session.farmId,
    senderId: session.userId,
    recipientId,
    body,
  });

  revalidatePath("/dashboard/messages");
  return { message: "success" };
}

// Marks every message FROM otherUserId TO the caller as read — called when
// the caller opens that conversation. Scoped to recipientId = the caller,
// so this can only ever mark the caller's own inbox read, never anyone
// else's.
export async function markConversationRead(otherUserId: string) {
  const session = await verifySession();
  assertNotImpersonating(session);

  await db
    .update(directMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(directMessages.farmId, session.farmId),
        eq(directMessages.senderId, otherUserId),
        eq(directMessages.recipientId, session.userId)
      )
    );

  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard", "layout");
}
