import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getFlaggedLogsForReview } from "@/lib/queries";
import { AuditQueue } from "@/components/audit-queue";

export default async function AuditManagerPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const logs = await getFlaggedLogsForReview(user.farmId);

  return (
    <div className="px-[30px] py-[30px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-black">Audit Manager</h1>
        <p className="mt-1 text-base text-[#4d4d4d]">
          Logs with low response accuracy or a flagged tag, waiting on review ({logs.length}).
        </p>
      </div>
      <AuditQueue logs={logs} />
    </div>
  );
}
