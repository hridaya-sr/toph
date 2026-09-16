import { getCurrentUser } from "@/lib/dal";
import { getFarmFields, getActivityLogsForFarm } from "@/lib/queries";
import { FieldMap } from "@/components/field-map-loader";
import { ACTIVITY_LABELS } from "@/lib/definitions";

export default async function MapPage() {
  const user = await getCurrentUser();
  const [fields, logs] = await Promise.all([
    getFarmFields(user.farmId),
    getActivityLogsForFarm(user.farmId),
  ]);

  const recentByField = new Map<string, number>();
  for (const log of logs) {
    if (!log.fieldId) continue;
    recentByField.set(log.fieldId, (recentByField.get(log.fieldId) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Map</h1>
      <p className="mt-1 text-sm text-zinc-500">All fields on {user.farmName}, plotted from logged activity.</p>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FieldMap fields={fields} height={480} interactive />
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-900">{f.name}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{f.acres ?? "—"} acres</p>
              <p className="mt-1 text-xs text-zinc-400">{recentByField.get(f.id) ?? 0} logged activities</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Recent activity by field</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                <th className="px-4 py-2.5 font-medium">Field</th>
                <th className="px-4 py-2.5 font-medium">Activity</th>
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 10).map((log) => (
                <tr key={log.id} className="border-b border-zinc-50 text-zinc-700">
                  <td className="px-4 py-2.5">{log.fieldName ?? "—"}</td>
                  <td className="px-4 py-2.5">{ACTIVITY_LABELS[log.activityType]}</td>
                  <td className="px-4 py-2.5">{log.employeeName}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{log.logDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
