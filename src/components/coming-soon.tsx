export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
      <div className="mt-6 flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white">
        <p className="text-sm text-zinc-400">
          Out of scope for this build — the Dashboard, Activity Logs, Map, and Employees pages are the
          real, working core.
        </p>
      </div>
    </div>
  );
}
