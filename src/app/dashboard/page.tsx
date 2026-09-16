import { getCurrentUser } from "@/lib/dal";
import { getActivityLogsForFarm, getDashboardStats, getFarmEmployees, getFarmFields } from "@/lib/queries";
import { StatCards } from "@/components/stat-cards";
import { ActivityLogTable } from "@/components/activity-log-table";
import { NewLogForm } from "@/components/new-log-form";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [stats, logs, employees, fields] = await Promise.all([
    getDashboardStats(user.farmId),
    getActivityLogsForFarm(user.farmId),
    getFarmEmployees(user.farmId),
    getFarmFields(user.farmId),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">An overview of your farm and employee activity</p>
        </div>
        <NewLogForm employees={employees.filter((e) => e.role === "employee")} fields={fields} />
      </div>

      <div className="mb-6">
        <StatCards
          todaysRecordings={stats.todaysRecordings}
          activeWorkers={stats.activeWorkers}
          responseAccuracy={stats.responseAccuracy}
        />
      </div>

      <ActivityLogTable logs={logs} title="New Employee Logs" />
    </div>
  );
}
