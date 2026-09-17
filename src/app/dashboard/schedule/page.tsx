import { verifySession } from "@/lib/dal";
import { ComingSoon } from "@/components/coming-soon";

export default async function SchedulePage() {
  await verifySession();
  return <ComingSoon title="Schedule" description="Plan upcoming field work and assign it to employees." />;
}
