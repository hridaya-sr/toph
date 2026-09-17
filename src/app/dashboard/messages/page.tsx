import { verifySession } from "@/lib/dal";
import { ComingSoon } from "@/components/coming-soon";

export default async function MessagesPage() {
  await verifySession();
  return <ComingSoon title="Messages" description="Direct messages between admins and field employees." />;
}
