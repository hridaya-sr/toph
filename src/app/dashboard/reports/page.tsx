import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getFarmActivityLogsForReport } from "@/lib/queries";
import { ReportsView } from "@/components/reports-view";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  // The full history, once — ReportsView narrows it by whatever date range
  // is selected client-side. See the comment there for why.
  const logs = await getFarmActivityLogsForReport(user.farmId, "2000-01-01", "2100-01-01");

  return (
    <div className="px-[30px] py-[30px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-black">Reports</h1>
        <p className="mt-1 text-base text-[#4d4d4d]">Export activity and compliance reports by date range.</p>
      </div>
      <ReportsView logs={logs} />
    </div>
  );
}
