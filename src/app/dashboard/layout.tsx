import { getCurrentUser } from "@/lib/dal";
import { getFarmEmployees, getFarmUserById, getKnownLogIds, getTodaysNewLogIds } from "@/lib/queries";
import { Sidebar } from "@/components/sidebar";
import { NewLogsProvider } from "@/components/new-logs-context";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();
  const [employees, newLogIds, knownLogIds, impersonatingAdmin] = await Promise.all([
    user.role === "admin" ? getFarmEmployees(user.farmId) : Promise.resolve([]),
    getTodaysNewLogIds(user.farmId),
    getKnownLogIds(user.farmId, user.role === "admin" ? undefined : user.id),
    user.impersonatedBy ? getFarmUserById(user.farmId, user.impersonatedBy) : Promise.resolve(null),
  ]);
  const otherUsers = employees.filter((e) => e.id !== user.id);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <NewLogsProvider
      newLogIds={newLogIds}
      knownLogIds={knownLogIds}
      storageKey={`toph:seen-logs:${user.farmId}:${today}`}
    >
      <div className="flex h-screen w-full gap-2.5 overflow-hidden bg-white p-2.5">
        <Sidebar
          farmName={user.farmName}
          currentUser={user}
          otherUsers={otherUsers}
          canSwitchUser={user.role === "admin"}
          viewingAsAdminName={impersonatingAdmin?.name ?? null}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </NewLogsProvider>
  );
}
