"use client";

import { useRouter, usePathname } from "next/navigation";

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold leading-none text-white">
      {count}
    </span>
  );
}

export function MessagesTabs({
  tab,
  showDirectTab = true,
  unreadAnnouncementCount = 0,
  unreadDirectCount = 0,
  announcementsSlot,
  directSlot,
}: {
  tab: "announcements" | "direct";
  // False while an admin is in spectator mode — an employee's direct
  // messages are hidden entirely rather than merely disabled, so there's
  // nothing to switch to.
  showDirectTab?: boolean;
  // Unread counts, shown as a badge on the tab they belong to — not a
  // single generic badge, since only one tab (or neither) may actually
  // have something new.
  unreadAnnouncementCount?: number;
  unreadDirectCount?: number;
  announcementsSlot: React.ReactNode;
  directSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = showDirectTab && tab === "direct" ? "direct" : "announcements";

  return (
    <div>
      <div
        className={`mb-4 grid max-w-sm gap-1 rounded-lg bg-zinc-100 p-1 ${
          showDirectTab ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        <button
          type="button"
          onClick={() => router.push(`${pathname}?tab=announcements`)}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors ${
            activeTab === "announcements" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Announcements
          <TabBadge count={unreadAnnouncementCount} />
        </button>
        {showDirectTab && (
          <button
            type="button"
            onClick={() => router.push(`${pathname}?tab=direct`)}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors ${
              activeTab === "direct" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Direct Messages
            <TabBadge count={unreadDirectCount} />
          </button>
        )}
      </div>
      {activeTab === "announcements" ? announcementsSlot : directSlot}
    </div>
  );
}
