import { getCurrentUser } from "@/lib/dal";
import { getFarmEmployees } from "@/lib/queries";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();
  const employees = user.role === "admin" ? await getFarmEmployees(user.farmId) : [];
  const otherUsers = employees.filter((e) => e.id !== user.id);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50">
      <Sidebar
        farmName={user.farmName}
        currentUser={user}
        otherUsers={otherUsers}
        canSwitchUser={user.role === "admin"}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
