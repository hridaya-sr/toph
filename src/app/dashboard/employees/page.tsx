import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getFarmEmployees, getActivityLogsForFarm } from "@/lib/queries";
import { Avatar } from "@/components/avatar";

export default async function EmployeesPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }
  const [employees, logs] = await Promise.all([
    getFarmEmployees(user.farmId),
    getActivityLogsForFarm(user.farmId),
  ]);

  const logCountByEmployee = new Map<string, number>();
  for (const log of logs) {
    logCountByEmployee.set(log.employeeId, (logCountByEmployee.get(log.employeeId) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Employees</h1>
      <p className="mt-1 text-sm text-zinc-500">Everyone with a Toph account on {user.farmName}</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-2 py-3 font-medium">Role</th>
              <th className="px-2 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Logged Activities</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-zinc-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={e.name} avatarColor={e.avatarColor} avatarImage={e.avatarImage} size={28} />
                    {e.name}
                  </div>
                </td>
                <td className="px-2 py-3 capitalize text-zinc-600">{e.role}</td>
                <td className="px-2 py-3 text-zinc-500">{e.email}</td>
                <td className="px-5 py-3 text-zinc-500">{logCountByEmployee.get(e.id) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
