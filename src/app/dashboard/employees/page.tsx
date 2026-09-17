import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getFarmEmployees, getActivityLogsForFarm, getNewEmployeeCountToday } from "@/lib/queries";
import { EmployeesTable } from "@/components/employees-table";

export default async function EmployeesPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }
  const [employees, logs, newEmployeeCount] = await Promise.all([
    getFarmEmployees(user.farmId),
    getActivityLogsForFarm(user.farmId),
    getNewEmployeeCountToday(user.farmId),
  ]);

  const logCountByEmployee = new Map<string, number>();
  for (const log of logs) {
    logCountByEmployee.set(log.employeeId, (logCountByEmployee.get(log.employeeId) ?? 0) + 1);
  }

  const rows = employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    role: e.role,
    avatarColor: e.avatarColor,
    avatarImage: e.avatarImage,
    logCount: logCountByEmployee.get(e.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Employees</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Everyone with a Toph account on {user.farmName}
        {newEmployeeCount > 0
          ? ` — ${newEmployeeCount} new ${newEmployeeCount === 1 ? "employee" : "employees"} joined today.`
          : ""}
      </p>

      <div className="mt-6">
        <EmployeesTable employees={rows} />
      </div>
    </div>
  );
}
