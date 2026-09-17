import { getCurrentUser } from "@/lib/dal";
import {
  getActivityLogsForFarm,
  getDashboardStats,
  getEmployeeMonthStats,
  getFarmEmployees,
  getFarmFields,
} from "@/lib/queries";
import { DashboardView } from "@/components/dashboard-view";

// The dashboard's log table is a glanceable recent-activity widget, not the
// full archive — that's what /dashboard/activity-logs is for — so it only
// ever fetches this many of the most recent logs, rather than fetching
// everything and slicing it down client-side.
const RECENT_LOGS_LIMIT = 8;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [stats, logs, employees, fields, employeeMonthStats] = await Promise.all([
    getDashboardStats(user.farmId),
    // Same reasoning as below for employees: an employee's dashboard only
    // ever shows their own entries, so scope the query server-side rather
    // than fetching every coworker's transcript and filtering it later.
    getActivityLogsForFarm(user.farmId, {
      employeeId: user.role === "admin" ? undefined : user.id,
      sort: "desc",
      limit: RECENT_LOGS_LIMIT,
    }),
    // Only admins render (or need) the farm's employee roster — for an
    // employee session, skip the fetch entirely rather than just not
    // displaying it, so coworker names/emails never reach their client.
    user.role === "admin" ? getFarmEmployees(user.farmId) : Promise.resolve([]),
    getFarmFields(user.farmId),
    // "Your logs this month" / "Last logged" need the employee's full
    // history, not just the limited recent list above, so they're their
    // own aggregate query — same pattern getDashboardStats already uses
    // for the admin-facing stat cards.
    user.role === "admin" ? Promise.resolve(null) : getEmployeeMonthStats(user.farmId, user.id),
  ]);

  return (
    <div className="px-[30px] py-[30px]">
      <DashboardView
        role={user.role}
        currentUserId={user.id}
        currentUserName={user.name}
        farmName={user.farmName}
        stats={stats}
        logs={logs}
        employees={employees}
        fields={fields}
        employeeMonthStats={employeeMonthStats}
      />
    </div>
  );
}
