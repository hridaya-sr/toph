"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addDays, addWeeks, format, isSameDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, X, Trash2, Check, Clock } from "lucide-react";
import { createShift, updateShift, deleteShift, completeShiftAndCreateLog } from "@/app/actions/shifts";
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from "@/lib/definitions";
import { Avatar } from "@/components/avatar";
import { parseTimeToMinutes } from "@/lib/time";

export type ShiftRow = {
  id: string;
  activityType: (typeof ACTIVITY_TYPES)[number] | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: "scheduled" | "completed";
  activityLogId: string | null;
  employeeId: string;
  employeeName: string;
  employeeAvatarColor: string | null;
  employeeAvatarImage: string | null;
  fieldId: string | null;
  fieldName: string | null;
};

// A calendar week starts on Sunday here (matches JS Date.getDay()'s own
// 0-indexed convention, so the day-index math throughout stays simple).
function startOfWeekSunday(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

const GRID_START_MINUTES = 5 * 60; // 5:00 AM
const GRID_END_MINUTES = 21 * 60; // 9:00 PM
const PIXELS_PER_MINUTE = 0.8; // 48px per hour
const SNAP_MINUTES = 15;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_HEIGHT = (GRID_END_MINUTES - GRID_START_MINUTES) * PIXELS_PER_MINUTE;

function minutesToLabel(mins: number) {
  let h = Math.floor(mins / 60);
  const m = ((mins % 60) + 60) % 60;
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

function snap(mins: number) {
  return Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES;
}

export function ScheduleCalendar({
  shifts,
  role,
  employees,
  fields,
  isImpersonating = false,
}: {
  shifts: ShiftRow[];
  role: "admin" | "employee";
  employees: { id: string; name: string }[];
  fields: { id: string; name: string }[];
  // True only while an admin is "viewing as" this employee. role is always
  // "employee" in that case (never "admin" — an admin can't impersonate
  // themself), so the drag-to-create path is already unreachable; this
  // just stops a scheduled shift from opening the "mark done" flow too.
  isImpersonating?: boolean;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => startOfWeekSunday(addWeeks(new Date(), weekOffset)), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = useMemo(() => new Date(), []);

  const [drag, setDrag] = useState<{ dayIndex: number; startMinutes: number; endMinutes: number } | null>(null);
  const [editorState, setEditorState] = useState<
    | { mode: "create"; dayDate: Date; startMinutes: number; endMinutes: number }
    | { mode: "edit"; shift: ShiftRow }
    | { mode: "complete"; shift: ShiftRow }
    | null
  >(null);

  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);

  const yToMinutes = (dayIndex: number, clientY: number) => {
    const col = columnRefs.current[dayIndex];
    if (!col) return GRID_START_MINUTES;
    const rect = col.getBoundingClientRect();
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    return snap(GRID_START_MINUTES + y / PIXELS_PER_MINUTE);
  };

  const handleColumnMouseDown = (dayIndex: number, e: React.MouseEvent) => {
    if (role !== "admin") return;
    if (e.button !== 0) return;
    const startMinutes = yToMinutes(dayIndex, e.clientY);
    setDrag({ dayIndex, startMinutes, endMinutes: startMinutes });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const endMinutes = yToMinutes(dayIndex, moveEvent.clientY);
      setDrag((prev) => (prev ? { ...prev, endMinutes } : prev));
    };
    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      const endMinutes = yToMinutes(dayIndex, upEvent.clientY);
      const lo = Math.min(startMinutes, endMinutes);
      const hi = Math.max(startMinutes, endMinutes);
      // A plain click (no real drag) becomes a default 1-hour shift instead
      // of a zero-length one.
      const finalEnd = hi - lo < SNAP_MINUTES ? Math.min(lo + 60, GRID_END_MINUTES) : hi;
      setDrag(null);
      setEditorState({ mode: "create", dayDate: days[dayIndex], startMinutes: lo, endMinutes: finalEnd });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = GRID_START_MINUTES; m <= GRID_END_MINUTES; m += 60) marks.push(m);
    return marks;
  }, []);

  return (
    <div className="rounded-[20px] border border-[#f2f2f2] bg-white">
      <div className="flex items-center justify-between border-b border-[#f2f2f2] px-[30px] py-5">
        <p className="text-base text-black">
          {format(days[0], "MMM d")} – {format(days[6], "MMM d, yyyy")}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e6e6e6] text-[#4d4d4d] hover:bg-zinc-50"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="rounded-full border border-[#e6e6e6] px-3 py-1.5 text-sm text-[#4d4d4d] hover:bg-zinc-50"
          >
            Today
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e6e6e6] text-[#4d4d4d] hover:bg-zinc-50"
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex px-[30px] py-4">
        <div className="w-14 shrink-0" />
        {days.map((day, i) => (
          <div
            key={i}
            className={`flex-1 text-center text-sm ${
              isSameDay(day, today) ? "font-semibold text-black" : "text-[#4d4d4d]"
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-[#b3b3b3]">{DAY_LABELS[i]}</p>
            <p
              className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${
                isSameDay(day, today) ? "bg-black text-white" : ""
              }`}
            >
              {format(day, "d")}
            </p>
          </div>
        ))}
      </div>

      <div className="flex px-[30px] pb-6">
        <div className="w-14 shrink-0">
          {hourMarks.map((m) => (
            <div key={m} style={{ height: 60 * PIXELS_PER_MINUTE }} className="relative">
              <span className="absolute -top-2 right-2 text-[10px] text-[#b3b3b3]">{minutesToLabel(m)}</span>
            </div>
          ))}
        </div>
        {days.map((day, dayIndex) => {
          const dayShifts = shifts.filter((s) => isSameDay(parseISO(s.shiftDate), day));
          return (
            <div
              key={dayIndex}
              ref={(el) => {
                columnRefs.current[dayIndex] = el;
              }}
              onMouseDown={(e) => handleColumnMouseDown(dayIndex, e)}
              style={{ height: GRID_HEIGHT }}
              className={`relative flex-1 border-l border-[#f2f2f2] ${
                isSameDay(day, today) ? "bg-emerald-50/30" : ""
              } ${role === "admin" ? "cursor-crosshair" : ""}`}
            >
              {hourMarks.map((m) => (
                <div
                  key={m}
                  style={{ top: (m - GRID_START_MINUTES) * PIXELS_PER_MINUTE }}
                  className="absolute left-0 right-0 border-t border-[#f2f2f2]"
                />
              ))}

              {drag && drag.dayIndex === dayIndex && (
                <div
                  style={{
                    top: (Math.min(drag.startMinutes, drag.endMinutes) - GRID_START_MINUTES) * PIXELS_PER_MINUTE,
                    height: Math.max(Math.abs(drag.endMinutes - drag.startMinutes), SNAP_MINUTES) * PIXELS_PER_MINUTE,
                  }}
                  className="pointer-events-none absolute left-1 right-1 rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-100/70"
                />
              )}

              {dayShifts.map((shift) => {
                const startMinutes = parseTimeToMinutes(shift.startTime) ?? GRID_START_MINUTES;
                const endMinutes = parseTimeToMinutes(shift.endTime) ?? startMinutes + 60;
                const top = (startMinutes - GRID_START_MINUTES) * PIXELS_PER_MINUTE;
                const height = Math.max((endMinutes - startMinutes) * PIXELS_PER_MINUTE, 22);
                const completed = shift.status === "completed";
                return (
                  <button
                    key={shift.id}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (role === "admin") {
                        setEditorState({ mode: "edit", shift });
                      } else if (!completed && !isImpersonating) {
                        setEditorState({ mode: "complete", shift });
                      }
                    }}
                    title={
                      role === "employee" && isImpersonating && !completed
                        ? "Switch back to your own account to mark this done."
                        : undefined
                    }
                    style={{ top, height }}
                    className={`absolute left-1 right-1 overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] leading-tight transition-colors ${
                      completed
                        ? "border-zinc-200 bg-zinc-100 text-zinc-500"
                        : "border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                    } ${role === "employee" && (completed || isImpersonating) ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <span className="flex items-center gap-1 font-medium">
                      {completed && <Check size={10} className="shrink-0" />}
                      {role === "admin" && (
                        <Avatar
                          name={shift.employeeName}
                          avatarColor={shift.employeeAvatarColor}
                          avatarImage={shift.employeeAvatarImage}
                          size={12}
                        />
                      )}
                      <span className="truncate">{role === "admin" ? shift.employeeName : "Assigned by admin"}</span>
                    </span>
                    <span className="block truncate opacity-80">
                      {shift.startTime} – {shift.endTime}
                      {shift.activityType ? ` · ${ACTIVITY_LABELS[shift.activityType]}` : ""}
                      {shift.fieldName ? ` · ${shift.fieldName}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {editorState?.mode === "create" && (
        <ShiftEditorModal
          initial={{
            employeeId: "",
            fieldId: "",
            activityType: "",
            shiftDate: format(editorState.dayDate, "yyyy-MM-dd"),
            startTime: minutesToLabel(editorState.startMinutes),
            endTime: minutesToLabel(editorState.endMinutes),
          }}
          employees={employees}
          fields={fields}
          onClose={() => setEditorState(null)}
        />
      )}
      {editorState?.mode === "edit" && (
        <ShiftEditorModal
          shiftId={editorState.shift.id}
          initial={{
            employeeId: editorState.shift.employeeId,
            fieldId: editorState.shift.fieldId ?? "",
            activityType: editorState.shift.activityType ?? "",
            shiftDate: editorState.shift.shiftDate,
            startTime: editorState.shift.startTime,
            endTime: editorState.shift.endTime,
          }}
          employees={employees}
          fields={fields}
          onClose={() => setEditorState(null)}
        />
      )}
      {editorState?.mode === "complete" && (
        <CompleteShiftModal shift={editorState.shift} fields={fields} onClose={() => setEditorState(null)} />
      )}
    </div>
  );
}

function ShiftEditorModal({
  shiftId,
  initial,
  employees,
  fields,
  onClose,
}: {
  shiftId?: string;
  initial: {
    employeeId: string;
    fieldId: string;
    activityType: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
  };
  employees: { id: string; name: string }[];
  fields: { id: string; name: string }[];
  onClose: () => void;
}) {
  const action = shiftId ? updateShift.bind(null, shiftId) : createShift;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [isDeleting, startDeleteTransition] = useTransition();

  // onClose updates state in the PARENT (ScheduleCalendar), so it can't be
  // called during this component's own render — unlike NewLogForm's local
  // "close on success" (which only ever touches its own state and is safe
  // to run during render), this needs an effect to defer the call until
  // after commit.
  useEffect(() => {
    if (state?.message === "success") {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleDelete = () => {
    if (!shiftId) return;
    if (!window.confirm("Delete this shift? This can't be undone.")) return;
    startDeleteTransition(async () => {
      await deleteShift(shiftId);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900">{shiftId ? "Edit Shift" : "New Shift"}</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900">
            <X size={18} />
          </button>
        </div>
        <form action={formAction} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Employee</label>
            <select
              name="employeeId"
              required
              defaultValue={initial.employeeId}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            >
              <option value="" disabled>
                Select an employee
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            {state?.errors?.employeeId && <p className="mt-1 text-xs text-red-600">{state.errors.employeeId[0]}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Activity</label>
            <select
              name="activityType"
              defaultValue={initial.activityType}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            >
              <option value="">Employee chooses when they complete it</option>
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
              defaultValue={initial.fieldId}
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
              name="shiftDate"
              required
              defaultValue={initial.shiftDate}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
            {state?.errors?.shiftDate && <p className="mt-1 text-xs text-red-600">{state.errors.shiftDate[0]}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Start time</label>
              <input
                type="text"
                name="startTime"
                placeholder="6:00 AM"
                required
                defaultValue={initial.startTime}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              />
              {state?.errors?.startTime && <p className="mt-1 text-xs text-red-600">{state.errors.startTime[0]}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">End time</label>
              <input
                type="text"
                name="endTime"
                placeholder="10:00 AM"
                required
                defaultValue={initial.endTime}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              />
              {state?.errors?.endTime && <p className="mt-1 text-xs text-red-600">{state.errors.endTime[0]}</p>}
            </div>
          </div>
          {state?.message && state.message !== "success" && <p className="text-xs text-red-600">{state.message}</p>}
          <div className="flex items-center gap-2 pt-1">
            {shiftId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={14} />
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Done"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteShiftModal({
  shift,
  fields,
  onClose,
}: {
  shift: ShiftRow;
  fields: { id: string; name: string }[];
  onClose: () => void;
}) {
  const boundAction = completeShiftAndCreateLog.bind(null, shift.id);
  const [state, formAction, pending] = useActionState(boundAction, undefined);

  // See the matching comment in ShiftEditorModal — onClose touches the
  // parent's state, so it has to run in an effect, not during render.
  useEffect(() => {
    if (state?.message === "success") {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900">Mark Shift as Done</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900">
            <X size={18} />
          </button>
        </div>
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
          <Clock size={14} className="shrink-0" />
          {format(parseISO(shift.shiftDate), "EEEE, MMMM d")} · {shift.startTime} – {shift.endTime}
          {shift.activityType ? ` · ${ACTIVITY_LABELS[shift.activityType]}` : ""}
          {shift.fieldName ? ` · ${shift.fieldName}` : ""}
        </div>
        <form action={formAction} className="space-y-3">
          {!shift.activityType && (
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
              {state?.errors?.activityType && (
                <p className="mt-1 text-xs text-red-600">{state.errors.activityType[0]}</p>
              )}
            </div>
          )}
          {!shift.fieldId && (
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
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Notes</label>
            <textarea
              name="transcriptSummary"
              required
              rows={3}
              placeholder="What did you get done?"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
            {state?.errors?.transcriptSummary && (
              <p className="mt-1 text-xs text-red-600">{state.errors.transcriptSummary[0]}</p>
            )}
          </div>
          {state?.message && state.message !== "success" && <p className="text-xs text-red-600">{state.message}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Mark Done & Log It"}
          </button>
        </form>
      </div>
    </div>
  );
}
