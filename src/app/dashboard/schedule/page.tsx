import { format, addDays, subDays } from "date-fns";
import { getCurrentUser } from "@/lib/dal";
import { getShiftsForFarm, getFarmEmployees, getFarmFields } from "@/lib/queries";
import { ScheduleCalendar } from "@/components/schedule-calendar";

// A generous window around today so the client-side week navigator (Prev/
// Today/Next) can move several weeks either way without a refetch — shift
// volume for a farm is small enough that this is cheap either way.
const RANGE_DAYS_BEFORE = 30;
const RANGE_DAYS_AFTER = 60;

export default async function SchedulePage() {
  const user = await getCurrentUser();
  const now = new Date();
  const rangeStart = format(subDays(now, RANGE_DAYS_BEFORE), "yyyy-MM-dd");
  const rangeEnd = format(addDays(now, RANGE_DAYS_AFTER), "yyyy-MM-dd");

  const [shifts, employees, fields] = await Promise.all([
    getShiftsForFarm(user.farmId, rangeStart, rangeEnd, user.role === "admin" ? undefined : user.id),
    user.role === "admin" ? getFarmEmployees(user.farmId) : Promise.resolve([]),
    getFarmFields(user.farmId),
  ]);

  const isImpersonating = !!user.impersonatedBy;

  return (
    <div className="px-[30px] py-[30px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-black">Schedule</h1>
        <p className="mt-1 text-base text-[#4d4d4d]">
          {user.role === "admin"
            ? "Plan upcoming field work and assign it to employees."
            : isImpersonating
              ? "Viewing this employee's upcoming shifts — switch back to your own account to mark one done."
              : "Your upcoming shifts — click a scheduled one to mark it done."}
        </p>
      </div>
      <ScheduleCalendar
        shifts={shifts}
        role={user.role}
        employees={employees.filter((e) => e.role === "employee").map((e) => ({ id: e.id, name: e.name }))}
        fields={fields}
        isImpersonating={isImpersonating}
      />
    </div>
  );
}
