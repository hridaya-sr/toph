"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { verifySession } from "@/lib/dal";
import { ACTIVITY_TYPES, ShiftFormSchema, ShiftFormState } from "@/lib/definitions";
import { assertUserBelongsToFarm, assertFieldBelongsToFarm, insertActivityLog } from "@/app/actions/logs";

async function assertShiftBelongsToFarm(shiftId: string, farmId: string) {
  const rows = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), eq(shifts.farmId, farmId)))
    .limit(1);
  if (!rows[0]) {
    throw new Error("Shift not found for this farm.");
  }
}

function revalidateSchedule() {
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard");
}

export async function createShift(_state: ShiftFormState, formData: FormData): Promise<ShiftFormState> {
  const session = await verifySession();
  if (session.role !== "admin") {
    return { message: "Only farm admins can create shifts." };
  }

  const parsed = ShiftFormSchema.safeParse({
    employeeId: formData.get("employeeId"),
    fieldId: formData.get("fieldId") || undefined,
    activityType: formData.get("activityType") || undefined,
    shiftDate: formData.get("shiftDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { employeeId, fieldId, activityType, shiftDate, startTime, endTime } = parsed.data;

  await assertUserBelongsToFarm(employeeId, session.farmId);
  if (fieldId) {
    await assertFieldBelongsToFarm(fieldId, session.farmId);
  }

  await db.insert(shifts).values({
    farmId: session.farmId,
    employeeId,
    fieldId: fieldId || null,
    activityType: activityType || null,
    shiftDate,
    startTime,
    endTime,
    status: "scheduled",
    createdByAdminId: session.userId,
  });

  revalidateSchedule();
  return { message: "success" };
}

export async function updateShift(shiftId: string, _state: ShiftFormState, formData: FormData): Promise<ShiftFormState> {
  const session = await verifySession();
  if (session.role !== "admin") {
    return { message: "Only farm admins can edit shifts." };
  }
  await assertShiftBelongsToFarm(shiftId, session.farmId);

  const parsed = ShiftFormSchema.safeParse({
    employeeId: formData.get("employeeId"),
    fieldId: formData.get("fieldId") || undefined,
    activityType: formData.get("activityType") || undefined,
    shiftDate: formData.get("shiftDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { employeeId, fieldId, activityType, shiftDate, startTime, endTime } = parsed.data;

  await assertUserBelongsToFarm(employeeId, session.farmId);
  if (fieldId) {
    await assertFieldBelongsToFarm(fieldId, session.farmId);
  }

  await db
    .update(shifts)
    .set({
      employeeId,
      fieldId: fieldId || null,
      activityType: activityType || null,
      shiftDate,
      startTime,
      endTime,
      createdByAdminId: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(shifts.id, shiftId));

  revalidateSchedule();
  return { message: "success" };
}

export async function deleteShift(shiftId: string) {
  const session = await verifySession();
  if (session.role !== "admin") {
    throw new Error("Only farm admins can delete shifts.");
  }
  await assertShiftBelongsToFarm(shiftId, session.farmId);

  await db.delete(shifts).where(eq(shifts.id, shiftId));

  revalidateSchedule();
}

const CompleteShiftSchema = z.object({
  // Only used when the shift itself has no activityType set — otherwise
  // the shift's own value is authoritative and this is ignored, same as
  // fieldId below and shiftDate/startTime/endTime, which never come from
  // client input at all.
  activityType: z.enum(ACTIVITY_TYPES).optional().or(z.literal("")),
  // Only used when the shift itself has no field set — otherwise the
  // shift's own fieldId is authoritative and this is ignored, same as
  // shiftDate/startTime/endTime below never coming from client input.
  fieldId: z.uuid().optional().or(z.literal("")),
  transcriptSummary: z.string().min(1, { error: "Add a quick summary of the work." }),
});

export type CompleteShiftState =
  | {
      errors?: {
        activityType?: string[];
        fieldId?: string[];
        transcriptSummary?: string[];
      };
      message?: string;
    }
  | undefined;

// Employee side: turns a scheduled shift into a real activity log. The
// resulting log's date/time/employee come from the shift record itself —
// never from formData — so this can't be used to backdate or reattribute
// a log despite taking a form submission.
export async function completeShiftAndCreateLog(
  shiftId: string,
  _state: CompleteShiftState,
  formData: FormData
): Promise<CompleteShiftState> {
  const session = await verifySession();
  if (session.impersonatedBy) {
    return { message: "You're viewing as this user — switch back to your own account to mark shifts done." };
  }

  const shiftRows = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), eq(shifts.farmId, session.farmId)))
    .limit(1);
  const shift = shiftRows[0];

  if (!shift) {
    return { message: "Shift not found." };
  }
  // An employee may only complete their own shift — never a coworker's,
  // regardless of what shiftId is passed in.
  if (shift.employeeId !== session.userId) {
    return { message: "You can only complete your own shifts." };
  }
  if (shift.status === "completed") {
    return { message: "This shift has already been marked done." };
  }

  const parsed = CompleteShiftSchema.safeParse({
    // formData.get returns null (not undefined) for a field that isn't in
    // the form at all — which it won't be when the activity is already
    // locked, since the picker is hidden entirely in that case. The schema
    // only accepts undefined/"", so null needs normalizing first, same as
    // fieldId already does.
    activityType: formData.get("activityType") || undefined,
    fieldId: formData.get("fieldId") || undefined,
    transcriptSummary: formData.get("transcriptSummary"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { activityType: submittedActivityType, fieldId, transcriptSummary } = parsed.data;

  // The shift's own activity type wins if the admin set one; otherwise the
  // employee's choice from the form is what gets used.
  const resolvedActivityType = shift.activityType || submittedActivityType || undefined;
  if (!resolvedActivityType) {
    return { errors: { activityType: ["Choose an activity type."] } };
  }

  // The shift's own field wins if it has one; otherwise the employee may
  // pick one now, validated the same way any other field selection is.
  let resolvedFieldId = shift.fieldId;
  if (!resolvedFieldId && fieldId) {
    await assertFieldBelongsToFarm(fieldId, session.farmId);
    resolvedFieldId = fieldId;
  }

  const log = await insertActivityLog({
    farmId: session.farmId,
    employeeId: session.userId,
    fieldId: resolvedFieldId,
    activityType: resolvedActivityType,
    logDate: shift.shiftDate,
    startTime: shift.startTime,
    endTime: shift.endTime,
    transcriptSummary,
  });

  await db
    .update(shifts)
    .set({ status: "completed", activityLogId: log.id, updatedAt: new Date() })
    .where(eq(shifts.id, shiftId));

  revalidateSchedule();
  revalidatePath("/dashboard/activity-logs");
  return { message: "success" };
}
