"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, farms } from "@/db/schema";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { generateJoinCode } from "@/lib/join-code";
import {
  LoginFormSchema,
  LoginFormState,
  SignupFormSchema,
  SignupFormState,
  JoinFarmFormSchema,
  JoinFarmFormState,
} from "@/lib/definitions";

export async function login(_state: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const validatedFields = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password } = validatedFields.data;

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  const user = rows[0];

  if (!user) {
    return { message: "Invalid email or password." };
  }

  const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordsMatch) {
    return { message: "Invalid email or password." };
  }

  await createSession({ id: user.id, farmId: user.farmId, role: user.role });
  redirect("/dashboard");
}

export async function signup(_state: SignupFormState, formData: FormData): Promise<SignupFormState> {
  const validatedFields = SignupFormSchema.safeParse({
    farmName: formData.get("farmName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { farmName, name, email, password } = validatedFields.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing[0]) {
    return { message: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [farm] = await db.insert(farms).values({ name: farmName, joinCode: generateJoinCode() }).returning();

  const [user] = await db
    .insert(users)
    .values({
      farmId: farm.id,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "admin",
    })
    .returning();

  if (!user) {
    return { message: "An error occurred while creating your account." };
  }

  await createSession({ id: user.id, farmId: user.farmId, role: user.role });
  redirect("/dashboard");
}

// Self-serve counterpart to signup(): instead of creating a new farm, joins
// an existing one by its invite code. Always creates an "employee" account
// — never "admin" — and the farmId always comes from the farm row matched
// by the code, never from client input, so there's no way for a submitted
// form value to attach a new user to an arbitrary farm or grant them admin.
export async function joinFarm(_state: JoinFarmFormState, formData: FormData): Promise<JoinFarmFormState> {
  const validatedFields = JoinFarmFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    joinCode: formData.get("joinCode"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, email, password, joinCode } = validatedFields.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing[0]) {
    return { message: "An account with that email already exists." };
  }

  // Codes are generated uppercase; normalize input the same way email is
  // lowercased above, so casing when typing/pasting doesn't matter.
  const farmRows = await db
    .select({ id: farms.id })
    .from(farms)
    .where(eq(farms.joinCode, joinCode.toUpperCase()))
    .limit(1);
  const farm = farmRows[0];

  if (!farm) {
    // Deliberately generic — never confirms or denies anything about a
    // specific farm, just whether the code itself matched.
    return { message: "Invalid invite code." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(users)
    .values({
      farmId: farm.id,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "employee",
    })
    .returning();

  if (!user) {
    return { message: "An error occurred while creating your account." };
  }

  await createSession({ id: user.id, farmId: user.farmId, role: user.role });
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

// "Switch User" — lets a signed-in admin jump into another account on the
// SAME farm without re-entering a password (e.g. to see what an employee
// sees). This still runs createSession() server-side, so it's a real,
// auditable session change rather than a client-side illusion — but it is
// only ever reachable by an already-authenticated admin on their own farm,
// never a public entry point into someone else's account.
export async function switchUser(userId: string) {
  const currentSession = await getSession();
  if (!currentSession?.userId) {
    redirect("/login");
  }
  if (currentSession.role !== "admin") {
    throw new Error("Only farm admins can switch accounts.");
  }

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];

  if (!user || user.farmId !== currentSession.farmId) {
    throw new Error("Cannot switch to a user outside your farm.");
  }

  await createSession({
    id: user.id,
    farmId: user.farmId,
    role: user.role,
    impersonatedBy: currentSession.userId,
  });
  redirect("/dashboard");
}

// Ends a "Switch User" session and returns to the admin account that started
// it, re-verifying that account still exists, is still an admin, and is
// still on the same farm before restoring it — the impersonatedBy id comes
// from the signed session cookie, never from client input.
export async function returnToAdmin() {
  const currentSession = await getSession();
  if (!currentSession?.userId) {
    redirect("/login");
  }
  if (!currentSession.impersonatedBy) {
    throw new Error("Not currently viewing as another user.");
  }

  const rows = await db.select().from(users).where(eq(users.id, currentSession.impersonatedBy)).limit(1);
  const admin = rows[0];

  if (!admin || admin.farmId !== currentSession.farmId || admin.role !== "admin") {
    throw new Error("Your original admin account is no longer available.");
  }

  await createSession({ id: admin.id, farmId: admin.farmId, role: admin.role });
  redirect("/dashboard");
}
