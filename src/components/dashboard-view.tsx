"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ClipboardPen } from "lucide-react";
import { NewLogForm } from "@/components/new-log-form";
import { SearchBar } from "@/components/search-bar";
import { StatCards } from "@/components/stat-cards";
import { ActivityLogTable, LogRow } from "@/components/activity-log-table";

type Employee = { id: string; name: string; role: string };
type Field = { id: string; name: string };
type EmployeeMonthStats = { logsThisMonth: number; lastLogDate: string | null };

const ACTIVITY_LOGS_HREF = "/dashboard/activity-logs";

export function DashboardView({
  role,
  currentUserId,
  currentUserName,
  farmName,
  stats,
  logs,
  employees,
  fields,
  employeeMonthStats,
  isImpersonating,
}: {
  role: "admin" | "employee";
  currentUserId: string;
  currentUserName: string;
  farmName: string;
  stats: { todaysRecordings: number; activeWorkers: number; responseAccuracy: number };
  logs: LogRow[];
  employees: Employee[];
  fields: Field[];
  employeeMonthStats: EmployeeMonthStats | null;
  // True only while an admin is "viewing as" this employee — that's meant
  // to be read-only spectating, so every write affordance on this page
  // gets disabled on top of the server-side check in the actions
  // themselves. An admin's own (non-impersonated) session is never true.
  isImpersonating: boolean;
}) {
  if (role === "admin") {
    return (
      <AdminDashboard
        stats={stats}
        logs={logs}
        employees={employees.filter((e) => e.role === "employee")}
        fields={fields}
      />
    );
  }

  return (
    <EmployeeDashboard
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      farmName={farmName}
      logs={logs}
      fields={fields}
      monthStats={employeeMonthStats ?? { logsThisMonth: 0, lastLogDate: null }}
      isImpersonating={isImpersonating}
    />
  );
}

function AdminDashboard({
  stats,
  logs,
  employees,
  fields,
}: {
  stats: { todaysRecordings: number; activeWorkers: number; responseAccuracy: number };
  logs: LogRow[];
  employees: Employee[];
  fields: Field[];
}) {
  const [search, setSearch] = useState("");

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-black">Dashboard</h1>
          <p className="mt-1 text-base text-[#4d4d4d]">An overview of your farm and employee activity</p>
        </div>
        <div className="flex items-center gap-2.5">
          <NewLogForm employees={employees} fields={fields} />
          <SearchBar value={search} onChange={setSearch} placeholder="Search logs" />
        </div>
      </div>

      <div className="mb-2.5">
        <StatCards
          todaysRecordings={stats.todaysRecordings}
          activeWorkers={stats.activeWorkers}
          responseAccuracy={stats.responseAccuracy}
        />
      </div>

      <ActivityLogTable
        logs={logs}
        title="New Employee Logs"
        searchQuery={search}
        viewAllHref={ACTIVITY_LOGS_HREF}
        employees={employees}
        fields={fields}
      />
    </>
  );
}

function EmployeeDashboard({
  currentUserId,
  currentUserName,
  farmName,
  logs,
  fields,
  monthStats,
  isImpersonating,
}: {
  currentUserId: string;
  currentUserName: string;
  farmName: string;
  logs: LogRow[];
  fields: Field[];
  monthStats: EmployeeMonthStats;
  isImpersonating: boolean;
}) {
  const [search, setSearch] = useState("");

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-black">Dashboard</h1>
          <p className="mt-1 text-base text-[#4d4d4d]">
            Your recent work on {farmName}, {currentUserName.split(" ")[0]}
          </p>
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search my logs" />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[#f2f2f2] bg-white p-6">
        <div>
          <p className="flex items-center gap-2 text-base text-black">
            <ClipboardPen size={16} />
            Log your work
          </p>
          <p className="mt-1 text-sm text-[#4d4d4d]">Add a voice-logged entry for the work you did today.</p>
        </div>
        <NewLogForm
          employees={[{ id: currentUserId, name: currentUserName }]}
          fields={fields}
          triggerLabel="Log New Entry"
          formTitle="Log Your Work"
          triggerClassName="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          disabled={isImpersonating}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[14px] border border-[#f2f2f2] bg-white p-5">
          <p className="text-base text-black">Your logs this month</p>
          <p className="mt-3 text-5xl font-medium text-black">{monthStats.logsThisMonth}</p>
        </div>
        <div className="rounded-[14px] border border-[#f2f2f2] bg-white p-5">
          <p className="text-base text-black">Last logged</p>
          <p className="mt-3 text-2xl font-medium text-black">
            {monthStats.lastLogDate ? format(parseISO(monthStats.lastLogDate), "MMMM d") : "—"}
          </p>
        </div>
      </div>

      <ActivityLogTable
        logs={logs}
        title="My Activity Logs"
        searchQuery={search}
        viewAllHref={ACTIVITY_LOGS_HREF}
        showEmployeeColumn={false}
        isImpersonating={isImpersonating}
        fields={fields}
      />
    </>
  );
}
