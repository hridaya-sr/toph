import { getCurrentUser } from "@/lib/dal";
import {
  getAnnouncementsForFarm,
  getConversationsForUser,
  getFarmMembersForMessaging,
  getMessagesBetween,
} from "@/lib/queries";
import { AnnouncementsBoard } from "@/components/announcements-board";
import { DirectMessages } from "@/components/direct-messages";
import { MessagesTabs } from "@/components/messages-tabs";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  // An admin in spectator mode (viewing as an employee) never sees that
  // employee's direct messages — only Announcements are visible — so the
  // Direct Messages tab is forced off and its data is never fetched.
  const isImpersonating = !!user.impersonatedBy;
  const tab: "announcements" | "direct" = !isImpersonating && sp.tab === "direct" ? "direct" : "announcements";
  const withUserId = !isImpersonating && typeof sp.with === "string" ? sp.with : undefined;

  const [announcements, conversations, farmMembers, thread] = await Promise.all([
    getAnnouncementsForFarm(user.farmId, user.id),
    isImpersonating ? Promise.resolve([]) : getConversationsForUser(user.farmId, user.id),
    isImpersonating ? Promise.resolve([]) : getFarmMembersForMessaging(user.farmId, user.id),
    withUserId ? getMessagesBetween(user.farmId, user.id, withUserId) : Promise.resolve([]),
  ]);

  const unreadAnnouncementCount = announcements.filter((a) => !a.readAt).length;
  const unreadDirectCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="px-[30px] py-[30px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-black">Messages</h1>
        <p className="mt-1 text-base text-[#4d4d4d]">
          {user.role === "admin"
            ? "Post farm-wide announcements, or message someone directly."
            : "Announcements from your farm's admin, and direct messages."}
        </p>
      </div>
      <MessagesTabs
        tab={tab}
        showDirectTab={!isImpersonating}
        unreadAnnouncementCount={unreadAnnouncementCount}
        unreadDirectCount={isImpersonating ? 0 : unreadDirectCount}
        announcementsSlot={
          <AnnouncementsBoard announcements={announcements} canPost={user.role === "admin"} disabled={isImpersonating} />
        }
        directSlot={
          isImpersonating ? null : (
            <DirectMessages
              currentUserId={user.id}
              conversations={conversations}
              farmMembers={farmMembers}
              selectedUserId={withUserId ?? null}
              thread={thread}
            />
          )
        }
      />
    </div>
  );
}
