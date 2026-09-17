import "dotenv/config";
import { db } from "./index";
import { farms, users, fields, activityLogs, tags, activityLogTags, shifts, announcements } from "./schema";
import bcrypt from "bcryptjs";
import { generateJoinCode } from "../lib/join-code";

// Shifts are meant to read as "this week and next" whenever the app is
// actually opened, not against a fixed demo date — so every shift date is
// computed relative to the real current date at seed time.
function dateOffset(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("Seeding database...");

  // Clear existing data (dev convenience — fine for a take-home seed script)
  await db.delete(announcements);
  await db.delete(shifts);
  await db.delete(activityLogTags);
  await db.delete(activityLogs);
  await db.delete(tags);
  await db.delete(fields);
  await db.delete(users);
  await db.delete(farms);

  const [farm] = await db
    .insert(farms)
    .values({ name: "Bays Ranch", joinCode: generateJoinCode() })
    .returning();

  const passwordHash = await bcrypt.hash("password123", 10);

  const [admin, isaac, maya, liam, sophia] = await db
    .insert(users)
    .values([
      { farmId: farm.id, name: "Bays Ranch Admin", email: "admin@baysranch.farm", passwordHash, role: "admin", avatarColor: "#1f2937" },
      { farmId: farm.id, name: "Isaac Wang", email: "isaac@baysranch.farm", passwordHash, role: "employee", avatarColor: "#2563eb" },
      { farmId: farm.id, name: "Maya Patel", email: "maya@baysranch.farm", passwordHash, role: "employee", avatarColor: "#059669" },
      { farmId: farm.id, name: "Liam Johnson", email: "liam@baysranch.farm", passwordHash, role: "employee", avatarColor: "#d97706" },
      { farmId: farm.id, name: "Sophia Lee", email: "sophia@baysranch.farm", passwordHash, role: "employee", avatarColor: "#db2777" },
    ])
    .returning();

  const [fieldA, fieldB, fieldC, fieldD] = await db
    .insert(fields)
    .values([
      { farmId: farm.id, name: "Field A", acres: 42.5, centerLat: 38.5449, centerLng: -121.7405 },
      { farmId: farm.id, name: "Field B", acres: 31.2, centerLat: 38.5502, centerLng: -121.7361 },
      { farmId: farm.id, name: "Field C", acres: 58.9, centerLat: 38.5387, centerLng: -121.7488 },
      { farmId: farm.id, name: "Field D", acres: 24.0, centerLat: 38.5468, centerLng: -121.7529 },
    ])
    .returning();

  const [, tagFollowUp, , tagLowConfidence] = await db
    .insert(tags)
    .values([
      { farmId: farm.id, name: "Urgent" },
      { farmId: farm.id, name: "Follow-up" },
      { farmId: farm.id, name: "Verified" },
      { farmId: farm.id, name: "Low Confidence" },
    ])
    .returning();

  const [logIsaac] = await db
    .insert(activityLogs)
    .values({
      farmId: farm.id,
      employeeId: isaac.id,
      fieldId: fieldA.id,
      activityType: "spraying",
      logDate: "2026-04-19",
      startTime: "6:00 AM",
      endTime: "10:40 AM",
      audioDurationSeconds: 47,
      responseAccuracy: 92,
      recordedAt: new Date("2026-04-19T22:01:01Z"),
      transcriptSummary:
        "Offline guided voice log captured on-site. Isaac sprayed Field A starting at 6:00 AM, finishing around 10:40 AM. He wasn't fully certain of the exact chemical mix ratios when asked to confirm.",
      transcriptQA: [
        {
          key: "activity_type",
          prompt:
            "What type of activity was this — spraying, fertilizing, planting, irrigating, harvesting, scouting, pruning, soil work, or equipment maintenance?",
          answer: "Spraying.",
        },
        {
          key: "field_zoom",
          prompt: "Where are you working (field, block, or area)?",
          answer: "Field A, the whole block, north and south ends.",
        },
        {
          key: "chemical_mix",
          prompt: "What fertilizer or chemical was applied, and at what rate?",
          answer:
            "Uh, one part and then 130 and 200, yeah, and 180 for uh — 180 and 40, this one, no, no, uh no I don't remember exactly, honestly.",
        },
      ],
    })
    .returning();

  await db.insert(activityLogTags).values([
    { activityLogId: logIsaac.id, tagId: tagLowConfidence.id },
    { activityLogId: logIsaac.id, tagId: tagFollowUp.id },
  ]);

  await db.insert(activityLogs).values([
    {
      farmId: farm.id,
      employeeId: maya.id,
      fieldId: fieldB.id,
      activityType: "harvesting",
      logDate: "2026-04-20",
      startTime: "7:30 AM",
      endTime: "9:15 AM",
      audioDurationSeconds: 31,
      responseAccuracy: 96,
      recordedAt: new Date("2026-04-20T16:15:00Z"),
      transcriptSummary:
        "Maya harvested Field B between 7:30 and 9:15 AM. Reported good yield with no equipment issues.",
      transcriptQA: [
        {
          key: "activity_type",
          prompt:
            "What type of activity was this — spraying, fertilizing, planting, irrigating, harvesting, scouting, pruning, soil work, or equipment maintenance?",
          answer: "Harvesting.",
        },
        {
          key: "field_zoom",
          prompt: "Where are you working (field, block, or area)?",
          answer: "Field B, east rows.",
        },
      ],
    },
    {
      farmId: farm.id,
      employeeId: liam.id,
      fieldId: fieldC.id,
      activityType: "planting",
      logDate: "2026-04-21",
      startTime: "8:30 AM",
      endTime: "12:00 PM",
      audioDurationSeconds: 58,
      responseAccuracy: 88,
      recordedAt: new Date("2026-04-21T19:45:00Z"),
      transcriptSummary:
        "Liam planted Field C throughout the morning. Noted soil was wetter than expected on the south end.",
      transcriptQA: [
        {
          key: "activity_type",
          prompt:
            "What type of activity was this — spraying, fertilizing, planting, irrigating, harvesting, scouting, pruning, soil work, or equipment maintenance?",
          answer: "Planting.",
        },
        {
          key: "field_zoom",
          prompt: "Where are you working (field, block, or area)?",
          answer: "Field C, south end mostly.",
        },
      ],
    },
    {
      farmId: farm.id,
      employeeId: sophia.id,
      fieldId: fieldD.id,
      activityType: "irrigating",
      logDate: "2026-04-22",
      startTime: "6:30 AM",
      endTime: "9:30 AM",
      audioDurationSeconds: 39,
      responseAccuracy: 94,
      recordedAt: new Date("2026-04-22T16:30:00Z"),
      transcriptSummary:
        "Sophia ran irrigation on Field D. All lines checked, no leaks reported.",
      transcriptQA: [
        {
          key: "activity_type",
          prompt:
            "What type of activity was this — spraying, fertilizing, planting, irrigating, harvesting, scouting, pruning, soil work, or equipment maintenance?",
          answer: "Irrigating.",
        },
        {
          key: "field_zoom",
          prompt: "Where are you working (field, block, or area)?",
          answer: "Field D, all four lines.",
        },
      ],
    },
  ]);

  await db.insert(shifts).values([
    // This week: a mix of already-completed and still-scheduled.
    {
      farmId: farm.id,
      employeeId: isaac.id,
      fieldId: fieldA.id,
      shiftDate: dateOffset(-1),
      startTime: "6:00 AM",
      endTime: "10:00 AM",
      status: "completed",
      createdByAdminId: admin.id,
    },
    {
      farmId: farm.id,
      employeeId: maya.id,
      fieldId: fieldB.id,
      shiftDate: dateOffset(0),
      startTime: "7:00 AM",
      endTime: "11:00 AM",
      status: "scheduled",
      createdByAdminId: admin.id,
    },
    {
      farmId: farm.id,
      employeeId: liam.id,
      fieldId: fieldC.id,
      shiftDate: dateOffset(0),
      startTime: "1:00 PM",
      endTime: "5:00 PM",
      status: "scheduled",
      createdByAdminId: admin.id,
    },
    {
      farmId: farm.id,
      employeeId: sophia.id,
      fieldId: fieldD.id,
      shiftDate: dateOffset(2),
      startTime: "8:00 AM",
      endTime: "12:00 PM",
      status: "scheduled",
      createdByAdminId: admin.id,
    },
    {
      farmId: farm.id,
      employeeId: isaac.id,
      fieldId: null,
      shiftDate: dateOffset(3),
      startTime: "9:00 AM",
      endTime: "3:00 PM",
      status: "scheduled",
      createdByAdminId: admin.id,
    },
    // Next week.
    {
      farmId: farm.id,
      employeeId: maya.id,
      fieldId: fieldA.id,
      shiftDate: dateOffset(8),
      startTime: "6:30 AM",
      endTime: "10:30 AM",
      status: "scheduled",
      createdByAdminId: admin.id,
    },
    {
      farmId: farm.id,
      employeeId: liam.id,
      fieldId: fieldB.id,
      shiftDate: dateOffset(9),
      startTime: "7:00 AM",
      endTime: "1:00 PM",
      status: "scheduled",
      createdByAdminId: admin.id,
    },
    {
      farmId: farm.id,
      employeeId: sophia.id,
      fieldId: fieldC.id,
      shiftDate: dateOffset(10),
      startTime: "8:00 AM",
      endTime: "11:30 AM",
      status: "scheduled",
      createdByAdminId: admin.id,
    },
  ]);

  await db.insert(announcements).values([
    {
      farmId: farm.id,
      authorId: admin.id,
      body: "Welcome to the new farm-wide announcement board! Post anything the whole team should see here.",
    },
    {
      farmId: farm.id,
      authorId: admin.id,
      body: "Reminder: irrigation lines on Field D are being serviced this week — check with me before scheduling work there.",
    },
  ]);

  console.log("Seed complete:");
  console.log(`  Farm: ${farm.name}`);
  console.log(`  Users: admin@baysranch.farm / isaac / maya / liam / sophia @baysranch.farm`);
  console.log(`  Password (all seed users): password123`);
  console.log(`  Farm invite code (for "Join an existing farm" at signup): ${farm.joinCode}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
