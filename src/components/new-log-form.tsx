"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { createActivityLog, NewLogState } from "@/app/actions/logs";
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from "@/lib/definitions";

export function NewLogForm({
  employees,
  fields,
}: {
  employees: { id: string; name: string }[];
  fields: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<NewLogState, FormData>(createActivityLog, undefined);

  if (state?.message === "success" && open) {
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        <Plus size={14} />
        New Employee Log
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">New Employee Log</p>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-900">
                <X size={18} />
              </button>
            </div>
            <form action={action} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Employee</label>
                <select
                  name="employeeId"
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Activity</label>
                <select
                  name="activityType"
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                >
                  {ACTIVITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ACTIVITY_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Field</label>
                <select
                  name="fieldId"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                >
                  <option value="">No specific field</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Date</label>
                <input
                  type="date"
                  name="logDate"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Start time</label>
                  <input
                    type="text"
                    name="startTime"
                    placeholder="6:00 AM"
                    required
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">End time</label>
                  <input
                    type="text"
                    name="endTime"
                    placeholder="10:00 AM"
                    required
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Summary</label>
                <textarea
                  name="transcriptSummary"
                  required
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                />
              </div>
              {state?.message && state.message !== "success" && (
                <p className="text-xs text-red-600">{state.message}</p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save Log"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
