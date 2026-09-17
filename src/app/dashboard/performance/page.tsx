import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { ComingSoon } from "@/components/coming-soon";

export default async function PerformancePage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/dashboard");
  }
  return (
    <ComingSoon title="Performance" description="Trends in hours logged, response accuracy, and coverage over time." />
  );
}
