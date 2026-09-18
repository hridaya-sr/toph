import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getActivityLogsForPerformance, getShiftsForPerformance, getFarmEmployees } from "@/lib/queries";
import { PerformanceView } from "@/components/performance-view";

export default async function PerformancePage() {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  // The full history, once — PerformanceView narrows it by whatever date
  // range is selected client-side, same reasoning as Reports.
  const [logs, shifts, farmMembers] = await Promise.all([
    getActivityLogsForPerformance(user.farmId, "2000-01-01", "2100-01-01"),
    getShiftsForPerformance(user.farmId, "2000-01-01", "2100-01-01"),
    getFarmEmployees(user.farmId),
  ]);

  // Shifts/coverage are an employee-specific concept — admins aren't
  // assigned shifts, so they're excluded from the breakdown table.
  const employees = farmMembers.filter((m) => m.role === "employee");

  return (
    <div className="px-[30px] py-[30px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-black">Performance</h1>
        <p className="mt-1 text-base text-[#4d4d4d]">Trends in hours logged, response accuracy, and coverage over time.</p>
      </div>
      <PerformanceView logs={logs} shifts={shifts} employees={employees} />
    </div>
  );
}
