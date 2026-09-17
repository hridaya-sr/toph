import { Calendar, ClipboardPen, Percent } from "lucide-react";

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
      label: "Todays Recordings",
      value: todaysRecordings,
      sub: `${todaysRecordings} New`,
      icon: Calendar,
    },
    {
      label: "Active Workers",
      value: activeWorkers,
      icon: ClipboardPen,
    },
    {
      label: "Response Accuracy",
      value: responseAccuracy,
      icon: Percent,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-[14px] border border-[#f2f2f2] bg-white p-5"
        >
          <div className="flex items-center gap-2 text-base text-black">
            <card.icon size={16} />
            {card.label}
          </div>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-5xl font-medium text-black">{card.value}</p>
            {card.sub && <p className="pb-1.5 text-sm text-black">{card.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
