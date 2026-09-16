import { Mic, Users, Target } from "lucide-react";

export function StatCards({
  todaysRecordings,
  activeWorkers,
  responseAccuracy,
}: {
  todaysRecordings: number;
  activeWorkers: number;
  responseAccuracy: number;
}) {
  const cards = [
    {
      label: "Today's Recordings",
      value: todaysRecordings,
      sub: `${todaysRecordings} new`,
      icon: Mic,
    },
    {
      label: "Active Workers",
      value: activeWorkers,
      icon: Users,
    },
    {
      label: "% Response Accuracy",
      value: `${responseAccuracy}`,
      icon: Target,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <card.icon size={13} />
            {card.label}
          </div>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{card.value}</p>
          {card.sub && <p className="mt-0.5 text-xs text-zinc-400">{card.sub}</p>}
        </div>
      ))}
    </div>
  );
}
