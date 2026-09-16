import { getCurrentUser } from "@/lib/dal";
import { getActivityLogsForFarm, getFarmEmployees, getFarmFields } from "@/lib/queries";
import { ActivityLogTable } from "@/components/activity-log-table";
import { NewLogForm } from "@/components/new-log-form";

export default async function ActivityLogsPage() {
  const user = await getCurrentUser();
  const [logs, employees, fields] = await Promise.all([
    getActivityLogsForFarm(user.farmId),
    getFarmEmployees(user.farmId),
    getFarmFields(user.farmId),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Activity Logs</h1>
          <p className="mt-1 text-sm text-zinc-500">Every voice-logged entry across {user.farmName}</p>
        </div>
        <NewLogForm employees={employees.filter((e) => e.role === "employee")} fields={fields} />
      </div>
      <ActivityLogTable logs={logs} title="All Activity Logs" />
    </div>
  );
}
