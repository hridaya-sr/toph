import "server-only";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { db } from "@/db";
import { activityLogs, activityLogTags, farms, fields, tags, users } from "@/db/schema";
import { ACTIVITY_TYPES } from "@/lib/definitions";
import { logStartTimestamp } from "@/lib/time";

export type ActivityLogFilters = {
  // Scope to one employee's own logs (the existing per-role authorization
  // pattern used across this file) rather than the whole farm.
  employeeId?: string;
  activityType?: (typeof ACTIVITY_TYPES)[number];
  // Inclusive SQL-level date bounds (YYYY-MM-DD) — covers both "This Month"
  // and the date portion of the Date & Time Range filter.
  startDate?: string;
  endDate?: string;
  // Precise date+time bounds for the Date & Time Range filter. logDate and
  // startTime aren't backed by a real timestamp column (startTime is free
  // text like "6:00 AM"), so this narrowing happens in application code
  // against the already SQL-date-scoped rows below, rather than as a SQL
  // WHERE clause — the unfiltered farm-wide row set is never what's sent
  // back, only this final, precisely-scoped result is.
  rangeStart?: Date;
  rangeEnd?: Date;
  sort?: "asc" | "desc";
  limit?: number;
};

export async function getActivityLogsForFarm(farmId: string, filters: ActivityLogFilters = {}) {
  const conditions = [eq(activityLogs.farmId, farmId)];
  if (filters.employeeId) conditions.push(eq(activityLogs.employeeId, filters.employeeId));
  if (filters.activityType) conditions.push(eq(activityLogs.activityType, filters.activityType));
  if (filters.startDate) conditions.push(gte(activityLogs.logDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(activityLogs.logDate, filters.endDate));

  const baseQuery = db
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
    .where(and(...conditions))
    .orderBy(filters.sort === "asc" ? asc(activityLogs.recordedAt) : desc(activityLogs.recordedAt));

  const rows = filters.limit !== undefined ? await baseQuery.limit(filters.limit) : await baseQuery;

  const scopedRows =
    filters.rangeStart && filters.rangeEnd
      ? rows.filter((r) => {
          const ts = logStartTimestamp(r.logDate, r.startTime);
          return ts !== null && ts >= filters.rangeStart!.getTime() && ts <= filters.rangeEnd!.getTime();
        })
      : rows;

  const logIds = scopedRows.map((r) => r.id);
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

  return scopedRows.map((r) => ({ ...r, tags: tagsByLog.get(r.id) ?? [] }));
}

// Aggregate stats for a single employee's dashboard card ("Your logs this
// month" / "Last logged"). Computed independently from the recent-logs list
// (which is now limited to a handful of rows) so these numbers stay correct
// regardless of that limit — the same reasoning getDashboardStats already
// uses for the admin-facing stat cards.
export async function getEmployeeMonthStats(farmId: string, employeeId: string) {
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const [monthRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.farmId, farmId),
        eq(activityLogs.employeeId, employeeId),
        gte(activityLogs.logDate, monthStart),
        lte(activityLogs.logDate, monthEnd)
      )
    );

  const [lastRow] = await db
    .select({ logDate: activityLogs.logDate })
    .from(activityLogs)
    .where(and(eq(activityLogs.farmId, farmId), eq(activityLogs.employeeId, employeeId)))
    .orderBy(desc(activityLogs.recordedAt))
    .limit(1);

  return {
    logsThisMonth: monthRow?.count ?? 0,
    lastLogDate: lastRow?.logDate ?? null,
  };
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

// IDs of today's logs, newest first — the same "today" window as
// getDashboardStats' todaysRecordings, so the sidebar badge count and the
// number of highlighted rows always agree.
export async function getTodaysNewLogIds(farmId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(and(eq(activityLogs.farmId, farmId), gte(activityLogs.recordedAt, startOfToday)))
    .orderBy(desc(activityLogs.recordedAt));

  return rows.map((r) => r.id);
}

// Every log id currently visible to this viewer (all of the farm's for an
// admin, just their own for an employee — matching the scoping already
// applied to the logs list itself). Used to validate manually-marked-unread
// overrides in sessionStorage: without this, marking an old log unread and
// then later deleting it (or losing access to it) would leave a phantom
// entry that inflates the sidebar badge forever, since nothing else ever
// tells the client that id stopped being real.
export async function getKnownLogIds(farmId: string, employeeId?: string) {
  const rows = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(
      employeeId
        ? and(eq(activityLogs.farmId, farmId), eq(activityLogs.employeeId, employeeId))
        : eq(activityLogs.farmId, farmId)
    );
  return rows.map((r) => r.id);
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
      avatarImage: users.avatarImage,
    })
    .from(users)
    .where(eq(users.farmId, farmId))
    .orderBy(users.name);
}

export async function getFarmFields(farmId: string) {
  return db.select().from(fields).where(eq(fields.farmId, farmId)).orderBy(fields.name);
}

// Admin-only in practice (only rendered to an admin session in the
// Settings page), but the query itself is just a lookup — callers are
// responsible for the role check, same as every other query in this file.
export async function getFarmJoinCode(farmId: string) {
  const rows = await db.select({ joinCode: farms.joinCode }).from(farms).where(eq(farms.id, farmId)).limit(1);
  return rows[0]?.joinCode ?? null;
}

export async function getFarmUserById(farmId: string, userId: string) {
  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.farmId, farmId)))
    .limit(1);
  return rows[0] ?? null;
}
