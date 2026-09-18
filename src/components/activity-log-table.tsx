"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { format, parseISO, isSameMonth } from "date-fns";
import { Play, Pause, Star, X, Expand, ListFilter, Funnel, AudioLines, Mail, MailOpen, Trash2, CalendarClock, User, MapPin } from "lucide-react";
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from "@/lib/definitions";
import { addTagToLog, removeTagFromLog, deleteActivityLogs } from "@/app/actions/logs";
import { FieldMap } from "@/components/field-map-loader";
import { useNewLogs } from "@/components/new-logs-context";
import { parseTimeToMinutes } from "@/lib/time";

export type LogRow = {
  id: string;
  activityType: (typeof ACTIVITY_TYPES)[number];
  logDate: string;
  startTime: string;
  endTime: string;
  audioDurationSeconds: number;
  transcriptSummary: string;
  transcriptQA: { key: string; prompt: string; answer: string }[];
  responseAccuracy: number;
  recordedAt: string | Date;
  employeeId: string;
  employeeName: string;
  employeeAvatarColor: string | null;
  fieldId: string | null;
  fieldName: string | null;
  fieldCenterLat: number | null;
  fieldCenterLng: number | null;
  tags: { id: string; name: string }[];
};

const MIN_RANGE_MS = 60 * 60 * 1000;

export type DateTimeRange = { startDate: string; startTime: string; endDate: string; endTime: string };

function logStartTimestamp(row: LogRow): number | null {
  const minutes = parseTimeToMinutes(row.startTime);
  if (minutes === null) return null;
  return parseISO(row.logDate).getTime() + minutes * 60_000;
}

function combineDateTime(date: string, time: string): number {
  return parseISO(`${date}T${time}`).getTime();
}

export function ActivityLogTable({
  logs,
  title,
  searchQuery = "",
  viewAllHref,
  // An employee's own tables only ever contain their own logs, so an
  // EMPLOYEE column showing their own name on every row is pure noise —
  // hidden for those views, shown for admin views where it's the whole
  // point of the column.
  showEmployeeColumn = true,
  // True only while an admin is "viewing as" someone else — disables bulk
  // delete and tag editing (real mutations) on top of the server-side
  // checks in the actions themselves. Mark Read/Unread stays enabled since
  // that's just this browser tab's own sessionStorage, not a write.
  isImpersonating = false,
  // When true, `logs` is assumed to already reflect the current sort/
  // month/activity/date-range filters (fetched server-side by the parent —
  // see activity-logs-view.tsx), so this component stops re-filtering and
  // re-sorting an array that's already correct, and reports control
  // changes upward via the on*Change callbacks instead of tracking its own
  // filter state. Search stays a client-side text filter either way.
  // Uncontrolled (the default, used by the dashboard's small recent-logs
  // widget) keeps the original fully-local filtering behavior.
  serverControlled = false,
  sortDir: controlledSortDir,
  onSortDirChange,
  thisMonthOnly: controlledThisMonthOnly,
  onThisMonthChange,
  activityFilter: controlledActivityFilter,
  onActivityFilterChange,
  // Options for the Employee/Field filter dropdowns — the Employee one only
  // renders when showEmployeeColumn is also true (filtering by employee is
  // meaningless on a view that's already scoped to one person's own logs).
  employees = [],
  fields = [],
  employeeFilter: controlledEmployeeFilter,
  onEmployeeFilterChange,
  fieldFilter: controlledFieldFilter,
  onFieldFilterChange,
  dateRangeFilter: controlledDateRangeFilter,
  onDateRangeChange,
}: {
  logs: LogRow[];
  title: string;
  searchQuery?: string;
  viewAllHref?: string;
  showEmployeeColumn?: boolean;
  isImpersonating?: boolean;
  serverControlled?: boolean;
  sortDir?: "asc" | "desc";
  onSortDirChange?: (dir: "asc" | "desc") => void;
  thisMonthOnly?: boolean;
  onThisMonthChange?: (value: boolean) => void;
  activityFilter?: string;
  onActivityFilterChange?: (value: string) => void;
  employees?: { id: string; name: string }[];
  fields?: { id: string; name: string }[];
  employeeFilter?: string;
  onEmployeeFilterChange?: (value: string) => void;
  fieldFilter?: string;
  onFieldFilterChange?: (value: string) => void;
  dateRangeFilter?: DateTimeRange | null;
  onDateRangeChange?: (range: DateTimeRange | null) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localSortDir, setLocalSortDir] = useState<"desc" | "asc">("asc");
  const [localThisMonthOnly, setLocalThisMonthOnly] = useState(false);
  const [localActivityFilter, setLocalActivityFilter] = useState<string>("all");
  const [localEmployeeFilter, setLocalEmployeeFilter] = useState<string>("all");
  const [localFieldFilter, setLocalFieldFilter] = useState<string>("all");
  const [localDateRangeFilter, setLocalDateRangeFilter] = useState<DateTimeRange | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [employeeFilterOpen, setEmployeeFilterOpen] = useState(false);
  const [fieldFilterOpen, setFieldFilterOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateRangeButtonRef = useRef<HTMLButtonElement>(null);
  // The card this toolbar lives in clips overflow so its rounded corners
  // stay clean, which also clips this popover on a short table (few/no
  // rows — e.g. the dashboard's small recent-logs widget, or a filtered-
  // down result). Rendering it through a portal, positioned from the
  // button's own viewport coordinates, escapes that clipping entirely
  // instead of relying on the card's flow.
  const [dateRangePos, setDateRangePos] = useState<{ top: number; right: number } | null>(null);
  const [draftRange, setDraftRange] = useState<DateTimeRange>({
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "10:00",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleting, startDeleteTransition] = useTransition();
  const { markRead, markUnread } = useNewLogs();

  const sortDir = serverControlled ? (controlledSortDir ?? "desc") : localSortDir;
  const thisMonthOnly = serverControlled ? (controlledThisMonthOnly ?? false) : localThisMonthOnly;
  const activityFilter = serverControlled ? (controlledActivityFilter ?? "all") : localActivityFilter;
  const employeeFilter = serverControlled ? (controlledEmployeeFilter ?? "all") : localEmployeeFilter;
  const fieldFilter = serverControlled ? (controlledFieldFilter ?? "all") : localFieldFilter;
  const dateRangeFilter = serverControlled ? (controlledDateRangeFilter ?? null) : localDateRangeFilter;

  const handleSortToggle = () => {
    const next = sortDir === "desc" ? "asc" : "desc";
    if (serverControlled) onSortDirChange?.(next);
    else setLocalSortDir(next);
  };

  const handleThisMonthToggle = () => {
    const next = !thisMonthOnly;
    if (serverControlled) onThisMonthChange?.(next);
    else setLocalThisMonthOnly(next);
  };

  const handleActivityFilterSelect = (value: string) => {
    if (serverControlled) onActivityFilterChange?.(value);
    else setLocalActivityFilter(value);
    setFilterOpen(false);
  };

  const handleEmployeeFilterSelect = (value: string) => {
    if (serverControlled) onEmployeeFilterChange?.(value);
    else setLocalEmployeeFilter(value);
    setEmployeeFilterOpen(false);
  };

  const handleFieldFilterSelect = (value: string) => {
    if (serverControlled) onFieldFilterChange?.(value);
    else setLocalFieldFilter(value);
    setFieldFilterOpen(false);
  };

  const filtered = useMemo(() => {
    let rows = [...logs];
    if (!serverControlled) {
      if (thisMonthOnly) {
        const now = new Date();
        rows = rows.filter((r) => isSameMonth(parseISO(r.logDate), now));
      }
      if (activityFilter !== "all") {
        rows = rows.filter((r) => r.activityType === activityFilter);
      }
      if (employeeFilter !== "all") {
        rows = rows.filter((r) => r.employeeId === employeeFilter);
      }
      if (fieldFilter !== "all") {
        rows = rows.filter((r) => r.fieldId === fieldFilter);
      }
      if (dateRangeFilter) {
        const start = combineDateTime(dateRangeFilter.startDate, dateRangeFilter.startTime);
        const end = combineDateTime(dateRangeFilter.endDate, dateRangeFilter.endTime);
        rows = rows.filter((r) => {
          const ts = logStartTimestamp(r);
          return ts !== null && ts >= start && ts <= end;
        });
      }
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.employeeName, ACTIVITY_LABELS[r.activityType], r.fieldName ?? "", r.transcriptSummary]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    if (!serverControlled) {
      // Sorts by recordedAt (when the entry entered the system), matching
      // the server-side ORDER BY used once this table is server-controlled,
      // rather than logDate (the date the activity itself happened).
      rows.sort((a, b) => {
        const diff = new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
        return sortDir === "asc" ? diff : -diff;
      });
    }
    return rows;
  }, [logs, thisMonthOnly, activityFilter, employeeFilter, fieldFilter, dateRangeFilter, sortDir, searchQuery, serverControlled]);

  const visible = filtered;
  // Only meaningful as a live preview count when filtering happens locally
  // over the full set — once server-controlled, `logs` is already whatever
  // the current filters matched, so this count wouldn't be a useful preview.
  const thisMonthCount = useMemo(() => {
    if (serverControlled) return 0;
    const now = new Date();
    return logs.filter((r) => isSameMonth(parseISO(r.logDate), now)).length;
  }, [logs, serverControlled]);

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleSelectAll = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id)));
  };
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const draftRangeMs = useMemo(() => {
    const { startDate, startTime, endDate, endTime } = draftRange;
    if (!startDate || !startTime || !endDate || !endTime) return null;
    return combineDateTime(endDate, endTime) - combineDateTime(startDate, startTime);
  }, [draftRange]);
  const draftRangeValid = draftRangeMs !== null && draftRangeMs >= MIN_RANGE_MS;

  const openDateRangePicker = () => {
    setDraftRange(
      dateRangeFilter ?? {
        startDate: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endDate: format(new Date(), "yyyy-MM-dd"),
        endTime: "10:00",
      }
    );
    setDateRangeOpen((v) => {
      const next = !v;
      if (next && dateRangeButtonRef.current) {
        const rect = dateRangeButtonRef.current.getBoundingClientRect();
        setDateRangePos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      }
      return next;
    });
  };

  const applyDateRange = () => {
    if (!draftRangeValid) return;
    if (serverControlled) onDateRangeChange?.(draftRange);
    else setLocalDateRangeFilter(draftRange);
    setDateRangeOpen(false);
  };

  const clearDateRange = () => {
    if (serverControlled) onDateRangeChange?.(null);
    else setLocalDateRangeFilter(null);
    setDateRangeOpen(false);
  };

  const handleMarkRead = () => {
    markRead(Array.from(selected));
    setSelected(new Set());
  };

  const handleMarkUnread = () => {
    markUnread(Array.from(selected));
    setSelected(new Set());
  };

  const handleDelete = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const label = ids.length === 1 ? "this log" : `these ${ids.length} logs`;
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
    startDeleteTransition(async () => {
      await deleteActivityLogs(ids);
      setSelected(new Set());
    });
  };

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#f2f2f2] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f2f2f2] px-[30px] py-5">
        <div className="flex items-center gap-3">
          <p className="flex items-center gap-2.5 text-base text-black">
            <AudioLines size={16} />
            {title} <span className="text-black">({logs.length})</span>
          </p>
          {viewAllHref && (
            <Link href={viewAllHref} className="text-sm font-medium text-[#146c44] hover:text-[#0f5636]">
              View all
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSortToggle}
            className="flex items-center gap-2.5 rounded-full border border-[#e6e6e6] bg-white px-4 py-2 text-sm text-[#4d4d4d]"
          >
            <ListFilter size={14} />
            Sort
          </button>
          <button
            onClick={handleThisMonthToggle}
            className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-sm transition-colors ${
              thisMonthOnly ? "bg-black text-white" : "border border-[#e6e6e6] bg-white text-[#4d4d4d]"
            }`}
          >
            {thisMonthOnly && <X size={14} />}
            This Month{thisMonthOnly && !serverControlled ? ` (${thisMonthCount})` : ""}
          </button>
          <div className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-full border border-[#e6e6e6] bg-white px-4 py-2 text-sm text-[#4d4d4d]"
            >
              <Funnel size={14} />
              Activity
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
                <button
                  onClick={() => handleActivityFilterSelect("all")}
                  className={`block w-full rounded px-2 py-1.5 text-left text-xs ${
                    activityFilter === "all" ? "bg-zinc-100 font-medium" : "hover:bg-zinc-50"
                  }`}
                >
                  All activities
                </button>
                {ACTIVITY_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => handleActivityFilterSelect(type)}
                    className={`block w-full rounded px-2 py-1.5 text-left text-xs ${
                      activityFilter === type ? "bg-zinc-100 font-medium" : "hover:bg-zinc-50"
                    }`}
                  >
                    {ACTIVITY_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {showEmployeeColumn && employees.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setEmployeeFilterOpen((v) => !v)}
                className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-sm transition-colors ${
                  employeeFilter !== "all" ? "bg-black text-white" : "border border-[#e6e6e6] bg-white text-[#4d4d4d]"
                }`}
              >
                <User size={14} />
                {employeeFilter !== "all" ? (employees.find((e) => e.id === employeeFilter)?.name ?? "Employee") : "Employee"}
              </button>
              {employeeFilterOpen && (
                <div className="absolute right-0 z-10 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
                  <button
                    onClick={() => handleEmployeeFilterSelect("all")}
                    className={`block w-full rounded px-2 py-1.5 text-left text-xs ${
                      employeeFilter === "all" ? "bg-zinc-100 font-medium" : "hover:bg-zinc-50"
                    }`}
                  >
                    All employees
                  </button>
                  {employees.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => handleEmployeeFilterSelect(e.id)}
                      className={`block w-full rounded px-2 py-1.5 text-left text-xs ${
                        employeeFilter === e.id ? "bg-zinc-100 font-medium" : "hover:bg-zinc-50"
                      }`}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {fields.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setFieldFilterOpen((v) => !v)}
                className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-sm transition-colors ${
                  fieldFilter !== "all" ? "bg-black text-white" : "border border-[#e6e6e6] bg-white text-[#4d4d4d]"
                }`}
              >
                <MapPin size={14} />
                {fieldFilter !== "all" ? (fields.find((f) => f.id === fieldFilter)?.name ?? "Field") : "Field"}
              </button>
              {fieldFilterOpen && (
                <div className="absolute right-0 z-10 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
                  <button
                    onClick={() => handleFieldFilterSelect("all")}
                    className={`block w-full rounded px-2 py-1.5 text-left text-xs ${
                      fieldFilter === "all" ? "bg-zinc-100 font-medium" : "hover:bg-zinc-50"
                    }`}
                  >
                    All fields
                  </button>
                  {fields.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleFieldFilterSelect(f.id)}
                      className={`block w-full rounded px-2 py-1.5 text-left text-xs ${
                        fieldFilter === f.id ? "bg-zinc-100 font-medium" : "hover:bg-zinc-50"
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="relative">
            <button
              ref={dateRangeButtonRef}
              onClick={openDateRangePicker}
              className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-sm transition-colors ${
                dateRangeFilter ? "bg-black text-white" : "border border-[#e6e6e6] bg-white text-[#4d4d4d]"
              }`}
            >
              <CalendarClock size={14} />
              {dateRangeFilter
                ? `${format(combineDateTime(dateRangeFilter.startDate, dateRangeFilter.startTime), "MMM d, h:mm a")} – ${format(combineDateTime(dateRangeFilter.endDate, dateRangeFilter.endTime), "MMM d, h:mm a")}`
                : "Date & Time Range"}
              {dateRangeFilter && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    clearDateRange();
                  }}
                  className="ml-1 rounded-full p-0.5 hover:bg-white/20"
                  aria-label="Clear date & time range filter"
                >
                  <X size={12} />
                </span>
              )}
            </button>
            {dateRangeOpen &&
              dateRangePos &&
              createPortal(
                <div
                  style={{ position: "fixed", top: dateRangePos.top, right: dateRangePos.right }}
                  className="z-50 w-72 rounded-md border border-zinc-200 bg-white p-3 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-2 text-xs font-medium text-zinc-600">Start</p>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={draftRange.startDate}
                      onChange={(e) => setDraftRange((prev) => ({ ...prev, startDate: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:border-zinc-900"
                    />
                    <input
                      type="time"
                      value={draftRange.startTime}
                      onChange={(e) => setDraftRange((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:border-zinc-900"
                    />
                  </div>
                  <p className="mb-2 text-xs font-medium text-zinc-600">End</p>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={draftRange.endDate}
                      onChange={(e) => setDraftRange((prev) => ({ ...prev, endDate: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:border-zinc-900"
                    />
                    <input
                      type="time"
                      value={draftRange.endTime}
                      onChange={(e) => setDraftRange((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:border-zinc-900"
                    />
                  </div>
                  {!draftRangeValid && (
                    <p className="mb-3 text-xs text-red-600">
                      {draftRangeMs === null
                        ? "Fill in both start and end."
                        : "End must be at least 1 hour after start."}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={clearDateRange} className="text-xs text-[#808080] hover:text-black">
                      Clear
                    </button>
                    <button
                      onClick={applyDateRange}
                      disabled={!draftRangeValid}
                      className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Apply
                    </button>
                  </div>
                </div>,
                document.body
              )}
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-[#f2f2f2] bg-emerald-50 px-[30px] py-3">
          <p className="text-sm text-[#146c44]">{selected.size} selected</p>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleMarkRead}
              className="flex items-center gap-2 rounded-full border border-[#e6e6e6] bg-white px-4 py-2 text-sm text-[#4d4d4d] hover:bg-zinc-50"
            >
              <MailOpen size={14} />
              Mark Read
            </button>
            <button
              onClick={handleMarkUnread}
              className="flex items-center gap-2 rounded-full border border-[#e6e6e6] bg-white px-4 py-2 text-sm text-[#4d4d4d] hover:bg-zinc-50"
            >
              <Mail size={14} />
              Mark Unread
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting || isImpersonating}
              title={isImpersonating ? "Switch back to your own account to delete logs." : undefined}
              className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-sm text-[#808080] hover:text-black">
              Clear
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e6e6e6] text-left text-[#4d4d4d]">
            <th className="w-14 py-5 pl-[30px]">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                aria-label={allVisibleSelected ? "Deselect all" : "Select all"}
                className="rounded border-zinc-300"
              />
            </th>
            {showEmployeeColumn && <th className="px-5 py-5 font-normal">EMPLOYEE</th>}
            <th className="px-5 py-5 font-normal">ACTIVITY</th>
            <th className="px-5 py-5 font-normal">DATE</th>
            <th className="px-5 py-5 font-normal">FIELD</th>
            <th className="px-5 py-5 font-normal">TIME</th>
            <th className="py-5 pr-[30px]" />
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={showEmployeeColumn ? 7 : 6} className="px-[30px] py-8 text-center text-sm text-[#808080]">
                No activity logs match these filters.
              </td>
            </tr>
          )}
          {visible.map((log) => (
            <LogRowItem
              key={log.id}
              log={log}
              expanded={expandedId === log.id}
              onToggle={() => setExpandedId((id) => (id === log.id ? null : log.id))}
              selected={selected.has(log.id)}
              onToggleSelect={() => toggleSelect(log.id)}
              showEmployeeColumn={showEmployeeColumn}
              isImpersonating={isImpersonating}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogRowItem({
  log,
  expanded,
  onToggle,
  selected,
  onToggleSelect,
  showEmployeeColumn,
  isImpersonating,
}: {
  log: LogRow;
  expanded: boolean;
  onToggle: () => void;
  selected: boolean;
  onToggleSelect: () => void;
  showEmployeeColumn: boolean;
  isImpersonating: boolean;
}) {
  const { isNew, markSeen } = useNewLogs();
  const isUnseenNew = isNew(log.id);

  const handleView = () => {
    markSeen(log.id);
    onToggle();
  };

  return (
    <>
      <tr
        className={`border-b border-[#f2f2f2] text-[#4d4d4d] ${
          isUnseenNew ? "bg-emerald-50" : expanded ? "bg-[#f8f8f8]" : "bg-white"
        }`}
      >
        <td className="py-5 pl-[30px]">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select log for ${log.employeeName}`}
            className="rounded border-zinc-300"
            onClick={(e) => e.stopPropagation()}
          />
        </td>
        {showEmployeeColumn && <td className="px-5 py-5">{log.employeeName}</td>}
        <td className="px-5 py-5">{ACTIVITY_LABELS[log.activityType]}</td>
        <td className="px-5 py-5">{format(parseISO(log.logDate), "MMMM d, yyyy")}</td>
        <td className="px-5 py-5 uppercase">{log.fieldName ?? "—"}</td>
        <td className="px-5 py-5">
          {log.startTime} - {log.endTime}
        </td>
        <td className="py-5 pr-[30px] text-right">
          <button
            onClick={handleView}
            className={`rounded-full border px-4 py-2 text-sm text-[#4d4d4d] ${
              expanded ? "border-[#e6e6e6] bg-white" : "border-[#f2f2f2] bg-white"
            }`}
          >
            {expanded ? "Close" : "View"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#f2f2f2] bg-white">
          <td colSpan={showEmployeeColumn ? 7 : 6} className="p-10">
            <ExpandedEntry log={log} isImpersonating={isImpersonating} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedEntry({ log, isImpersonating }: { log: LogRow; isImpersonating: boolean }) {
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <div className="space-y-5">
        <AudioPlayer durationSeconds={log.audioDurationSeconds} />
        <TagEditor logId={log.id} tags={log.tags} isImpersonating={isImpersonating} />
        <div className="space-y-1">
          <p className="text-base text-black">Summary</p>
          <p className="text-base leading-relaxed text-black">&ldquo;{log.transcriptSummary}&rdquo;</p>
        </div>
      </div>

      <div className="space-y-5">
        {mapOpen ? (
          <div
            style={{ height: 335, borderRadius: 14, borderColor: "#e9e9e9" }}
            className="w-full border bg-zinc-50"
          />
        ) : (
          <FieldMap
            fields={[
              {
                id: log.fieldId ?? "unknown",
                name: log.fieldName ?? "Field",
                centerLat: log.fieldCenterLat,
                centerLng: log.fieldCenterLng,
              },
            ]}
            height={335}
            interactive={false}
            rounded={14}
            borderColor="#e9e9e9"
          />
        )}
        <button
          onClick={() => setMapOpen(true)}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-black bg-white py-2.5 text-base text-black hover:bg-zinc-50"
        >
          <Expand size={16} />
          Expand Map
        </button>
      </div>

      {mapOpen && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-6"
          onClick={() => setMapOpen(false)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <p className="text-sm font-medium">{log.fieldName ?? "Field"}</p>
              <button onClick={() => setMapOpen(false)} className="text-zinc-400 hover:text-zinc-900">
                <X size={18} />
              </button>
            </div>
            <FieldMap
              fields={[
                {
                  id: log.fieldId ?? "unknown",
                  name: log.fieldName ?? "Field",
                  centerLat: log.fieldCenterLat,
                  centerLng: log.fieldCenterLng,
                },
              ]}
              height={480}
              interactive
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Deterministic pseudo-random waveform derived from the log's own duration,
// so it's stable across renders without calling an impure RNG during render.
function waveformBars(seed: number) {
  let x = seed || 1;
  return Array.from({ length: 48 }, () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return 6 + Math.round((x / 2147483648) * 22);
  });
}

function AudioPlayer({ durationSeconds }: { durationSeconds: number }) {
  const [playing, setPlaying] = useState(false);
  const bars = useMemo(() => waveformBars(durationSeconds), [durationSeconds]);
  const playheadIndex = Math.round(bars.length * 0.56);

  if (durationSeconds <= 0) {
    return (
      <div className="rounded-lg bg-white py-2 text-sm text-[#808080]">
        No audio recording — this log was entered manually.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex h-12 items-center gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: i === playheadIndex ? 40 : h,
              backgroundColor: "#003930",
              opacity: i > playheadIndex ? 0.15 : 1,
            }}
          />
        ))}
      </div>
      <button
        onClick={() => setPlaying((v) => !v)}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-black bg-white py-2.5 text-base text-black hover:bg-zinc-50"
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
        {playing ? "Playing…" : "Play Recording"}
      </button>
    </div>
  );
}

function TagEditor({
  logId,
  tags,
  isImpersonating,
}: {
  logId: string;
  tags: { id: string; name: string }[];
  isImpersonating: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!value.trim()) {
      setAdding(false);
      return;
    }
    const tagName = value.trim();
    setValue("");
    setAdding(false);
    startTransition(async () => {
      await addTagToLog(logId, tagName);
    });
  }

  return (
    <div className="space-y-2.5">
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"
            >
              {tag.name}
              {!isImpersonating && (
                <button
                  onClick={() => startTransition(async () => removeTagFromLog(logId, tag.id))}
                  className="text-zinc-400 hover:text-zinc-900"
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!isImpersonating &&
        (adding ? (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Tag name…"
            className="w-full rounded-lg border border-[#146c44]/10 bg-[#146c44]/10 px-4 py-2.5 text-base text-[#146c44] outline-none placeholder:text-[#146c44]/60"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#146c44]/10 bg-[#146c44]/10 py-2.5 text-base text-[#146c44] hover:bg-[#146c44]/[0.15]"
          >
            <Star size={16} />
            Add Tag
          </button>
        ))}
    </div>
  );
}
