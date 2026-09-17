"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { format, parseISO } from "date-fns";
import { NewLogForm } from "@/components/new-log-form";
import { SearchBar } from "@/components/search-bar";
import { ActivityLogTable, LogRow, DateTimeRange } from "@/components/activity-log-table";

type Filters = {
  activity?: string;
  sort: "asc" | "desc";
  month: boolean;
  rangeStart?: string;
  rangeEnd?: string;
};

function isoRangeToDateTimeRange(rangeStart: string, rangeEnd: string): DateTimeRange | null {
  const start = parseISO(rangeStart);
  const end = parseISO(rangeEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return {
    startDate: format(start, "yyyy-MM-dd"),
    startTime: format(start, "HH:mm"),
    endDate: format(end, "yyyy-MM-dd"),
    endTime: format(end, "HH:mm"),
  };
}

function dateTimeToIso(date: string, time: string): string {
  return parseISO(`${date}T${time}`).toISOString();
}

export function ActivityLogsView({
  heading,
  subheading,
  logs,
  tableTitle,
  employees,
  fields,
  role,
  filters,
  isImpersonating,
}: {
  heading: string;
  subheading: string;
  logs: LogRow[];
  tableTitle: string;
  employees: { id: string; name: string }[];
  fields: { id: string; name: string }[];
  role: "admin" | "employee";
  filters: Filters;
  isImpersonating: boolean;
}) {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  // Re-derives the full query string from the current filters plus a patch,
  // then navigates — this is what makes Sort / This Month / Filter / Date &
  // Time Range actually change the data: the URL change re-runs the Server
  // Component page with new query params, which re-queries the database,
  // rather than filtering an already-fetched array on the client.
  const updateFilters = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    if (filters.activity) params.set("activity", filters.activity);
    params.set("sort", filters.sort);
    if (filters.month) params.set("month", "this");
    if (filters.rangeStart) params.set("rangeStart", filters.rangeStart);
    if (filters.rangeEnd) params.set("rangeEnd", filters.rangeEnd);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const dateRangeFilter =
    filters.rangeStart && filters.rangeEnd ? isoRangeToDateTimeRange(filters.rangeStart, filters.rangeEnd) : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-black">{heading}</h1>
          <p className="mt-1 text-base text-[#4d4d4d]">{subheading}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {role === "admin" ? (
            <NewLogForm employees={employees} fields={fields} disabled={isImpersonating} />
          ) : (
            <NewLogForm
              employees={employees}
              fields={fields}
              triggerLabel="Log New Entry"
              formTitle="Log Your Work"
              disabled={isImpersonating}
            />
          )}
          <SearchBar value={search} onChange={setSearch} placeholder="Search logs" />
        </div>
      </div>
      <ActivityLogTable
        logs={logs}
        title={tableTitle}
        searchQuery={search}
        showEmployeeColumn={role === "admin"}
        isImpersonating={isImpersonating}
        serverControlled
        sortDir={filters.sort}
        onSortDirChange={(dir) => updateFilters({ sort: dir })}
        thisMonthOnly={filters.month}
        onThisMonthChange={(value) => updateFilters({ month: value ? "this" : null })}
        activityFilter={filters.activity ?? "all"}
        onActivityFilterChange={(value) => updateFilters({ activity: value === "all" ? null : value })}
        dateRangeFilter={dateRangeFilter}
        onDateRangeChange={(range) =>
          updateFilters(
            range
              ? {
                  rangeStart: dateTimeToIso(range.startDate, range.startTime),
                  rangeEnd: dateTimeToIso(range.endDate, range.endTime),
                }
              : { rangeStart: null, rangeEnd: null }
          )
        }
      />
    </>
  );
}
