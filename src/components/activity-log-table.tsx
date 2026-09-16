"use client";

import { useMemo, useState, useTransition } from "react";
import { format, parseISO, isSameMonth } from "date-fns";
import { Play, Pause, Plus, X, Maximize2, ArrowUpDown, Filter as FilterIcon } from "lucide-react";
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from "@/lib/definitions";
import { addTagToLog, removeTagFromLog } from "@/app/actions/logs";
import { FieldMap } from "@/components/field-map-loader";

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

export function ActivityLogTable({ logs, title }: { logs: LogRow[]; title: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [thisMonthOnly, setThisMonthOnly] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(() => {
    let rows = [...logs];
    if (thisMonthOnly) {
      const now = new Date();
      rows = rows.filter((r) => isSameMonth(parseISO(r.logDate), now));
    }
    if (activityFilter !== "all") {
      rows = rows.filter((r) => r.activityType === activityFilter);
    }
    rows.sort((a, b) => {
      const diff = new Date(a.logDate).getTime() - new Date(b.logDate).getTime();
      return sortDir === "asc" ? diff : -diff;
    });
    return rows;
  }, [logs, thisMonthOnly, activityFilter, sortDir]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3.5">
        <p className="text-sm font-medium text-zinc-900">
          {title} <span className="text-zinc-400">({filtered.length})</span>
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500">
            {format(new Date(), "MMM d, yyyy")}
          </span>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            <ArrowUpDown size={12} />
            Sort: {sortDir === "desc" ? "Newest" : "Oldest"}
          </button>
          <button
            onClick={() => setThisMonthOnly((v) => !v)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              thisMonthOnly ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            This Month
          </button>
          <div className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <FilterIcon size={12} />
              Filter
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
                <button
                  onClick={() => {
                    setActivityFilter("all");
                    setFilterOpen(false);
                  }}
                  className={`block w-full rounded px-2 py-1.5 text-left text-xs ${
                    activityFilter === "all" ? "bg-zinc-100 font-medium" : "hover:bg-zinc-50"
                  }`}
                >
                  All activities
                </button>
                {ACTIVITY_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setActivityFilter(type);
                      setFilterOpen(false);
                    }}
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
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
            <th className="w-10 px-5 py-2.5"></th>
            <th className="px-2 py-2.5 font-medium">Employee</th>
            <th className="px-2 py-2.5 font-medium">Activity</th>
            <th className="px-2 py-2.5 font-medium">Date</th>
            <th className="px-2 py-2.5 font-medium">Field</th>
            <th className="px-2 py-2.5 font-medium">Time</th>
            <th className="px-5 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-8 text-center text-sm text-zinc-400">
                No activity logs match these filters.
              </td>
            </tr>
          )}
          {filtered.map((log) => (
            <LogRowItem
              key={log.id}
              log={log}
              expanded={expandedId === log.id}
              onToggle={() => setExpandedId((id) => (id === log.id ? null : log.id))}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogRowItem({ log, expanded, onToggle }: { log: LogRow; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-b border-zinc-50 text-zinc-700 hover:bg-zinc-50/60">
        <td className="px-5 py-3">
          <input type="checkbox" className="rounded border-zinc-300" onClick={(e) => e.stopPropagation()} />
        </td>
        <td className="px-2 py-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: log.employeeAvatarColor ?? "#27272a" }}
            >
              {log.employeeName
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)}
            </span>
            {log.employeeName}
          </div>
        </td>
        <td className="px-2 py-3">{ACTIVITY_LABELS[log.activityType]}</td>
        <td className="px-2 py-3 text-zinc-500">{format(parseISO(log.logDate), "MMMM d, yyyy")}</td>
        <td className="px-2 py-3 text-zinc-500">{log.fieldName ?? "—"}</td>
        <td className="px-2 py-3 text-zinc-500">
          {log.startTime} - {log.endTime}
        </td>
        <td className="px-5 py-3 text-right">
          <button onClick={onToggle} className="text-xs font-medium text-zinc-900 underline underline-offset-2">
            {expanded ? "Close" : "View"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-zinc-100 bg-zinc-50/40">
          <td colSpan={7} className="px-5 py-5">
            <ExpandedEntry log={log} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedEntry({ log }: { log: LogRow }) {
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <AudioPlayer durationSeconds={log.audioDurationSeconds} />
        <TagEditor logId={log.id} tags={log.tags} />
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Summary</p>
          <p className="rounded-lg bg-white p-3 text-sm leading-relaxed text-zinc-700 ring-1 ring-zinc-100">
            {log.transcriptSummary}
          </p>
        </div>
        {log.transcriptQA.length > 0 && (
          <div className="space-y-2">
            {log.transcriptQA.map((qa) => (
              <div key={qa.key} className="rounded-lg bg-white p-3 text-sm ring-1 ring-zinc-100">
                <p className="text-xs font-medium text-zinc-400">{qa.prompt}</p>
                <p className="mt-1 text-zinc-700">&ldquo;{qa.answer}&rdquo;</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>Recorded {format(new Date(log.recordedAt), "MMM d, yyyy 'at' h:mm a")}</span>
          <span>&middot;</span>
          <span>{log.responseAccuracy}% response accuracy</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{log.fieldName ?? "Field"}</p>
          <button
            onClick={() => setMapOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            <Maximize2 size={12} />
            Expand Map
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
          interactive={false}
        />
      </div>

      {mapOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
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
  return Array.from({ length: 40 }, () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return 6 + Math.round((x / 2147483648) * 22);
  });
}

function AudioPlayer({ durationSeconds }: { durationSeconds: number }) {
  const [playing, setPlaying] = useState(false);
  const bars = useMemo(() => waveformBars(durationSeconds), [durationSeconds]);

  if (durationSeconds <= 0) {
    return (
      <div className="rounded-lg bg-white p-3 text-xs text-zinc-400 ring-1 ring-zinc-100">
        No audio recording — this log was entered manually.
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-zinc-100">
      <div className="flex h-10 items-end gap-[2px]">
        {bars.map((h, i) => (
          <span key={i} className="w-[3px] rounded-full bg-zinc-300" style={{ height: h }} />
        ))}
      </div>
      <button
        onClick={() => setPlaying((v) => !v)}
        className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
        {playing ? "Playing…" : "Play Recording"}
        <span className="text-emerald-200">
          ({Math.floor(durationSeconds / 60)}:{String(durationSeconds % 60).padStart(2, "0")})
        </span>
      </button>
    </div>
  );
}

function TagEditor({ logId, tags }: { logId: string; tags: { id: string; name: string }[] }) {
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
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"
        >
          {tag.name}
          <button
            onClick={() => startTransition(async () => removeTagFromLog(logId, tag.id))}
            className="text-zinc-400 hover:text-zinc-900"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {adding ? (
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
          className="w-28 rounded-full border border-zinc-300 px-2.5 py-1 text-xs outline-none focus:border-zinc-900"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={isPending}
          className="flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
        >
          <Plus size={10} />
          Add Tag
        </button>
      )}
    </div>
  );
}
