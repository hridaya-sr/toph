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

// ---------- Tables ----------

export const farms = pgTable("farms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
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

// ---------- Relations ----------

export const farmsRelations = relations(farms, ({ many }) => ({
  users: many(users),
  fields: many(fields),
  activityLogs: many(activityLogs),
  tags: many(tags),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  farm: one(farms, { fields: [users.farmId], references: [farms.id] }),
  activityLogs: many(activityLogs),
}));

export const fieldsRelations = relations(fields, ({ one, many }) => ({
  farm: one(farms, { fields: [fields.farmId], references: [farms.id] }),
  activityLogs: many(activityLogs),
}));

export const activityLogsRelations = relations(activityLogs, ({ one, many }) => ({
  farm: one(farms, { fields: [activityLogs.farmId], references: [farms.id] }),
  employee: one(users, { fields: [activityLogs.employeeId], references: [users.id] }),
  field: one(fields, { fields: [activityLogs.fieldId], references: [fields.id] }),
  tags: many(activityLogTags),
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
