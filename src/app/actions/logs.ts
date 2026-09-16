"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityLogTags, activityLogs, tags } from "@/db/schema";
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
