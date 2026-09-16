import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, activityLogTags, fields, tags, users } from "@/db/schema";

export async function getActivityLogsForFarm(farmId: string) {
  const rows = await db
    .select({
      id: activityLogs.id,
      activityType: activityLogs.activityType,
      logDate: activityLogs.logDate,
      startTime: activityLogs.startTime,
      endTime: activityLogs.endTime,
      audioDurationSeconds: activityLogs.audioDurationSeconds,
      transcriptSummary: activityLogs.transcriptSummary,
      transcriptQA: activityLogs.transcriptQA,
      responseAccuracy: activityLogs.responseAccuracy,
      recordedAt: activityLogs.recordedAt,
      employeeId: users.id,
      employeeName: users.name,
      employeeAvatarColor: users.avatarColor,
      fieldId: fields.id,
      fieldName: fields.name,
      fieldCenterLat: fields.centerLat,
      fieldCenterLng: fields.centerLng,
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.employeeId, users.id))
    .leftJoin(fields, eq(activityLogs.fieldId, fields.id))
    .where(eq(activityLogs.farmId, farmId))
    .orderBy(desc(activityLogs.recordedAt));

  const logIds = rows.map((r) => r.id);
  const tagRows = logIds.length
    ? await db
        .select({
          logId: activityLogTags.activityLogId,
          tagId: tags.id,
          tagName: tags.name,
        })
        .from(activityLogTags)
        .innerJoin(tags, eq(activityLogTags.tagId, tags.id))
        .where(sql`${activityLogTags.activityLogId} IN ${logIds}`)
    : [];

  const tagsByLog = new Map<string, { id: string; name: string }[]>();
  for (const t of tagRows) {
    const list = tagsByLog.get(t.logId) ?? [];
    list.push({ id: t.tagId, name: t.tagName });
    tagsByLog.set(t.logId, list);
  }

  return rows.map((r) => ({ ...r, tags: tagsByLog.get(r.id) ?? [] }));
}

export async function getDashboardStats(farmId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todaysRecordingsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLogs)
    .where(and(eq(activityLogs.farmId, farmId), gte(activityLogs.recordedAt, startOfToday)));

  const [activeWorkersRow] = await db
    .select({ count: sql<number>`count(distinct ${activityLogs.employeeId})::int` })
    .from(activityLogs)
    .where(eq(activityLogs.farmId, farmId));

  const [accuracyRow] = await db
    .select({ avg: sql<number>`coalesce(round(avg(${activityLogs.responseAccuracy})), 0)::int` })
    .from(activityLogs)
    .where(eq(activityLogs.farmId, farmId));

  return {
    todaysRecordings: todaysRecordingsRow?.count ?? 0,
    activeWorkers: activeWorkersRow?.count ?? 0,
    responseAccuracy: accuracyRow?.avg ?? 0,
  };
}

export async function getFarmTags(farmId: string) {
  return db.select().from(tags).where(eq(tags.farmId, farmId)).orderBy(tags.name);
}

export async function getFarmEmployees(farmId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarColor: users.avatarColor,
    })
    .from(users)
    .where(eq(users.farmId, farmId))
    .orderBy(users.name);
}

export async function getFarmFields(farmId: string) {
  return db.select().from(fields).where(eq(fields.farmId, farmId)).orderBy(fields.name);
}
