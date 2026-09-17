"use client";

import { useRouter, usePathname } from "next/navigation";

export function MessagesTabs({
  tab,
  announcementsSlot,
  directSlot,
}: {
  tab: "announcements" | "direct";
  announcementsSlot: React.ReactNode;
  directSlot: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div>
      <div className="mb-4 grid max-w-sm grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => router.push(`${pathname}?tab=announcements`)}
          className={`rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "announcements" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Announcements
        </button>
        <button
          type="button"
          onClick={() => router.push(`${pathname}?tab=direct`)}
          className={`rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "direct" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Direct Messages
        </button>
      </div>
      {tab === "announcements" ? announcementsSlot : directSlot}
    </div>
  );
}
