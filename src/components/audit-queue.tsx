"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ShieldAlert, Check } from "lucide-react";
import { markLogReviewed } from "@/app/actions/logs";
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from "@/lib/definitions";
import { Avatar } from "@/components/avatar";

export type FlaggedLog = {
  id: string;
  activityType: (typeof ACTIVITY_TYPES)[number];
  logDate: string;
  startTime: string;
  endTime: string;
  transcriptSummary: string;
  transcriptQA: { key: string; prompt: string; answer: string }[];
  responseAccuracy: number;
  employeeId: string;
  employeeName: string;
  employeeAvatarColor: string | null;
  fieldName: string | null;
  tags: { id: string; name: string }[];
};

const FLAG_ACCURACY_THRESHOLD = 85;

export function AuditQueue({ logs }: { logs: FlaggedLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
        Nothing flagged for review right now.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <AuditQueueRow key={log.id} log={log} />
      ))}
    </div>
  );
}

function AuditQueueRow({ log }: { log: FlaggedLog }) {
  const [expanded, setExpanded] = useState(false);
  const [isReviewing, startTransition] = useTransition();

  const flagReasons: string[] = [];
  if (log.responseAccuracy < FLAG_ACCURACY_THRESHOLD) {
    flagReasons.push(`${log.responseAccuracy}% accuracy`);
  }
  for (const tag of log.tags) {
    if (tag.name === "Low Confidence" || tag.name === "Follow-up") {
      flagReasons.push(tag.name);
    }
  }

  const handleMarkReviewed = () => {
    startTransition(async () => {
      await markLogReviewed(log.id);
    });
  };

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#f2f2f2] bg-white">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-zinc-50"
      >
        <Avatar name={log.employeeName} avatarColor={log.employeeAvatarColor} avatarImage={null} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-black">
            {log.employeeName} · {ACTIVITY_LABELS[log.activityType]}
          </p>
          <p className="mt-0.5 truncate text-xs text-[#808080]">
            {format(parseISO(log.logDate), "MMMM d, yyyy")} · {log.startTime} – {log.endTime}
            {log.fieldName ? ` · ${log.fieldName}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {flagReasons.map((reason) => (
            <span
              key={reason}
              className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700"
            >
              <ShieldAlert size={10} />
              {reason}
            </span>
          ))}
        </div>
        <ChevronDown size={16} className={`shrink-0 text-[#808080] transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-[#f2f2f2] px-5 py-4">
          <div>
            <p className="text-xs font-medium text-zinc-500">Summary</p>
            <p className="mt-1 text-sm text-black">&ldquo;{log.transcriptSummary}&rdquo;</p>
          </div>
          {log.transcriptQA.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500">Transcript Q&amp;A</p>
              {log.transcriptQA.map((qa) => (
                <div key={qa.key} className="rounded-lg bg-zinc-50 p-3 text-sm">
                  <p className="text-zinc-500">{qa.prompt}</p>
                  <p className="mt-1 text-black">{qa.answer}</p>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={handleMarkReviewed}
            disabled={isReviewing}
            className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            <Check size={14} />
            {isReviewing ? "Marking reviewed…" : "Mark Reviewed"}
          </button>
        </div>
      )}
    </div>
  );
}
