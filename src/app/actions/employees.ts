"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifySession } from "@/lib/dal";

// Admin-only, farm-scoped, and restricted to role "employee" — an admin
// can only ever delete an employee on their own farm through this, never
// another admin (including themselves) and never anyone off-farm. The row
// deletion itself is what invalidates their ability to log back in: login
// looks them up by email and fails once the row is gone, and every
// dashboard page re-verifies via getCurrentUser() (a real DB lookup, not
// just a valid session cookie), so a deleted employee is redirected to
// /login the moment they load any page even if their JWT hasn't expired
// yet. activityLogs/shifts/etc. this employee created are cascade-deleted
// along with them, per the onDelete: "cascade" already on those foreign
// keys — deleting an employee is a real, permanent removal of their
// history, not a soft delete.
export async function deleteEmployee(userId: string) {
  const session = await verifySession();
  if (session.role !== "admin") {
    throw new Error("Only farm admins can delete employees.");
  }

  const rows = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.farmId, session.farmId)))
    .limit(1);
  const target = rows[0];

  if (!target) {
    throw new Error("That employee is not on this farm.");
  }
  if (target.role !== "employee") {
    throw new Error("Only employee accounts can be deleted here.");
  }

  await db.delete(users).where(eq(users.id, userId));

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
}
