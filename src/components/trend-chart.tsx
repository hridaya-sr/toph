"use client";

import { useState } from "react";

export type TrendPoint = { label: string; value: number | null };

type Coord = { x: number; y: number | null; value: number | null; label: string };
type PlottedCoord = { x: number; y: number; value: number | null; label: string };

function isPlotted(c: Coord): c is PlottedCoord {
  return c.y !== null;
}

const WIDTH = 600;
const HEIGHT = 180;
const PAD_LEFT = 34;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

// A minimal single-series line chart — one axis, one hue, no legend (the
// title already names the one series being plotted, per the house style's
// "a single series needs no legend box" rule). Used for the three
// Performance trend cards, each on its own scale rather than sharing an
// axis (hours and percentages aren't comparable on one scale).
export function TrendChart({
  title,
  points,
  color,
  formatValue,
  yMin = 0,
  yMax,
  emptyMessage = "Not enough data in this range.",
}: {
  title: string;
  points: TrendPoint[];
  color: string;
  formatValue: (value: number) => string;
  yMin?: number;
  yMax?: number;
  emptyMessage?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const hasData = values.length > 0;
  const max = yMax ?? (hasData ? Math.max(...values, yMin) : yMin + 1);
  const range = max - yMin || 1;
  const stepX = points.length > 1 ? PLOT_WIDTH / (points.length - 1) : 0;

  const coords: Coord[] = points.map((p, i) => ({
    x: PAD_LEFT + i * stepX,
    y: p.value === null ? null : PAD_TOP + PLOT_HEIGHT - ((p.value - yMin) / range) * PLOT_HEIGHT,
    value: p.value,
    label: p.label,
  }));

  // Break the line at gaps (a week with no logs/shifts is a gap, not a 0).
  const segments: PlottedCoord[][] = [];
  let current: PlottedCoord[] = [];
  for (const c of coords) {
    if (isPlotted(c)) {
      current.push(c);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);

  const plottedCoords = coords.filter(isPlotted);
  const firstPoint = plottedCoords[0] ?? null;
  const lastPoint = plottedCoords[plottedCoords.length - 1] ?? null;
  const delta =
    lastPoint && firstPoint && lastPoint !== firstPoint ? lastPoint.value! - firstPoint.value! : null;

  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;
  const hoveredPlotted = hovered && isPlotted(hovered) ? hovered : null;

  const handleMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = rect.width ? (e.clientX - rect.left) / rect.width : 0;
    const idx = Math.round(fraction * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, idx)));
  };

  return (
    <div className="rounded-[14px] border border-[#f2f2f2] bg-white p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-[#4d4d4d]">{title}</p>
        {delta !== null && (
          <span className={`text-xs font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {delta >= 0 ? "+" : ""}
            {formatValue(delta)} vs range start
          </span>
        )}
      </div>
      <p className="mt-1 text-3xl font-medium text-black">{lastPoint ? formatValue(lastPoint.value!) : "—"}</p>

      {!hasData ? (
        <div className="mt-4 flex h-[140px] items-center justify-center text-xs text-[#b3b3b3]">{emptyMessage}</div>
      ) : (
        <div className="relative mt-3">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }}>
            <line
              x1={PAD_LEFT}
              y1={PAD_TOP + PLOT_HEIGHT}
              x2={WIDTH - PAD_RIGHT}
              y2={PAD_TOP + PLOT_HEIGHT}
              stroke="#e6e6e6"
              strokeWidth={1}
            />
            <line x1={PAD_LEFT} y1={PAD_TOP} x2={WIDTH - PAD_RIGHT} y2={PAD_TOP} stroke="#f2f2f2" strokeWidth={1} />
            <text x={2} y={PAD_TOP + 4} fontSize={9} fill="#b3b3b3">
              {formatValue(max)}
            </text>
            <text x={2} y={PAD_TOP + PLOT_HEIGHT + 4} fontSize={9} fill="#b3b3b3">
              {formatValue(yMin)}
            </text>

            {segments.map((seg, i) => (
              <g key={i}>
                {seg.length > 1 && (
                  <path
                    d={`M ${seg[0].x},${PAD_TOP + PLOT_HEIGHT} L ${seg
                      .map((p) => `${p.x},${p.y}`)
                      .join(" L ")} L ${seg[seg.length - 1].x},${PAD_TOP + PLOT_HEIGHT} Z`}
                    fill={color}
                    opacity={0.1}
                    stroke="none"
                  />
                )}
                <path
                  d={`M ${seg.map((p) => `${p.x},${p.y}`).join(" L ")}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ))}

            {lastPoint && <circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} stroke="white" strokeWidth={2} />}

            {hoveredPlotted && (
              <>
                <line
                  x1={hoveredPlotted.x}
                  y1={PAD_TOP}
                  x2={hoveredPlotted.x}
                  y2={PAD_TOP + PLOT_HEIGHT}
                  stroke="#d4d4d8"
                  strokeWidth={1}
                />
                <circle cx={hoveredPlotted.x} cy={hoveredPlotted.y} r={4} fill={color} stroke="white" strokeWidth={2} />
              </>
            )}

            <rect
              x={PAD_LEFT}
              y={0}
              width={PLOT_WIDTH}
              height={HEIGHT}
              fill="transparent"
              onPointerMove={handleMove}
              onPointerLeave={() => setHoverIndex(null)}
            />
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-[#e6e6e6] bg-white px-2 py-1 text-xs shadow-md"
              style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: 0 }}
            >
              <p className="font-medium text-black">{hovered.value !== null ? formatValue(hovered.value) : "No data"}</p>
              <p className="text-[#808080]">{hovered.label}</p>
            </div>
          )}

          <div className="mt-1.5 flex justify-between text-[10px] text-[#b3b3b3]">
            <span>{points[0]?.label}</span>
            <span>{points[points.length - 1]?.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
