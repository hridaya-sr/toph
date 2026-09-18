import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-white font-semibold">
            T
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">Sign in to Toph</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your farm&rsquo;s activity log, from voice to record.
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-zinc-500">
          Don&rsquo;t have a farm account?{" "}
          <Link href="/signup" className="font-medium text-zinc-900 underline underline-offset-2">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
