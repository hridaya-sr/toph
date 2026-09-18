"use client";

import { useMemo, useState } from "react";
import { format, subWeeks, startOfWeek, eachWeekOfInterval, isBefore } from "date-fns";
import { parseTimeToMinutes } from "@/lib/time";
import { TrendChart, TrendPoint } from "@/components/trend-chart";
import { Avatar } from "@/components/avatar";

export type PerformanceLogRow = {
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  responseAccuracy: number;
  logDate: string;
};

export type PerformanceShiftRow = {
  employeeId: string;
  employeeName: string;
  shiftDate: string;
  status: "scheduled" | "completed";
};

export type PerformanceEmployee = {
  id: string;
  name: string;
  avatarColor: string | null;
  avatarImage: string | null;
};

// Sentinel for "no single employee selected" — kept out of the real id
// space (uuids) rather than using null, so it can live directly as a
// <select> option value.
const ALL_EMPLOYEES = "all";

function hoursFor(row: { startTime: string; endTime: string }): number {
  const start = parseTimeToMinutes(row.startTime);
  const end = parseTimeToMinutes(row.endTime);
  if (start === null || end === null || end <= start) return 0;
  return (end - start) / 60;
}

// Weeks start Monday, matching the Schedule page's week convention elsewhere
// in this app.
const WEEK_OPTS = { weekStartsOn: 1 as const };

function weekKey(dateStr: string): string {
  return format(startOfWeek(new Date(`${dateStr}T00:00:00`), WEEK_OPTS), "yyyy-MM-dd");
}

// All of this farm's history is fetched once, server-side (see
// performance/page.tsx), and every date-range change here just re-filters/
// re-buckets that same array client-side — same reasoning as ReportsView.
export function PerformanceView({
  logs,
  shifts,
  employees,
}: {
  logs: PerformanceLogRow[];
  shifts: PerformanceShiftRow[];
  employees: PerformanceEmployee[];
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(format(subWeeks(new Date(), 12), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(today);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(ALL_EMPLOYEES);

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) ?? null;

  const filteredLogs = useMemo(
    () => logs.filter((l) => l.logDate >= startDate && l.logDate <= endDate),
    [logs, startDate, endDate]
  );
  const filteredShifts = useMemo(
    () => shifts.filter((s) => s.shiftDate >= startDate && s.shiftDate <= endDate),
    [shifts, startDate, endDate]
  );

  // The trend charts are the "in focus" view — farm-wide by default, or
  // narrowed to one employee's own logs/shifts when picked from the
  // dropdown. The by-employee table below stays farm-wide regardless, so
  // there's always a full-team view to compare the focused employee against.
  const focusLogs = useMemo(
    () => (selectedEmployee ? filteredLogs.filter((l) => l.employeeId === selectedEmployee.id) : filteredLogs),
    [filteredLogs, selectedEmployee]
  );
  const focusShifts = useMemo(
    () => (selectedEmployee ? filteredShifts.filter((s) => s.employeeId === selectedEmployee.id) : filteredShifts),
    [filteredShifts, selectedEmployee]
  );

  const weeks = useMemo(() => {
    const start = startOfWeek(new Date(`${startDate}T00:00:00`), WEEK_OPTS);
    const end = startOfWeek(new Date(`${endDate}T00:00:00`), WEEK_OPTS);
    if (isBefore(end, start)) return [start];
    return eachWeekOfInterval({ start, end }, WEEK_OPTS);
  }, [startDate, endDate]);

  const { hoursPoints, accuracyPoints, coveragePoints } = useMemo(() => {
    const hoursByWeek = new Map<string, number>();
    const accSumByWeek = new Map<string, number>();
    const accCountByWeek = new Map<string, number>();
    for (const log of focusLogs) {
      const wk = weekKey(log.logDate);
      hoursByWeek.set(wk, (hoursByWeek.get(wk) ?? 0) + hoursFor(log));
      accSumByWeek.set(wk, (accSumByWeek.get(wk) ?? 0) + log.responseAccuracy);
      accCountByWeek.set(wk, (accCountByWeek.get(wk) ?? 0) + 1);
    }

    const completedByWeek = new Map<string, number>();
    const totalByWeek = new Map<string, number>();
    for (const shift of focusShifts) {
      const wk = weekKey(shift.shiftDate);
      totalByWeek.set(wk, (totalByWeek.get(wk) ?? 0) + 1);
      if (shift.status === "completed") completedByWeek.set(wk, (completedByWeek.get(wk) ?? 0) + 1);
    }

    const hoursPoints: TrendPoint[] = [];
    const accuracyPoints: TrendPoint[] = [];
    const coveragePoints: TrendPoint[] = [];
    for (const weekStart of weeks) {
      const key = format(weekStart, "yyyy-MM-dd");
      const label = format(weekStart, "MMM d");

      hoursPoints.push({ label, value: Math.round((hoursByWeek.get(key) ?? 0) * 10) / 10 });

      const accCount = accCountByWeek.get(key) ?? 0;
      accuracyPoints.push({
        label,
        value: accCount ? Math.round(accSumByWeek.get(key)! / accCount) : null,
      });

      const total = totalByWeek.get(key) ?? 0;
      coveragePoints.push({
        label,
        value: total ? Math.round(((completedByWeek.get(key) ?? 0) / total) * 100) : null,
      });
    }
    return { hoursPoints, accuracyPoints, coveragePoints };
  }, [focusLogs, focusShifts, weeks]);

  const byEmployee = useMemo(() => {
    const hoursMap = new Map<string, number>();
    const accSumMap = new Map<string, number>();
    const accCountMap = new Map<string, number>();
    for (const log of filteredLogs) {
      hoursMap.set(log.employeeId, (hoursMap.get(log.employeeId) ?? 0) + hoursFor(log));
      accSumMap.set(log.employeeId, (accSumMap.get(log.employeeId) ?? 0) + log.responseAccuracy);
      accCountMap.set(log.employeeId, (accCountMap.get(log.employeeId) ?? 0) + 1);
    }

    const scheduledMap = new Map<string, number>();
    const completedMap = new Map<string, number>();
    for (const shift of filteredShifts) {
      scheduledMap.set(shift.employeeId, (scheduledMap.get(shift.employeeId) ?? 0) + 1);
      if (shift.status === "completed") {
        completedMap.set(shift.employeeId, (completedMap.get(shift.employeeId) ?? 0) + 1);
      }
    }

    return employees
      .map((e) => {
        const hours = hoursMap.get(e.id) ?? 0;
        const accCount = accCountMap.get(e.id) ?? 0;
        const avgAccuracy = accCount ? Math.round(accSumMap.get(e.id)! / accCount) : null;
        const scheduled = scheduledMap.get(e.id) ?? 0;
        const completed = completedMap.get(e.id) ?? 0;
        const coveragePct = scheduled ? Math.round((completed / scheduled) * 100) : null;
        return { id: e.id, name: e.name, hours, avgAccuracy, scheduled, completed, coveragePct };
      })
      .sort((a, b) => b.hours - a.hours);
  }, [filteredLogs, filteredShifts, employees]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#f2f2f2] bg-white p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Employee</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value={ALL_EMPLOYEES}>All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>
      </div>

      {selectedEmployee && (
        <div className="flex items-center justify-center gap-3 rounded-[14px] border border-[#f2f2f2] bg-white p-4">
          <Avatar
            name={selectedEmployee.name}
            avatarColor={selectedEmployee.avatarColor}
            avatarImage={selectedEmployee.avatarImage}
            size={36}
          />
          <div>
            <p className="text-sm font-medium text-black">{selectedEmployee.name}</p>
            <p className="text-xs text-[#808080]">Individual performance</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendChart
          title={selectedEmployee ? `${selectedEmployee.name}'s hours / week` : "Hours logged / week"}
          points={hoursPoints}
          color="#18181b"
          formatValue={(v) => `${v.toFixed(1)}h`}
        />
        <TrendChart
          title={selectedEmployee ? `${selectedEmployee.name}'s accuracy / week` : "Response accuracy / week"}
          points={accuracyPoints}
          color="#059669"
          formatValue={(v) => `${Math.round(v)}%`}
          yMax={100}
        />
        <TrendChart
          title={selectedEmployee ? `${selectedEmployee.name}'s coverage / week` : "Shift coverage / week"}
          points={coveragePoints}
          color="#2563eb"
          formatValue={(v) => `${Math.round(v)}%`}
          yMax={100}
          emptyMessage="No shifts scheduled in this range."
        />
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#f2f2f2] bg-white">
        <p className="border-b border-[#f2f2f2] px-5 py-4 text-sm font-medium text-black">By employee</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e6e6e6] text-left text-xs text-[#808080]">
              <th className="px-5 py-3 font-normal">EMPLOYEE</th>
              <th className="px-5 py-3 font-normal">HOURS LOGGED</th>
              <th className="px-5 py-3 font-normal">AVG ACCURACY</th>
              <th className="px-5 py-3 font-normal">SHIFTS COMPLETED</th>
              <th className="px-5 py-3 font-normal">COVERAGE</th>
            </tr>
          </thead>
          <tbody>
            {byEmployee.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-[#808080]">
                  No employees on this farm yet.
                </td>
              </tr>
            )}
            {byEmployee.map((e) => (
              <tr
                key={e.id}
                onClick={() => setSelectedEmployeeId((current) => (current === e.id ? ALL_EMPLOYEES : e.id))}
                className={`cursor-pointer border-b border-[#f2f2f2] text-black hover:bg-zinc-50 ${
                  e.id === selectedEmployeeId ? "bg-emerald-50" : ""
                }`}
              >
                <td className="px-5 py-3">{e.name}</td>
                <td className="px-5 py-3">{e.hours.toFixed(1)}</td>
                <td className="px-5 py-3">{e.avgAccuracy !== null ? `${e.avgAccuracy}%` : "—"}</td>
                <td className="px-5 py-3">{e.scheduled ? `${e.completed} / ${e.scheduled}` : "—"}</td>
                <td className="px-5 py-3">{e.coveragePct !== null ? `${e.coveragePct}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
