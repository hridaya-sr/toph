"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, farms } from "@/db/schema";
import { createSession, deleteSession, getSession } from "@/lib/session";
import {
  LoginFormSchema,
  LoginFormState,
  SignupFormSchema,
  SignupFormState,
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

  const [farm] = await db.insert(farms).values({ name: farmName }).returning();

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

  await createSession({ id: user.id, farmId: user.farmId, role: user.role });
  redirect("/dashboard");
}
