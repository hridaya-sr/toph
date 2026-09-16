"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Map as MapIcon,
  ShieldCheck,
  FileBarChart,
  CalendarClock,
  Users,
  TrendingUp,
  MessageSquare,
  Settings,
  LifeBuoy,
  ChevronDown,
  LogOut,
  Repeat,
} from "lucide-react";
import { logout, switchUser } from "@/app/actions/auth";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ size?: number; className?: string }> };

const NAV_GROUPS: { items: NavItem[] }[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Activity Logs", href: "/dashboard/activity-logs", icon: ClipboardList },
      { label: "Map", href: "/dashboard/map", icon: MapIcon },
    ],
  },
  {
    items: [
      { label: "Audit Manager", href: "/dashboard/audit-manager", icon: ShieldCheck },
      { label: "Reports", href: "/dashboard/reports", icon: FileBarChart },
      { label: "Schedule", href: "/dashboard/schedule", icon: CalendarClock },
    ],
  },
  {
    items: [
      { label: "Employees", href: "/dashboard/employees", icon: Users },
      { label: "Performance", href: "/dashboard/performance", icon: TrendingUp },
      { label: "Messages", href: "/dashboard/messages", icon: MessageSquare },
    ],
  },
  {
    items: [
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
      { label: "Support", href: "/dashboard/support", icon: LifeBuoy },
    ],
  },
];

export function Sidebar({
  farmName,
  currentUser,
  otherUsers,
  canSwitchUser,
}: {
  farmName: string;
  currentUser: { id: string; name: string; role: string; avatarColor: string | null };
  otherUsers: { id: string; name: string; role: string }[];
  canSwitchUser: boolean;
}) {
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col justify-between border-r border-zinc-800 bg-zinc-950 text-zinc-300">
      <div>
        <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-4">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold text-white"
            style={{ backgroundColor: currentUser.avatarColor ?? "#27272a" }}
          >
            {farmName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{farmName}</p>
            <p className="truncate text-xs capitalize text-zinc-500">{currentUser.role}</p>
          </div>
        </div>

        <nav className="mt-3 flex flex-col gap-4 px-2">
          {NAV_GROUPS.map((group, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? "bg-white text-zinc-900 font-medium"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
              {i < NAV_GROUPS.length - 1 && <div className="mx-2.5 mt-2 border-t border-zinc-800" />}
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-zinc-800 p-2">
        {canSwitchUser && (
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            >
              <Repeat size={16} />
              Switch User
              <ChevronDown size={14} className="ml-auto" />
            </button>
            {switcherOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-1 shadow-lg">
                {otherUsers.length === 0 && (
                  <p className="px-2.5 py-1.5 text-xs text-zinc-500">No other accounts on this farm.</p>
                )}
                {otherUsers.map((u) => (
                  <form key={u.id} action={switchUser.bind(null, u.id)}>
                    <button
                      type="submit"
                      className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                    >
                      <span>{u.name}</span>
                      <span className="text-xs capitalize text-zinc-500">{u.role}</span>
                    </button>
                  </form>
                ))}
              </div>
            )}
          </div>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <LogOut size={16} />
            Log Out
          </button>
        </form>
      </div>
    </aside>
  );
}
