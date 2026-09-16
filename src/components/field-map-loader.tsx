"use client";

import dynamic from "next/dynamic";

const FieldMap = dynamic(() => import("./field-map").then((m) => m.FieldMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] w-full items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-xs text-zinc-400">
      Loading map…
    </div>
  ),
});

export { FieldMap };
