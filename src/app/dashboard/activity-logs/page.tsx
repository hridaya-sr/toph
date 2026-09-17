import { format, startOfMonth, endOfMonth } from "date-fns";
import { getCurrentUser } from "@/lib/dal";
import { getActivityLogsForFarm, getFarmEmployees, getFarmFields } from "@/lib/queries";
import { ACTIVITY_TYPES } from "@/lib/definitions";
import { ActivityLogsView } from "@/components/activity-logs-view";

type SearchParams = { [key: string]: string | string[] | undefined };

function parseFilters(sp: SearchParams) {
  const activityParam = typeof sp.activity === "string" ? sp.activity : undefined;
  const activity = ACTIVITY_TYPES.find((t) => t === activityParam);
  const sort: "asc" | "desc" = sp.sort === "asc" ? "asc" : "desc";
  const month = sp.month === "this";
  const rangeStart = typeof sp.rangeStart === "string" ? sp.rangeStart : undefined;
  const rangeEnd = typeof sp.rangeEnd === "string" ? sp.rangeEnd : undefined;
  return { activity, sort, month, rangeStart, rangeEnd };
}

export default async function ActivityLogsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  const filters = parseFilters(await searchParams);

  let startDate: string | undefined;
  let endDate: string | undefined;
  let rangeStart: Date | undefined;
  let rangeEnd: Date | undefined;

  if (filters.rangeStart && filters.rangeEnd) {
    const parsedStart = new Date(filters.rangeStart);
    const parsedEnd = new Date(filters.rangeEnd);
    if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
      rangeStart = parsedStart;
      rangeEnd = parsedEnd;
      startDate = format(parsedStart, "yyyy-MM-dd");
      endDate = format(parsedEnd, "yyyy-MM-dd");
    }
  } else if (filters.month) {
    const now = new Date();
    startDate = format(startOfMonth(now), "yyyy-MM-dd");
    endDate = format(endOfMonth(now), "yyyy-MM-dd");
  }

  const [logs, employees, fields] = await Promise.all([
    getActivityLogsForFarm(user.farmId, {
      // The real, complete history — but still scoped to the viewer's own
      // logs for an employee, matching the same authorization rule already
      // applied everywhere else (dashboard, log creation, deletion).
      employeeId: user.role === "admin" ? undefined : user.id,
      activityType: filters.activity,
      startDate,
      endDate,
      rangeStart,
      rangeEnd,
      sort: filters.sort,
    }),
    // Only admins need the full roster (to attribute a log to someone
    // else); an employee's own log form only ever offers themselves, so
    // skip fetching coworkers' names/emails for their session entirely.
    user.role === "admin" ? getFarmEmployees(user.farmId) : Promise.resolve([]),
    getFarmFields(user.farmId),
  ]);

  return (
    <div className="px-[30px] py-[30px]">
      <ActivityLogsView
        heading="Activity Logs"
        subheading={
          user.role === "admin" ? `Every voice-logged entry across ${user.farmName}` : "Your voice-logged activity"
        }
        logs={logs}
        tableTitle={user.role === "admin" ? "All Activity Logs" : "My Activity Logs"}
        role={user.role}
        employees={
          user.role === "admin" ? employees.filter((e) => e.role === "employee") : [{ id: user.id, name: user.name }]
        }
        fields={fields}
        filters={{
          activity: filters.activity,
          sort: filters.sort,
          month: filters.month,
          rangeStart: filters.rangeStart,
          rangeEnd: filters.rangeEnd,
        }}
      />
    </div>
  );
}
