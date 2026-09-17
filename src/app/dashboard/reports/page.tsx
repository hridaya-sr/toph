import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { ComingSoon } from "@/components/coming-soon";

export default async function ReportsPage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/dashboard");
  }
  return <ComingSoon title="Reports" description="Export activity and compliance reports by date range." />;
}
