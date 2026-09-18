import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  integer,
  pgEnum,
  primaryKey,
  jsonb,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------

export const roleEnum = pgEnum("role", ["admin", "employee"]);

export const activityTypeEnum = pgEnum("activity_type", [
  "spraying",
  "fertilizing",
  "planting",
  "irrigating",
  "harvesting",
  "scouting",
  "pruning",
  "soil_work",
  "equipment_maintenance",
]);

export const shiftStatusEnum = pgEnum("shift_status", ["scheduled", "completed"]);

// ---------- Tables ----------

export const farms = pgTable("farms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  // The invite code employees use to self-serve join this farm at signup.
  // Always generated application-side with a CSPRNG (see src/lib/join-
  // code.ts) on both farm creation and regeneration — every insert supplies
  // it explicitly, the same convention as passwordHash and other app-
  // generated columns in this schema, so there's no DB-level default.
  joinCode: varchar("join_code", { length: 20 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id")
    .references(() => farms.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("employee"),
  avatarColor: varchar("avatar_color", { length: 32 }).default("#111111"),
  // A data URL (image bytes, base64-encoded) for an uploaded profile photo.
  // Null means "no photo uploaded" — every avatar-rendering spot falls back
  // to the colored-initials circle (avatarColor) in that case. Stored
  // directly in Postgres rather than an external object store, since none
  // is configured for this app; uploads are capped client- and server-side
  // (see MAX_AVATAR_BYTES in src/app/actions/profile.ts) to keep rows small.
  avatarImage: text("avatar_image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fields = pgTable("fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id")
    .references(() => farms.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  acres: doublePrecision("acres"),
  centerLat: doublePrecision("center_lat"),
  centerLng: doublePrecision("center_lng"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id")
    .references(() => farms.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A structured question/answer pair captured from the voice transcript,
// e.g. { question: "activity_type", prompt: "...", answer: "..." }
export type TranscriptQA = {
  key: string;
  prompt: string;
  answer: string;
};

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id")
    .references(() => farms.id, { onDelete: "cascade" })
    .notNull(),
  employeeId: uuid("employee_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  fieldId: uuid("field_id").references(() => fields.id, { onDelete: "set null" }),
  activityType: activityTypeEnum("activity_type").notNull(),
  logDate: date("log_date").notNull(),
  startTime: varchar("start_time", { length: 16 }).notNull(),
  endTime: varchar("end_time", { length: 16 }).notNull(),
  audioDurationSeconds: integer("audio_duration_seconds").notNull().default(0),
  transcriptSummary: text("transcript_summary").notNull().default(""),
  transcriptQA: jsonb("transcript_qa").$type<TranscriptQA[]>().notNull().default([]),
  responseAccuracy: integer("response_accuracy").notNull().default(90),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Null until an admin reviews it in Audit Manager. Only ever set by
  // markLogReviewed() — once set, the log drops out of that review queue.
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const activityLogTags = pgTable(
  "activity_log_tags",
  {
    activityLogId: uuid("activity_log_id")
      .references(() => activityLogs.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.activityLogId, t.tagId] })]
);

export const shifts = pgTable("shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id")
    .references(() => farms.id, { onDelete: "cascade" })
    .notNull(),
  employeeId: uuid("employee_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  fieldId: uuid("field_id").references(() => fields.id, { onDelete: "set null" }),
  // Optional: an admin can pin down the activity when scheduling the
  // shift, in which case it's locked (like the date/time already are) when
  // the employee completes it — completeShiftAndCreateLog only falls back
  // to asking the employee to choose one if this is null.
  activityType: activityTypeEnum("activity_type"),
  shiftDate: date("shift_date").notNull(),
  startTime: varchar("start_time", { length: 16 }).notNull(),
  endTime: varchar("end_time", { length: 16 }).notNull(),
  status: shiftStatusEnum("status").notNull().default("scheduled"),
  createdByAdminId: uuid("created_by_admin_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  // Set once the assigned employee marks the shift done and the
  // corresponding activity log is created — see completeShiftAndCreateLog
  // in src/app/actions/shifts.ts. Null for a still-scheduled shift.
  activityLogId: uuid("activity_log_id").references(() => activityLogs.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id")
    .references(() => farms.id, { onDelete: "cascade" })
    .notNull(),
  authorId: uuid("author_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Per-viewer read state for announcements. Announcements themselves are
// farm-wide and have no per-recipient row (unlike directMessages, which can
// hang a readAt column directly off each message), so this is a separate
// join table: a row's presence means that user has read that announcement.
// "Mark as unread" deletes the row rather than nulling a column.
export const announcementReads = pgTable(
  "announcement_reads",
  {
    announcementId: uuid("announcement_id")
      .references(() => announcements.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.userId] })]
);

// Private, 1:1 messages between any two members of the same farm — the
// real feature the announcement board explicitly wasn't (see the comment
// on Messages in src/app/dashboard/messages/page.tsx). A "conversation" is
// just every row between two particular userIds; there's no separate
// conversation/thread table.
export const directMessages = pgTable("direct_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id")
    .references(() => farms.id, { onDelete: "cascade" })
    .notNull(),
  senderId: uuid("sender_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  recipientId: uuid("recipient_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Null until the recipient opens that conversation — drives the unread
  // count badge next to the Messages nav item.
  readAt: timestamp("read_at", { withTimezone: true }),
});

// ---------- Relations ----------

export const farmsRelations = relations(farms, ({ many }) => ({
  users: many(users),
  fields: many(fields),
  activityLogs: many(activityLogs),
  tags: many(tags),
  shifts: many(shifts),
  announcements: many(announcements),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  farm: one(farms, { fields: [users.farmId], references: [farms.id] }),
  activityLogs: many(activityLogs),
  shifts: many(shifts),
  announcements: many(announcements),
  sentMessages: many(directMessages, { relationName: "sender" }),
  receivedMessages: many(directMessages, { relationName: "recipient" }),
}));

export const fieldsRelations = relations(fields, ({ one, many }) => ({
  farm: one(farms, { fields: [fields.farmId], references: [farms.id] }),
  activityLogs: many(activityLogs),
  shifts: many(shifts),
}));

export const activityLogsRelations = relations(activityLogs, ({ one, many }) => ({
  farm: one(farms, { fields: [activityLogs.farmId], references: [farms.id] }),
  employee: one(users, { fields: [activityLogs.employeeId], references: [users.id] }),
  field: one(fields, { fields: [activityLogs.fieldId], references: [fields.id] }),
  tags: many(activityLogTags),
  shift: one(shifts, { fields: [activityLogs.id], references: [shifts.activityLogId] }),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  farm: one(farms, { fields: [shifts.farmId], references: [farms.id] }),
  employee: one(users, { fields: [shifts.employeeId], references: [users.id] }),
  field: one(fields, { fields: [shifts.fieldId], references: [fields.id] }),
  createdByAdmin: one(users, { fields: [shifts.createdByAdminId], references: [users.id] }),
  activityLog: one(activityLogs, { fields: [shifts.activityLogId], references: [activityLogs.id] }),
}));

export const announcementsRelations = relations(announcements, ({ one, many }) => ({
  farm: one(farms, { fields: [announcements.farmId], references: [farms.id] }),
  author: one(users, { fields: [announcements.authorId], references: [users.id] }),
  reads: many(announcementReads),
}));

export const announcementReadsRelations = relations(announcementReads, ({ one }) => ({
  announcement: one(announcements, {
    fields: [announcementReads.announcementId],
    references: [announcements.id],
  }),
  user: one(users, { fields: [announcementReads.userId], references: [users.id] }),
}));

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  farm: one(farms, { fields: [directMessages.farmId], references: [farms.id] }),
  sender: one(users, {
    fields: [directMessages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  recipient: one(users, {
    fields: [directMessages.recipientId],
    references: [users.id],
    relationName: "recipient",
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  farm: one(farms, { fields: [tags.farmId], references: [farms.id] }),
  logs: many(activityLogTags),
}));

export const activityLogTagsRelations = relations(activityLogTags, ({ one }) => ({
  activityLog: one(activityLogs, {
    fields: [activityLogTags.activityLogId],
    references: [activityLogs.id],
  }),
  tag: one(tags, { fields: [activityLogTags.tagId], references: [tags.id] }),
}));
