import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { ComingSoon } from "@/components/coming-soon";

export default async function AuditManagerPage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/dashboard");
  }
  return (
    <ComingSoon
      title="Audit Manager"
      description="Review and approve edits made to activity logs after they were recorded."
    />
  );
}
