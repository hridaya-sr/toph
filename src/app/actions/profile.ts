"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifySession, assertNotImpersonating } from "@/lib/dal";
import { ProfileNameSchema, ProfileNameState } from "@/lib/definitions";

// No external object storage is configured for this app, so an uploaded
// photo is stored as a data URL directly in Postgres — capped well below
// the column's practical limits to keep rows small.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type AvatarState = { message?: string } | undefined;

// Every write here is scoped to session.userId only — there is no form
// field or parameter that lets a request target anyone else's profile.
export async function updateAvatar(_state: AvatarState, formData: FormData): Promise<AvatarState> {
  const session = await verifySession();
  if (session.impersonatedBy) {
    return { message: "You're viewing as this user — switch back to your own account to change their photo." };
  }
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { message: "Choose an image file first." };
  }
  if (!file.type.startsWith("image/")) {
    return { message: "That file isn't an image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { message: "Image is too large — please choose one under 2MB." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;

  await db.update(users).set({ avatarImage: dataUrl }).where(eq(users.id, session.userId));

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { message: "success" };
}

export async function removeAvatar() {
  const session = await verifySession();
  assertNotImpersonating(session);
  await db.update(users).set({ avatarImage: null }).where(eq(users.id, session.userId));

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
}

export async function updateProfileName(_state: ProfileNameState, formData: FormData): Promise<ProfileNameState> {
  const session = await verifySession();
  if (session.impersonatedBy) {
    return { message: "You're viewing as this user — switch back to your own account to edit their profile." };
  }
  const validatedFields = ProfileNameSchema.safeParse({ name: formData.get("name") });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  await db.update(users).set({ name: validatedFields.data.name }).where(eq(users.id, session.userId));

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { message: "success" };
}
