"use client";

import { useActionState, useState } from "react";
import { login, signup, joinFarm } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {state?.errors?.email && (
          <p className="mt-1 text-xs text-red-600">{state.errors.email[0]}</p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {state?.errors?.password && (
          <p className="mt-1 text-xs text-red-600">{state.errors.password[0]}</p>
        )}
      </div>
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="farmName" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Farm name
        </label>
        <input
          id="farmName"
          name="farmName"
          type="text"
          placeholder="Sunrise Orchards"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {state?.errors?.farmName && (
          <p className="mt-1 text-xs text-red-600">{state.errors.farmName[0]}</p>
        )}
      </div>
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {state?.errors?.name && (
          <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>
        )}
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {state?.errors?.email && (
          <p className="mt-1 text-xs text-red-600">{state.errors.email[0]}</p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {state?.errors?.password && (
          <ul className="mt-1 list-inside list-disc text-xs text-red-600">
            {state.errors.password.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}
      </div>
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Creating farm…" : "Create farm & account"}
      </button>
    </form>
  );
}

export function JoinFarmForm() {
  const [state, action, pending] = useActionState(joinFarm, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="joinCode" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Invite code
        </label>
        <input
          id="joinCode"
          name="joinCode"
          type="text"
          placeholder="e.g. UU5RPG7P7S6H"
          autoCapitalize="characters"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase tracking-wide outline-none placeholder:normal-case placeholder:tracking-normal focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {state?.errors?.joinCode && (
          <p className="mt-1 text-xs text-red-600">{state.errors.joinCode[0]}</p>
        )}
      </div>
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {state?.errors?.name && (
          <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>
        )}
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {state?.errors?.email && (
          <p className="mt-1 text-xs text-red-600">{state.errors.email[0]}</p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {state?.errors?.password && (
          <ul className="mt-1 list-inside list-disc text-xs text-red-600">
            {state.errors.password.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}
      </div>
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join farm"}
      </button>
    </form>
  );
}

// Segmented toggle between the two signup paths. "Create a new farm" is the
// existing signup() flow (creates a farm, makes this person its admin) and
// is unchanged; "Join an existing farm" is the new self-serve joinFarm()
// flow, which always creates an employee account on whatever farm the
// invite code resolves to.
export function SignupTabs() {
  const [mode, setMode] = useState<"create" | "join">("create");

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`rounded-md py-2 text-sm font-medium transition-colors ${
            mode === "create" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Create a new farm
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`rounded-md py-2 text-sm font-medium transition-colors ${
            mode === "join" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Join an existing farm
        </button>
      </div>
      <p className="mb-4 text-center text-sm text-zinc-500">
        {mode === "create"
          ? "Creates a new farm and an admin account."
          : "Uses your farm's invite code to join as an employee."}
      </p>
      {mode === "create" ? <SignupForm /> : <JoinFarmForm />}
    </div>
  );
}
