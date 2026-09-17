import Link from "next/link";
import { SignupTabs } from "@/components/auth-forms";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-white font-semibold">
            T
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">Get started with Toph</h1>
        </div>
        <SignupTabs />
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
