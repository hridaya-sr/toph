import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { db } from "@/db";
import {
  activityLogs,
  activityLogTags,
  announcements,
  announcementReads,
  directMessages,
  farms,
  fields,
  shifts,
  tags,
  users,
} from "@/db/schema";
import { ACTIVITY_TYPES } from "@/lib/definitions";
import { logStartTimestamp } from "@/lib/time";

export type ActivityLogFilters = {
  // Scope to one employee's own logs (the existing per-role authorization
  // pattern used across this file) rather than the whole farm.
  employeeId?: string;
  activityType?: (typeof ACTIVITY_TYPES)[number];
  fieldId?: string;
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
  if (filters.fieldId) conditions.push(eq(activityLogs.fieldId, filters.fieldId));
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
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.farmId, farmId))
    .orderBy(users.name);
}

// Drives the Employees nav badge — employees (not admins) who joined the
// farm today, whether via an admin creating their account or self-serve
// via the invite code. Same "count of things today, no dismissal" shape
// as getScheduledShiftCountForEmployee, for the same reason: this is a
// standing fact ("N people joined today"), not a per-viewer dismissible
// stream.
export async function getNewEmployeeCountToday(farmId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.farmId, farmId), eq(users.role, "employee"), gte(users.createdAt, startOfToday)));
  return row?.count ?? 0;
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

// ---------- Schedule ----------

// Farm-scoped, date-range-scoped, with an optional employeeId filter for
// the employee-scoped calendar view — same shared-function-with-optional-
// filter shape as getActivityLogsForFarm.
export async function getShiftsForFarm(
  farmId: string,
  weekStart: string,
  weekEnd: string,
  employeeId?: string
) {
  const conditions = [eq(shifts.farmId, farmId), gte(shifts.shiftDate, weekStart), lte(shifts.shiftDate, weekEnd)];
  if (employeeId) conditions.push(eq(shifts.employeeId, employeeId));

  return db
    .select({
      id: shifts.id,
      activityType: shifts.activityType,
      shiftDate: shifts.shiftDate,
      startTime: shifts.startTime,
      endTime: shifts.endTime,
      status: shifts.status,
      activityLogId: shifts.activityLogId,
      employeeId: users.id,
      employeeName: users.name,
      employeeAvatarColor: users.avatarColor,
      employeeAvatarImage: users.avatarImage,
      fieldId: fields.id,
      fieldName: fields.name,
    })
    .from(shifts)
    .innerJoin(users, eq(shifts.employeeId, users.id))
    .leftJoin(fields, eq(shifts.fieldId, fields.id))
    .where(and(...conditions))
    .orderBy(asc(shifts.shiftDate));
}

// Drives the Schedule nav badge — every currently-scheduled (not yet
// completed) shift assigned to this employee, with no time window and no
// session-based dismissal. This is a deliberately different definition
// than the Dashboard badge (today's new activity logs, dismissed per
// browser tab via sessionStorage — see new-logs-context.tsx): a shift
// assignment isn't a "today" event, it's a standing to-do, so "how many
// of my shifts still need action" is the more honest count. See the
// session's final report for the full reasoning.
export async function getScheduledShiftCountForEmployee(farmId: string, employeeId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shifts)
    .where(and(eq(shifts.farmId, farmId), eq(shifts.employeeId, employeeId), eq(shifts.status, "scheduled")));
  return row?.count ?? 0;
}

// ---------- Audit Manager ----------

const FLAG_ACCURACY_THRESHOLD = 85;
const FLAG_TAG_NAMES = ["Low Confidence", "Follow-up"];

// Logs that warrant admin attention: unreviewed, and either a low
// responseAccuracy or carrying one of the flagged tags. Reviewed logs
// (reviewedAt set) never appear here regardless of accuracy/tags.
export async function getFlaggedLogsForReview(farmId: string) {
  const rows = await db
    .select({
      id: activityLogs.id,
      activityType: activityLogs.activityType,
      logDate: activityLogs.logDate,
      startTime: activityLogs.startTime,
      endTime: activityLogs.endTime,
      transcriptSummary: activityLogs.transcriptSummary,
      transcriptQA: activityLogs.transcriptQA,
      responseAccuracy: activityLogs.responseAccuracy,
      recordedAt: activityLogs.recordedAt,
      audioDurationSeconds: activityLogs.audioDurationSeconds,
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
    .where(and(eq(activityLogs.farmId, farmId), isNull(activityLogs.reviewedAt)))
    .orderBy(desc(activityLogs.recordedAt));

  const logIds = rows.map((r) => r.id);
  const tagRows = logIds.length
    ? await db
        .select({ logId: activityLogTags.activityLogId, tagId: tags.id, tagName: tags.name })
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

  return rows
    .map((r) => ({ ...r, tags: tagsByLog.get(r.id) ?? [] }))
    .filter(
      (r) =>
        r.responseAccuracy < FLAG_ACCURACY_THRESHOLD || r.tags.some((t) => FLAG_TAG_NAMES.includes(t.name))
    );
}

// Cheap count for the Audit Manager (and Reports — see the session's final
// report for why Reports reuses this) nav badges. Same flagging rule as
// getFlaggedLogsForReview, but only selects what's needed to compute it,
// since this runs on every dashboard page load rather than just the audit
// queue itself.
export async function getFlaggedLogCountForReview(farmId: string) {
  const rows = await db
    .select({ id: activityLogs.id, responseAccuracy: activityLogs.responseAccuracy })
    .from(activityLogs)
    .where(and(eq(activityLogs.farmId, farmId), isNull(activityLogs.reviewedAt)));

  const logIds = rows.map((r) => r.id);
  const tagRows = logIds.length
    ? await db
        .select({ logId: activityLogTags.activityLogId, tagName: tags.name })
        .from(activityLogTags)
        .innerJoin(tags, eq(activityLogTags.tagId, tags.id))
        .where(sql`${activityLogTags.activityLogId} IN ${logIds}`)
    : [];
  const flaggedTagLogIds = new Set(
    tagRows.filter((t) => FLAG_TAG_NAMES.includes(t.tagName)).map((t) => t.logId)
  );

  return rows.filter((r) => r.responseAccuracy < FLAG_ACCURACY_THRESHOLD || flaggedTagLogIds.has(r.id)).length;
}

// ---------- Reports ----------

// Raw rows for the selected date range — aggregation (hours per employee,
// activity-type breakdown, average accuracy) happens in the Reports view
// itself, since it needs to parse the free-text startTime/endTime the same
// way src/lib/time.ts already does for the Date & Time Range filter.
export async function getFarmActivityLogsForReport(farmId: string, startDate: string, endDate: string) {
  return db
    .select({
      id: activityLogs.id,
      employeeId: users.id,
      employeeName: users.name,
      activityType: activityLogs.activityType,
      startTime: activityLogs.startTime,
      endTime: activityLogs.endTime,
      responseAccuracy: activityLogs.responseAccuracy,
      logDate: activityLogs.logDate,
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.employeeId, users.id))
    .where(
      and(eq(activityLogs.farmId, farmId), gte(activityLogs.logDate, startDate), lte(activityLogs.logDate, endDate))
    )
    .orderBy(desc(activityLogs.logDate));
}

// ---------- Messages (farm-wide announcement board) ----------

// readAt here is THIS viewer's own read state (from the announcementReads
// join table), not a farm-wide property of the announcement — the same
// announcement row is unread for one viewer and read for another.
export async function getAnnouncementsForFarm(farmId: string, viewerId: string) {
  return db
    .select({
      id: announcements.id,
      body: announcements.body,
      createdAt: announcements.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorAvatarColor: users.avatarColor,
      authorAvatarImage: users.avatarImage,
      readAt: announcementReads.readAt,
    })
    .from(announcements)
    .innerJoin(users, eq(announcements.authorId, users.id))
    .leftJoin(
      announcementReads,
      and(eq(announcementReads.announcementId, announcements.id), eq(announcementReads.userId, viewerId))
    )
    .where(eq(announcements.farmId, farmId))
    .orderBy(desc(announcements.createdAt));
}

// Drives the Announcements tab badge.
export async function getUnreadAnnouncementCountForUser(farmId: string, userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(announcements)
    .leftJoin(
      announcementReads,
      and(eq(announcementReads.announcementId, announcements.id), eq(announcementReads.userId, userId))
    )
    .where(and(eq(announcements.farmId, farmId), isNull(announcementReads.readAt)));
  return row?.count ?? 0;
}

// ---------- Direct messages (private 1:1) ----------

export async function getFarmMembersForMessaging(farmId: string, excludeUserId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      avatarColor: users.avatarColor,
      avatarImage: users.avatarImage,
    })
    .from(users)
    .where(and(eq(users.farmId, farmId), ne(users.id, excludeUserId)))
    .orderBy(users.name);
}

// One row per person this user has exchanged messages with, newest-first,
// with an unread count scoped to messages THEY sent that this user hasn't
// opened yet. There's no separate conversation/thread table — a
// "conversation" is just every direct_messages row between these two
// userIds, grouped in application code since farm-scale message volume
// doesn't call for a window-function query.
export async function getConversationsForUser(farmId: string, userId: string) {
  const rows = await db
    .select({
      senderId: directMessages.senderId,
      recipientId: directMessages.recipientId,
      body: directMessages.body,
      createdAt: directMessages.createdAt,
      readAt: directMessages.readAt,
    })
    .from(directMessages)
    .where(
      and(eq(directMessages.farmId, farmId), or(eq(directMessages.senderId, userId), eq(directMessages.recipientId, userId)))
    )
    .orderBy(desc(directMessages.createdAt));

  const byOther = new Map<string, { lastBody: string; lastCreatedAt: Date; lastFromMe: boolean; unread: number }>();
  for (const row of rows) {
    const otherId = row.senderId === userId ? row.recipientId : row.senderId;
    const isUnreadForMe = row.recipientId === userId && row.readAt === null;
    const existing = byOther.get(otherId);
    if (!existing) {
      byOther.set(otherId, {
        lastBody: row.body,
        lastCreatedAt: row.createdAt,
        lastFromMe: row.senderId === userId,
        unread: isUnreadForMe ? 1 : 0,
      });
    } else if (isUnreadForMe) {
      existing.unread += 1;
    }
  }

  if (byOther.size === 0) return [];

  const otherIds = Array.from(byOther.keys());
  const otherUsers = await db
    .select({ id: users.id, name: users.name, avatarColor: users.avatarColor, avatarImage: users.avatarImage })
    .from(users)
    .where(inArray(users.id, otherIds));
  const userById = new Map(otherUsers.map((u) => [u.id, u]));

  return otherIds
    .map((id) => {
      const conv = byOther.get(id);
      const other = userById.get(id);
      if (!conv || !other) return null;
      return {
        otherUserId: id,
        otherUserName: other.name,
        otherUserAvatarColor: other.avatarColor,
        otherUserAvatarImage: other.avatarImage,
        lastBody: conv.lastBody,
        lastCreatedAt: conv.lastCreatedAt,
        lastFromMe: conv.lastFromMe,
        unreadCount: conv.unread,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.lastCreatedAt.getTime() - a.lastCreatedAt.getTime());
}

export async function getMessagesBetween(farmId: string, userId: string, otherUserId: string) {
  return db
    .select({
      id: directMessages.id,
      senderId: directMessages.senderId,
      recipientId: directMessages.recipientId,
      body: directMessages.body,
      createdAt: directMessages.createdAt,
      readAt: directMessages.readAt,
    })
    .from(directMessages)
    .where(
      and(
        eq(directMessages.farmId, farmId),
        or(
          and(eq(directMessages.senderId, userId), eq(directMessages.recipientId, otherUserId)),
          and(eq(directMessages.senderId, otherUserId), eq(directMessages.recipientId, userId))
        )
      )
    )
    .orderBy(asc(directMessages.createdAt));
}

// Unread direct-message count only — drives the Direct Messages tab badge,
// and is combined with getUnreadAnnouncementCountForUser for the Messages
// nav badge in the sidebar (see dashboard/layout.tsx).
export async function getUnreadMessageCountForUser(farmId: string, userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(directMessages)
    .where(
      and(eq(directMessages.farmId, farmId), eq(directMessages.recipientId, userId), isNull(directMessages.readAt))
    );
  return row?.count ?? 0;
}

// ---------- Performance ----------

// Raw rows for the selected date range — weekly bucketing (hours per week,
// accuracy per week) happens in PerformanceView, the same reason
// getFarmActivityLogsForReport pushes it to application code: startTime/
// endTime are free text, not a real time column, so they need
// parseTimeToMinutes (src/lib/time.ts) rather than SQL date math.
export async function getActivityLogsForPerformance(farmId: string, startDate: string, endDate: string) {
  return db
    .select({
      employeeId: users.id,
      employeeName: users.name,
      startTime: activityLogs.startTime,
      endTime: activityLogs.endTime,
      responseAccuracy: activityLogs.responseAccuracy,
      logDate: activityLogs.logDate,
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.employeeId, users.id))
    .where(
      and(eq(activityLogs.farmId, farmId), gte(activityLogs.logDate, startDate), lte(activityLogs.logDate, endDate))
    )
    .orderBy(asc(activityLogs.logDate));
}

// Same shape/reasoning as getActivityLogsForPerformance, but for shifts —
// drives the "coverage" trend (completed vs scheduled shifts per week) and
// the per-employee breakdown table on the Performance page.
export async function getShiftsForPerformance(farmId: string, startDate: string, endDate: string) {
  return db
    .select({
      employeeId: users.id,
      employeeName: users.name,
      shiftDate: shifts.shiftDate,
      status: shifts.status,
    })
    .from(shifts)
    .innerJoin(users, eq(shifts.employeeId, users.id))
    .where(and(eq(shifts.farmId, farmId), gte(shifts.shiftDate, startDate), lte(shifts.shiftDate, endDate)))
    .orderBy(asc(shifts.shiftDate));
}
