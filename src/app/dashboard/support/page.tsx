import { verifySession } from "@/lib/dal";
import { ComingSoon } from "@/components/coming-soon";

export default async function SupportPage() {
  await verifySession();
  return <ComingSoon title="Support" description="Get help from the Toph team." />;
}
