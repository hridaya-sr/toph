"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityLogTags, activityLogs, fields, tags, users } from "@/db/schema";
import { verifySession } from "@/lib/dal";
import { ACTIVITY_TYPES } from "@/lib/definitions";
import * as z from "zod";

async function assertLogBelongsToFarm(logId: string, farmId: string) {
  const rows = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(and(eq(activityLogs.id, logId), eq(activityLogs.farmId, farmId)))
    .limit(1);
  if (!rows[0]) {
    throw new Error("Log not found for this farm.");
  }
}

async function assertUserBelongsToFarm(userId: string, farmId: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.farmId, farmId)))
    .limit(1);
  if (!rows[0]) {
    throw new Error("That employee is not on this farm.");
  }
}

async function assertFieldBelongsToFarm(fieldId: string, farmId: string) {
  const rows = await db
    .select({ id: fields.id })
    .from(fields)
    .where(and(eq(fields.id, fieldId), eq(fields.farmId, farmId)))
    .limit(1);
  if (!rows[0]) {
    throw new Error("That field is not on this farm.");
  }
}

export async function addTagToLog(logId: string, tagName: string) {
  const session = await verifySession();
  const trimmed = tagName.trim();
  if (!trimmed) return;

  await assertLogBelongsToFarm(logId, session.farmId);

  // Find or create the tag for this farm.
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.farmId, session.farmId), eq(tags.name, trimmed)))
    .limit(1);

  const tag =
    existing[0] ??
    (await db.insert(tags).values({ farmId: session.farmId, name: trimmed }).returning())[0];

  await db
    .insert(activityLogTags)
    .values({ activityLogId: logId, tagId: tag.id })
    .onConflictDoNothing();

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/activity-logs");
}

export async function removeTagFromLog(logId: string, tagId: string) {
  const session = await verifySession();
  await assertLogBelongsToFarm(logId, session.farmId);

  await db
    .delete(activityLogTags)
    .where(and(eq(activityLogTags.activityLogId, logId), eq(activityLogTags.tagId, tagId)));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/activity-logs");
}

const NewLogSchema = z.object({
  employeeId: z.uuid(),
  fieldId: z.uuid().optional().or(z.literal("")),
  activityType: z.enum(ACTIVITY_TYPES),
  logDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  transcriptSummary: z.string().min(1),
});

export type NewLogState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;

export async function createActivityLog(_state: NewLogState, formData: FormData): Promise<NewLogState> {
  const session = await verifySession();

  const parsed = NewLogSchema.safeParse({
    employeeId: formData.get("employeeId"),
    fieldId: formData.get("fieldId") || undefined,
    activityType: formData.get("activityType"),
    logDate: formData.get("logDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    transcriptSummary: formData.get("transcriptSummary"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { employeeId, fieldId, activityType, logDate, startTime, endTime, transcriptSummary } =
    parsed.data;

  // Authorization: an employee may only log work under their own name.
  // Only an admin may attribute a log to someone else — and even then,
  // only to someone on their own farm.
  if (session.role !== "admin" && employeeId !== session.userId) {
    return { message: "You can only create logs under your own name." };
  }
  await assertUserBelongsToFarm(employeeId, session.farmId);
  if (fieldId) {
    await assertFieldBelongsToFarm(fieldId, session.farmId);
  }

  await db.insert(activityLogs).values({
    farmId: session.farmId,
    employeeId,
    fieldId: fieldId || null,
    activityType,
    logDate,
    startTime,
    endTime,
    audioDurationSeconds: 0,
    transcriptSummary,
    transcriptQA: [
      {
        key: "manual_entry",
        prompt: "Manually entered by an admin (no audio recording for this log).",
        answer: transcriptSummary,
      },
    ],
    responseAccuracy: 100,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/activity-logs");
  return { message: "success" };
}

// Bulk delete for the activity log table's row-selection toolbar. Scoped
// entirely through the WHERE clause rather than a pre-check-then-delete: an
// employee's farmId+employeeId filter means any ids outside what they're
// allowed to touch (a coworker's log, another farm's log) are simply not
// matched and silently no-op, the same IDOR-safe shape as the rest of this
// file — there's no separate authorization check to forget to write.
export async function deleteActivityLogs(logIds: string[]) {
  const session = await verifySession();
  const ids = logIds.filter(Boolean);
  if (ids.length === 0) return;

  const scope =
    session.role === "admin"
      ? and(eq(activityLogs.farmId, session.farmId), inArray(activityLogs.id, ids))
      : and(
          eq(activityLogs.farmId, session.farmId),
          eq(activityLogs.employeeId, session.userId),
          inArray(activityLogs.id, ids)
        );

  await db.delete(activityLogs).where(scope);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/activity-logs");
}
