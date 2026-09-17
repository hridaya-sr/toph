"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChartLine,
  AudioLines,
  Map as MapIcon,
  BookCheck,
  Files,
  Calendar,
  Users,
  ChartPie,
  Mail,
  Cog,
  Handshake,
  ArrowRightLeft,
  LogOut,
  UserStar,
  Inbox,
  ChevronDown,
} from "lucide-react";
import { logout, switchUser, returnToAdmin } from "@/app/actions/auth";
import { useNewLogs } from "@/components/new-logs-context";
import { Avatar } from "@/components/avatar";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  // Farm-wide management tooling an individual employee has no reason to
  // see — hidden from their sidebar entirely rather than shown and gated
  // only by a page-level redirect (that redirect still exists, as defense
  // in depth, but the point of this flag is presenting the right nav, not
  // being the only thing standing between an employee and the page).
  adminOnly?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: ChartLine },
      { label: "Activity Logs", href: "/dashboard/activity-logs", icon: AudioLines },
      { label: "Map", href: "/dashboard/map", icon: MapIcon },
    ],
  },
  {
    label: "Compliance",
    items: [
      { label: "Audit Manager", href: "/dashboard/audit-manager", icon: BookCheck, adminOnly: true },
      { label: "Reports", href: "/dashboard/reports", icon: Files, adminOnly: true },
      { label: "Schedule", href: "/dashboard/schedule", icon: Calendar },
    ],
  },
  {
    label: "Team Management",
    items: [
      { label: "Employees", href: "/dashboard/employees", icon: Users, adminOnly: true },
      { label: "Performance", href: "/dashboard/performance", icon: ChartPie, adminOnly: true },
      { label: "Messages", href: "/dashboard/messages", icon: Mail },
    ],
  },
  {
    label: "Other",
    items: [
      { label: "Settings", href: "/dashboard/settings", icon: Cog },
      { label: "Support", href: "/dashboard/support", icon: Handshake },
    ],
  },
];

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-[18px] min-w-[24px] items-center justify-center rounded-full border border-[#5B9973] bg-[#8CBF9F] px-1.5 text-[11px] font-semibold leading-none tabular-nums text-white">
      {count}
    </span>
  );
}

export function Sidebar({
  farmName,
  currentUser,
  otherUsers,
  canSwitchUser,
  viewingAsAdminName = null,
  scheduledShiftCount = 0,
  flaggedLogCount = 0,
  unreadMessageCount = 0,
  newEmployeeCount = 0,
}: {
  farmName: string;
  currentUser: { id: string; name: string; role: string; avatarColor: string | null; avatarImage: string | null };
  otherUsers: { id: string; name: string; role: string }[];
  canSwitchUser: boolean;
  viewingAsAdminName?: string | null;
  // Every currently-scheduled (not yet completed) shift assigned to this
  // employee — see getScheduledShiftCountForEmployee for why this counts
  // differently than the Dashboard badge above. Always 0 for an admin
  // (shifts aren't assigned to them), so the badge never renders there.
  scheduledShiftCount?: number;
  // Unreviewed logs needing admin attention (see getFlaggedLogCountForReview).
  // Shown on BOTH Audit Manager and Reports — Reports has no natural "new
  // item" concept of its own, and the two already share the Compliance nav
  // group, so this is the most defensible single number to reuse rather
  // than inventing a second, less-grounded metric. Always 0 for an
  // employee (both tabs are admin-only, hidden from their nav entirely).
  flaggedLogCount?: number;
  // Direct messages sent to this person that they haven't opened yet.
  unreadMessageCount?: number;
  // Employees (not admins) who joined the farm today — admin-only, always
  // 0 for an employee session.
  newEmployeeCount?: number;
}) {
  const pathname = usePathname();
  const { unseenCount } = useNewLogs();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const badgeCountByHref: Record<string, number> = {
    "/dashboard": unseenCount,
    "/dashboard/schedule": scheduledShiftCount,
    "/dashboard/audit-manager": flaggedLogCount,
    "/dashboard/reports": flaggedLogCount,
    "/dashboard/messages": unreadMessageCount,
    "/dashboard/employees": newEmployeeCount,
  };

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-2.5 text-black">
      <div>
        <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2">
          <div className="flex items-center gap-3">
            <Avatar name={currentUser.name} avatarColor={currentUser.avatarColor} avatarImage={currentUser.avatarImage} size={42} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-black">{farmName}</p>
              <p className="flex items-center gap-1 truncate text-sm text-[#808080]">
                <UserStar size={14} className="shrink-0" />
                <span className="capitalize">{currentUser.role}</span>
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/messages"
            className="shrink-0 text-[#4d4d4d] hover:text-black"
            aria-label="Inbox"
          >
            <Inbox size={16} />
          </Link>
        </div>

        <nav className="mt-2 flex flex-col gap-1">
          {NAV_GROUPS.map((group) => {
            const items = currentUser.role === "admin" ? group.items : group.items.filter((i) => !i.adminOnly);
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="flex flex-col gap-1">
                <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#b3b3b3]">
                  {group.label}
                </p>
                {items.map((item) => {
                  const active =
                    item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3.5 rounded px-2.5 py-2.5 text-sm transition-colors ${
                        active ? "bg-black/5" : "hover:bg-black/[0.03]"
                      }`}
                    >
                      <Icon size={16} className="shrink-0 text-[#4d4d4d]" />
                      <span className="flex-1 text-black">{item.label}</span>
                      <NavBadge count={badgeCountByHref[item.href] ?? 0} />
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>

      <div>
        {viewingAsAdminName ? (
          <div className="mb-1">
            <p className="px-2.5 pb-1.5 text-xs text-[#808080]">
              Viewing as <span className="font-medium text-black">{currentUser.name}</span>
            </p>
            <form action={returnToAdmin}>
              <button
                type="submit"
                className="flex w-full items-center gap-3.5 rounded px-2.5 py-2.5 text-sm text-black hover:bg-black/[0.03]"
              >
                <ArrowRightLeft size={16} className="text-[#4d4d4d]" />
                Switch back to {viewingAsAdminName}
              </button>
            </form>
          </div>
        ) : (
          canSwitchUser && (
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className="flex w-full items-center gap-3.5 rounded px-2.5 py-2.5 text-sm text-black hover:bg-black/[0.03]"
              >
                <ArrowRightLeft size={16} className="text-[#4d4d4d]" />
                Switch User
                <ChevronDown size={14} className="ml-auto text-[#4d4d4d]" />
              </button>
              {switcherOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
                  {otherUsers.length === 0 && (
                    <p className="px-2.5 py-1.5 text-xs text-[#808080]">No other accounts on this farm.</p>
                  )}
                  {otherUsers.map((u) => (
                    <form key={u.id} action={switchUser.bind(null, u.id)}>
                      <button
                        type="submit"
                        className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-sm text-black hover:bg-black/5"
                      >
                        <span>{u.name}</span>
                        <span className="text-xs capitalize text-[#808080]">{u.role}</span>
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          )
        )}
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3.5 rounded px-2.5 py-2.5 text-sm text-black hover:bg-black/[0.03]"
          >
            <LogOut size={16} className="text-[#4d4d4d]" />
            Log Out
          </button>
        </form>
      </div>
    </aside>
  );
}
