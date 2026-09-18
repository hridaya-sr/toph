import "dotenv/config";
import { db } from "./index";
import {
  farms,
  users,
  fields,
  tags,
  activityLogs,
  activityLogTags,
  shifts,
  announcements,
  announcementReads,
  directMessages,
  TranscriptQA,
} from "./schema";
import bcrypt from "bcryptjs";
import { generateJoinCode } from "../lib/join-code";
import { ACTIVITY_TYPES, ACTIVITY_LABELS } from "../lib/definitions";

// A larger, denser dataset than seed.ts — meant for demos/interviews where
// the Performance, Reports, Audit Manager, and Messages tabs all need
// enough real (non-flat) history to show trends, not a handful of rows.
// Run with `npm run db:seed:demo`. This does NOT replace `npm run db:seed`
// — that one stays the minimal, hand-authored baseline; this one clears the
// same tables and builds a bigger farm on top from scratch.

const DEMO_PASSWORD = "password123";

// ---------- tiny seeded RNG, so re-running this script produces the same
// demo dataset every time (handy when you're about to demo it and want to
// know in advance what the numbers look like) ----------
function mulberry32(seed: number) {
  return function rng() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260917);

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function chance(p: number): boolean {
  return rng() < p;
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

// Same "always relative to real now" reasoning as seed.ts — a demo should
// read as "this week" whenever it's actually run, not against a fixed date
// baked in at write time.
function dateOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatTime(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Snaps a start time to a 5-minute increment somewhere in the early-morning
// work window — non-uniform (never exactly on the hour), which is the
// whole point: real clock-ins don't line up.
function randomStartMinutes(): number {
  return Math.round(randInt(5 * 60 + 30, 9 * 60 + 30) / 5) * 5;
}

// ---------- per-activity-type transcript content ----------

type LogContent = { summary: string; qa: TranscriptQA[] };

const ACTIVITY_TEMPLATES: Record<
  (typeof ACTIVITY_TYPES)[number],
  { detailPrompt: string; confident: string[]; uncertain: string[] }
> = {
  spraying: {
    detailPrompt: "What chemical was applied, and at what rate?",
    confident: [
      "Roundup PowerMax, 32 ounces per acre.",
      "Kocide 3000, 1.5 pounds per acre, spot-treated the wet corners.",
    ],
    uncertain: ["Uh, the usual mix, I think it was — 30-something ounces? I'd have to check the tank log."],
  },
  fertilizing: {
    detailPrompt: "What fertilizer was applied, and at what rate?",
    confident: ["10-10-10 granular, 200 pounds per acre.", "Urea 46-0-0, 150 pounds per acre, broadcast."],
    uncertain: ["Some kind of granular blend, maybe 200 pounds? Wasn't the one measuring it out."],
  },
  planting: {
    detailPrompt: "What was planted, and at what seeding rate?",
    confident: [
      "Roundup Ready corn, 32,000 seeds per acre.",
      "Cover crop mix, standard drill rate, about 20 pounds per acre.",
    ],
    uncertain: ["We planted the corn again I think, not sure on the exact seed count this time."],
  },
  irrigating: {
    detailPrompt: "How long did irrigation run, and which zones?",
    confident: ["Four hours, zones 1 through 3, no leaks found.", "Six hours overnight on zone 4, checked pressure twice."],
    uncertain: ["Ran it for a while, maybe four hours? Didn't check every zone."],
  },
  harvesting: {
    detailPrompt: "What was the estimated yield and quality?",
    confident: [
      "About 3.2 tons per acre, good color, no bruising.",
      "Yield looked strong, maybe 4 tons per acre, minimal culls.",
    ],
    uncertain: ["Hard to say on yield yet, looked okay I guess, didn't weigh it."],
  },
  scouting: {
    detailPrompt: "What pest or disease pressure did you observe?",
    confident: [
      "Light aphid pressure on the south end, no treatment needed yet.",
      "Found early signs of powdery mildew on a few rows, flagged for follow-up.",
    ],
    uncertain: ["Saw something on a few leaves, not sure if it's a problem or not."],
  },
  pruning: {
    detailPrompt: "How many rows did you get through?",
    confident: ["Twelve rows on the west side, on schedule.", "Finished the whole north block, about 20 rows."],
    uncertain: ["Got through a decent chunk, didn't count the rows exactly."],
  },
  soil_work: {
    detailPrompt: "What soil work was done?",
    confident: [
      "Gypsum applied at 500 pounds per acre, then disced in.",
      "Disced and leveled the low corner near the access road.",
    ],
    uncertain: ["Worked the soil some, not 100% sure what mix was in the spreader."],
  },
  equipment_maintenance: {
    detailPrompt: "What equipment did you work on, and what was the issue?",
    confident: ["Tractor #3, oil and filter change, back in service.", "Sprayer nozzle set replaced on the boom, pressure's steady now."],
    uncertain: ["Poked at the sprayer for a bit, think it's fixed but not totally sure."],
  },
};

function buildLogContent(
  activityType: (typeof ACTIVITY_TYPES)[number],
  employeeName: string,
  fieldName: string,
  lowConfidence: boolean
): LogContent {
  const template = ACTIVITY_TEMPLATES[activityType];
  const detailAnswer = lowConfidence ? pick(template.uncertain) : pick(template.confident);
  const firstName = employeeName.split(" ")[0];
  return {
    summary: `${firstName} logged ${ACTIVITY_LABELS[activityType].toLowerCase()} on ${fieldName}${
      lowConfidence ? " — a few answers were unclear when asked to confirm." : "."
    }`,
    qa: [
      {
        key: "activity_type",
        prompt:
          "What type of activity was this — spraying, fertilizing, planting, irrigating, harvesting, scouting, pruning, soil work, or equipment maintenance?",
        answer: `${ACTIVITY_LABELS[activityType]}.`,
      },
      {
        key: "field_zoom",
        prompt: "Where are you working (field, block, or area)?",
        answer: `${fieldName}.`,
      },
      {
        key: "detail",
        prompt: template.detailPrompt,
        answer: detailAnswer,
      },
    ],
  };
}

// ---------- roster ----------

const EMPLOYEES_INPUT: { name: string; email: string; role: "admin" | "employee"; avatarColor: string }[] = [
  { name: "Priya Shah", email: "priya@sunrisevalley.farm", role: "admin", avatarColor: "#1f2937" },
  { name: "Marcus Bennett", email: "marcus@sunrisevalley.farm", role: "admin", avatarColor: "#334155" },
  { name: "Isaac Wang", email: "isaac@sunrisevalley.farm", role: "employee", avatarColor: "#2563eb" },
  { name: "Maya Patel", email: "maya@sunrisevalley.farm", role: "employee", avatarColor: "#059669" },
  { name: "Liam Johnson", email: "liam@sunrisevalley.farm", role: "employee", avatarColor: "#d97706" },
  { name: "Sophia Lee", email: "sophia@sunrisevalley.farm", role: "employee", avatarColor: "#db2777" },
  { name: "Carlos Mendoza", email: "carlos@sunrisevalley.farm", role: "employee", avatarColor: "#7c3aed" },
  { name: "Aaliyah Brooks", email: "aaliyah@sunrisevalley.farm", role: "employee", avatarColor: "#0891b2" },
  { name: "Noah Kim", email: "noah@sunrisevalley.farm", role: "employee", avatarColor: "#ca8a04" },
  { name: "Fatima Al-Sayed", email: "fatima@sunrisevalley.farm", role: "employee", avatarColor: "#dc2626" },
  { name: "Ethan Rodriguez", email: "ethan@sunrisevalley.farm", role: "employee", avatarColor: "#4f46e5" },
  { name: "Grace Okafor", email: "grace@sunrisevalley.farm", role: "employee", avatarColor: "#16a34a" },
  { name: "Daniel Novak", email: "daniel@sunrisevalley.farm", role: "employee", avatarColor: "#be123c" },
];

const FIELDS_INPUT = [
  { name: "North Block", acres: 46.0, centerLat: 37.6421, centerLng: -120.9998 },
  { name: "South Block", acres: 38.5, centerLat: 37.6361, centerLng: -120.9944 },
  { name: "Orchard Row 3", acres: 22.0, centerLat: 37.6405, centerLng: -121.0052 },
  { name: "Greenhouse 2", acres: 4.5, centerLat: 37.6438, centerLng: -120.9921 },
  { name: "Vineyard East", acres: 29.8, centerLat: 37.6379, centerLng: -121.0087 },
  { name: "Lower Pasture", acres: 51.2, centerLat: 37.6334, centerLng: -120.9963 },
];

const TAGS_INPUT = ["Urgent", "Follow-up", "Verified", "Low Confidence", "Equipment Issue"];

async function main() {
  console.log("Seeding DEMO database (this clears ALL existing data — see seed.ts for the minimal baseline seed)...");

  // Clear existing data, children before parents. directMessages and
  // announcementReads would cascade-delete anyway once their referenced
  // users/announcements are gone, but clearing them explicitly keeps this
  // list an honest record of every table the demo seed touches.
  await db.delete(announcementReads);
  await db.delete(directMessages);
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
    .values({ name: "Sunrise Valley Farms", joinCode: generateJoinCode() })
    .returning();

  // Same hashing call the app's real signup/login flow uses (bcrypt, cost
  // factor 10 — see bcrypt.hash in src/app/actions/auth.ts) — every account
  // logs in exactly the way a real signed-up user would, just pre-hashed
  // here instead of typed into a signup form.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const insertedUsers = await db
    .insert(users)
    .values(
      EMPLOYEES_INPUT.map((e) => ({
        farmId: farm.id,
        name: e.name,
        email: e.email,
        passwordHash,
        role: e.role,
        avatarColor: e.avatarColor,
      }))
    )
    .returning();

  const admins = insertedUsers.filter((u) => u.role === "admin");
  const employees = insertedUsers.filter((u) => u.role === "employee");
  const primaryAdmin = admins[0];
  const byName = new Map(insertedUsers.map((u) => [u.name, u]));

  const insertedFields = await db
    .insert(fields)
    .values(FIELDS_INPUT.map((f) => ({ farmId: farm.id, ...f })))
    .returning();

  const insertedTags = await db
    .insert(tags)
    .values(TAGS_INPUT.map((name) => ({ farmId: farm.id, name })))
    .returning();
  const tagByName = new Map(insertedTags.map((t) => [t.name, t]));

  // ---------- Activity logs: ~2 trailing weeks, non-uniform per employee ----------
  // Two employees are deliberately left out entirely — a zero-hour employee
  // is exactly what Reports/Performance need seeded data for, and leaving
  // it to chance (every employee logging nothing for 14 straight days) is
  // vanishingly unlikely rather than guaranteed.
  const QUIET_EMPLOYEE_NAMES = new Set(["Grace Okafor", "Daniel Novak"]);
  const loggingEmployees = employees.filter((e) => !QUIET_EMPLOYEE_NAMES.has(e.name));

  const logRows: (typeof activityLogs.$inferInsert)[] = [];
  for (const employee of loggingEmployees) {
    for (let dayOffset = -13; dayOffset <= 0; dayOffset++) {
      if (!chance(0.45)) continue; // non-uniform — most days have gaps somewhere

      const logDate = dateOffset(dayOffset);
      const activityType = pick(ACTIVITY_TYPES);
      const field = pick(insertedFields);
      const start = randomStartMinutes();
      const end = start + randInt(90, 330);
      const lowConfidence = chance(0.22);
      const responseAccuracy = lowConfidence ? randInt(60, 84) : randInt(85, 99);
      const content = buildLogContent(activityType, employee.name, field.name, lowConfidence);
      const recordedAt = new Date(
        `${logDate}T${String(randInt(12, 23)).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}:00Z`
      );

      logRows.push({
        farmId: farm.id,
        employeeId: employee.id,
        fieldId: field.id,
        activityType,
        logDate,
        startTime: formatTime(start),
        endTime: formatTime(end),
        audioDurationSeconds: randInt(20, 95),
        transcriptSummary: content.summary,
        transcriptQA: content.qa,
        responseAccuracy,
        recordedAt,
      });
    }
  }
  const insertedLogs = await db.insert(activityLogs).values(logRows).returning();

  // Tag a subset — every low-confidence log, plus a scattering of
  // follow-ups and equipment issues, so Audit Manager has a real queue.
  const tagRows: (typeof activityLogTags.$inferInsert)[] = [];
  for (const log of insertedLogs) {
    if (log.responseAccuracy < 85) {
      tagRows.push({ activityLogId: log.id, tagId: tagByName.get("Low Confidence")!.id });
    }
    if (chance(0.15)) {
      tagRows.push({ activityLogId: log.id, tagId: tagByName.get("Follow-up")!.id });
    }
    if (log.activityType === "equipment_maintenance" && chance(0.5)) {
      tagRows.push({ activityLogId: log.id, tagId: tagByName.get("Equipment Issue")!.id });
    }
  }
  if (tagRows.length) await db.insert(activityLogTags).values(tagRows);

  // ---------- Shifts: past two weeks (completed/missed) + the upcoming week ----------
  const shiftRows: (typeof shifts.$inferInsert)[] = [];

  for (const employee of employees) {
    for (let dayOffset = -13; dayOffset <= -1; dayOffset++) {
      if (!chance(0.3)) continue;
      const field = pick(insertedFields);
      const start = randomStartMinutes();
      const end = start + randInt(120, 300);
      shiftRows.push({
        farmId: farm.id,
        employeeId: employee.id,
        fieldId: field.id,
        activityType: chance(0.6) ? pick(ACTIVITY_TYPES) : null,
        shiftDate: dateOffset(dayOffset),
        startTime: formatTime(start),
        endTime: formatTime(end),
        status: chance(0.7) ? "completed" : "scheduled", // the rest are missed shifts
        createdByAdminId: primaryAdmin.id,
      });
    }
  }

  // Upcoming week (today through +6 days): most employees get at least one
  // shift, but a few are deliberately left unscheduled — the Reports tab
  // needs employees with zero hours in the window to show up honestly.
  const UNSCHEDULED_THIS_WEEK = new Set(["Fatima Al-Sayed", "Ethan Rodriguez", "Daniel Novak"]);
  const upcomingEmployees = employees.filter((e) => !UNSCHEDULED_THIS_WEEK.has(e.name));
  for (const employee of upcomingEmployees) {
    const shiftsThisWeek = chance(0.3) ? 2 : 1; // a few employees get a second shift
    for (let i = 0; i < shiftsThisWeek; i++) {
      const field = pick(insertedFields);
      const start = randomStartMinutes();
      const end = start + randInt(120, 300);
      shiftRows.push({
        farmId: farm.id,
        employeeId: employee.id,
        fieldId: field.id,
        activityType: chance(0.5) ? pick(ACTIVITY_TYPES) : null,
        shiftDate: dateOffset(randInt(0, 6)),
        startTime: formatTime(start),
        endTime: formatTime(end),
        status: "scheduled", // upcoming — hasn't happened yet
        createdByAdminId: primaryAdmin.id,
      });
    }
  }

  await db.insert(shifts).values(shiftRows);

  // ---------- Direct messages: a handful of conversations, mixed read state ----------
  const conversations: { messages: { from: string; body: string; unread?: boolean }[] }[] = [
    {
      messages: [
        { from: "Isaac Wang", body: "Hey, are you still on South Block this afternoon?" },
        { from: "Maya Patel", body: "Yeah, should be done by 3." },
        { from: "Isaac Wang", body: "Cool — can you swing by North Block after, sprayer's acting up again." },
        { from: "Maya Patel", body: "Sure, on my way now.", unread: true },
      ],
    },
    {
      messages: [
        { from: "Liam Johnson", body: "Irrigation on Lower Pasture looked good this morning." },
        { from: "Sophia Lee", body: "Nice, thanks for checking." },
        { from: "Liam Johnson", body: "No problem." },
      ],
    },
    {
      messages: [
        { from: "Aaliyah Brooks", body: "Can you cover my shift Thursday? Doctor's appointment." },
        { from: "Carlos Mendoza", body: "Yeah I can do that, no worries." },
        { from: "Aaliyah Brooks", body: "You're a lifesaver, thank you!", unread: true },
      ],
    },
    {
      messages: [
        { from: "Noah Kim", body: "Saw some aphids on the south rows while scouting, might want to keep an eye on it." },
        { from: "Fatima Al-Sayed", body: "Good catch, I'll check it tomorrow.", unread: true },
      ],
    },
    {
      messages: [
        { from: "Priya Shah", body: "How's the new tractor running?" },
        { from: "Ethan Rodriguez", body: "Good so far, no issues." },
        { from: "Priya Shah", body: "Great, let me know if that changes.", unread: true },
      ],
    },
    {
      messages: [
        { from: "Grace Okafor", body: "You around this week? Haven't seen you on the schedule." },
        { from: "Daniel Novak", body: "Been out, should be back next week." },
      ],
    },
  ];

  const dmNow = Date.now();
  const minutesAgo = (m: number) => new Date(dmNow - m * 60_000);

  const dmRows: (typeof directMessages.$inferInsert)[] = [];
  for (const convo of conversations) {
    const participants = new Set(convo.messages.map((m) => m.from));
    const [nameA, nameB] = Array.from(participants);
    const userA = byName.get(nameA)!;
    const userB = byName.get(nameB)!;
    convo.messages.forEach((m, i) => {
      const sender = byName.get(m.from)!;
      const recipient = sender.id === userA.id ? userB : userA;
      const ageMinutes = (convo.messages.length - i) * 40;
      dmRows.push({
        farmId: farm.id,
        senderId: sender.id,
        recipientId: recipient.id,
        body: m.body,
        createdAt: minutesAgo(ageMinutes),
        readAt: m.unread ? null : minutesAgo(ageMinutes - 5),
      });
    });
  }
  await db.insert(directMessages).values(dmRows);

  // ---------- Announcements, with per-employee read state that varies ----------
  const announcementSeeds = [
    {
      body: "Welcome to Sunrise Valley Farms' new team dashboard! This is where farm-wide updates will be posted going forward.",
      author: primaryAdmin,
    },
    {
      body: "Reminder: the sprayer on North Block is due for maintenance this Friday — please route around it if possible.",
      author: primaryAdmin,
    },
    {
      body: "Great work on the harvest numbers this week, team. Keep it up!",
      author: admins[1] ?? primaryAdmin,
    },
  ];

  const insertedAnnouncements = await db
    .insert(announcements)
    .values(announcementSeeds.map((a) => ({ farmId: farm.id, authorId: a.author.id, body: a.body })))
    .returning();

  // First announcement: read by most employees. Second: read by about half.
  // Third: unread by everyone (the "newest" one), so there's always
  // something fresh to demo mark-as-read/unread and the tab badges on.
  const readRows: (typeof announcementReads.$inferInsert)[] = [];
  insertedAnnouncements.forEach((announcement, idx) => {
    const readFraction = idx === 0 ? 0.8 : idx === 1 ? 0.5 : 0;
    for (const employee of employees) {
      if (chance(readFraction)) {
        readRows.push({ announcementId: announcement.id, userId: employee.id });
      }
    }
  });
  if (readRows.length) await db.insert(announcementReads).values(readRows);

  console.log("\nDemo seed complete:");
  console.log(`  Farm: ${farm.name}`);
  console.log(`  Login password (every account): ${DEMO_PASSWORD}`);
  console.log(`  Admin logins: ${admins.map((a) => a.email).join(", ")}`);
  console.log(`  Employee logins: ${employees.map((e) => e.email).join(", ")}`);
  console.log(`  Farm invite code (for "Join an existing farm" at signup): ${farm.joinCode}`);
  console.log(`  Accounts: ${insertedUsers.length} (${admins.length} admin, ${employees.length} employee)`);
  console.log(`  Fields: ${insertedFields.length}`);
  console.log(`  Activity logs: ${insertedLogs.length} (${QUIET_EMPLOYEE_NAMES.size} employees with none, on purpose)`);
  console.log(`  Shifts: ${shiftRows.length} (${UNSCHEDULED_THIS_WEEK.size} employees unscheduled this coming week)`);
  console.log(`  Direct messages: ${dmRows.length} across ${conversations.length} conversations`);
  console.log(`  Announcements: ${insertedAnnouncements.length}, with mixed per-employee read state`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
