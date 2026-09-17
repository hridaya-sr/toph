"use client";

import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Download } from "lucide-react";
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from "@/lib/definitions";
import { parseTimeToMinutes } from "@/lib/time";

export type ReportLogRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  activityType: (typeof ACTIVITY_TYPES)[number];
  startTime: string;
  endTime: string;
  responseAccuracy: number;
  logDate: string;
};

function hoursFor(row: ReportLogRow): number {
  const start = parseTimeToMinutes(row.startTime);
  const end = parseTimeToMinutes(row.endTime);
  if (start === null || end === null || end <= start) return 0;
  return (end - start) / 60;
}

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// All of this farm's history is fetched once, server-side, and every date-
// range change here just re-filters/re-aggregates that same array client-
// side — reports over a small farm's data are cheap enough that this beats
// a network round trip per date change, unlike Activity Logs' filters
// (which need to scale to a much larger, paginated row set).
export function ReportsView({ logs }: { logs: ReportLogRow[] }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(today);

  const filtered = useMemo(
    () => logs.filter((l) => l.logDate >= startDate && l.logDate <= endDate),
    [logs, startDate, endDate]
  );

  const byEmployee = useMemo(() => {
    const map = new Map<string, { name: string; count: number; hours: number; accuracySum: number }>();
    for (const row of filtered) {
      const entry = map.get(row.employeeId) ?? { name: row.employeeName, count: 0, hours: 0, accuracySum: 0 };
      entry.count += 1;
      entry.hours += hoursFor(row);
      entry.accuracySum += row.responseAccuracy;
      map.set(row.employeeId, entry);
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, avgAccuracy: e.count ? Math.round(e.accuracySum / e.count) : 0 }))
      .sort((a, b) => b.hours - a.hours);
  }, [filtered]);

  const byActivity = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filtered) {
      map.set(row.activityType, (map.get(row.activityType) ?? 0) + 1);
    }
    return ACTIVITY_TYPES.map((type) => ({ type, label: ACTIVITY_LABELS[type], count: map.get(type) ?? 0 })).filter(
      (r) => r.count > 0
    );
  }, [filtered]);

  const totalHours = byEmployee.reduce((sum, e) => sum + e.hours, 0);
  const overallAccuracy = filtered.length
    ? Math.round(filtered.reduce((sum, r) => sum + r.responseAccuracy, 0) / filtered.length)
    : 0;

  const handleExport = () => {
    const rows: (string | number)[][] = [
      [`Report: ${startDate} to ${endDate}`],
      [],
      ["Employee", "Logs", "Total Hours", "Avg Accuracy %"],
      ...byEmployee.map((e) => [e.name, e.count, e.hours.toFixed(1), e.avgAccuracy]),
      [],
      ["Activity Type", "Count"],
      ...byActivity.map((a) => [a.label, a.count]),
    ];
    downloadCsv(`toph-report-${startDate}-to-${endDate}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-[14px] border border-[#f2f2f2] bg-white p-5">
        <div className="flex items-end gap-3">
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
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[14px] border border-[#f2f2f2] bg-white p-5">
          <p className="text-sm text-[#4d4d4d]">Logs in range</p>
          <p className="mt-2 text-3xl font-medium text-black">{filtered.length}</p>
        </div>
        <div className="rounded-[14px] border border-[#f2f2f2] bg-white p-5">
          <p className="text-sm text-[#4d4d4d]">Total hours logged</p>
          <p className="mt-2 text-3xl font-medium text-black">{totalHours.toFixed(1)}</p>
        </div>
        <div className="rounded-[14px] border border-[#f2f2f2] bg-white p-5">
          <p className="text-sm text-[#4d4d4d]">Avg response accuracy</p>
          <p className="mt-2 text-3xl font-medium text-black">{overallAccuracy}%</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#f2f2f2] bg-white">
        <p className="border-b border-[#f2f2f2] px-5 py-4 text-sm font-medium text-black">Hours by employee</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e6e6e6] text-left text-xs text-[#808080]">
              <th className="px-5 py-3 font-normal">EMPLOYEE</th>
              <th className="px-5 py-3 font-normal">LOGS</th>
              <th className="px-5 py-3 font-normal">HOURS</th>
              <th className="px-5 py-3 font-normal">AVG ACCURACY</th>
            </tr>
          </thead>
          <tbody>
            {byEmployee.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-[#808080]">
                  No logs in this date range.
                </td>
              </tr>
            )}
            {byEmployee.map((e) => (
              <tr key={e.name} className="border-b border-[#f2f2f2] text-black">
                <td className="px-5 py-3">{e.name}</td>
                <td className="px-5 py-3">{e.count}</td>
                <td className="px-5 py-3">{e.hours.toFixed(1)}</td>
                <td className="px-5 py-3">{e.avgAccuracy}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#f2f2f2] bg-white">
        <p className="border-b border-[#f2f2f2] px-5 py-4 text-sm font-medium text-black">Activity type breakdown</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e6e6e6] text-left text-xs text-[#808080]">
              <th className="px-5 py-3 font-normal">ACTIVITY</th>
              <th className="px-5 py-3 font-normal">COUNT</th>
            </tr>
          </thead>
          <tbody>
            {byActivity.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-center text-sm text-[#808080]">
                  No logs in this date range.
                </td>
              </tr>
            )}
            {byActivity.map((a) => (
              <tr key={a.type} className="border-b border-[#f2f2f2] text-black">
                <td className="px-5 py-3">{a.label}</td>
                <td className="px-5 py-3">{a.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
