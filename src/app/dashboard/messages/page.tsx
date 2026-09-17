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
  const tab: "announcements" | "direct" = sp.tab === "direct" ? "direct" : "announcements";
  const withUserId = typeof sp.with === "string" ? sp.with : undefined;

  const [announcements, conversations, farmMembers, thread] = await Promise.all([
    getAnnouncementsForFarm(user.farmId),
    getConversationsForUser(user.farmId, user.id),
    getFarmMembersForMessaging(user.farmId, user.id),
    withUserId ? getMessagesBetween(user.farmId, user.id, withUserId) : Promise.resolve([]),
  ]);

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
        announcementsSlot={<AnnouncementsBoard announcements={announcements} canPost={user.role === "admin"} />}
        directSlot={
          <DirectMessages
            currentUserId={user.id}
            conversations={conversations}
            farmMembers={farmMembers}
            selectedUserId={withUserId ?? null}
            thread={thread}
            disabled={!!user.impersonatedBy}
          />
        }
      />
    </div>
  );
}
