import { getCurrentUser } from "@/lib/dal";
import {
  getFarmEmployees,
  getFarmUserById,
  getFlaggedLogCountForReview,
  getKnownLogIds,
  getScheduledShiftCountForEmployee,
  getTodaysNewLogIds,
  getUnreadAnnouncementCountForUser,
  getUnreadMessageCountForUser,
} from "@/lib/queries";
import { Sidebar } from "@/components/sidebar";
import { NewLogsProvider } from "@/components/new-logs-context";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();
  const isAdmin = user.role === "admin";
  const [employees, newLogIds, knownLogIds, impersonatingAdmin, scheduledShiftCount, flaggedLogCount, unreadDirectCount, unreadAnnouncementCount] =
    await Promise.all([
      isAdmin ? getFarmEmployees(user.farmId) : Promise.resolve([]),
      getTodaysNewLogIds(user.farmId),
      getKnownLogIds(user.farmId, isAdmin ? undefined : user.id),
      user.impersonatedBy ? getFarmUserById(user.farmId, user.impersonatedBy) : Promise.resolve(null),
      isAdmin ? Promise.resolve(0) : getScheduledShiftCountForEmployee(user.farmId, user.id),
      isAdmin ? getFlaggedLogCountForReview(user.farmId) : Promise.resolve(0),
      getUnreadMessageCountForUser(user.farmId, user.id),
      getUnreadAnnouncementCountForUser(user.farmId, user.id),
    ]);
  // The sidebar's single Messages badge is the combined total — the
  // Messages page itself (messages-tabs.tsx) is what breaks this down into
  // per-tab badges so it's clear which of Announcements/Direct Messages
  // actually has something unread.
  const unreadMessageCount = unreadDirectCount + unreadAnnouncementCount;
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
          canSwitchUser={isAdmin}
          viewingAsAdminName={impersonatingAdmin?.name ?? null}
          scheduledShiftCount={scheduledShiftCount}
          flaggedLogCount={flaggedLogCount}
          unreadMessageCount={unreadMessageCount}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </NewLogsProvider>
  );
}
