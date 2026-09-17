"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import { regenerateJoinCode } from "@/app/actions/farm";

export function JoinCodeCard({ joinCode }: { joinCode: string }) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the
      // code is still on screen to copy by hand either way.
    }
  };

  const handleRegenerate = () => {
    if (!window.confirm("Regenerate the invite code? The current code will stop working immediately.")) return;
    startTransition(async () => {
      await regenerateJoinCode();
    });
  };

  return (
    <div className="max-w-xl rounded-[14px] border border-[#f2f2f2] bg-white p-6">
      <p className="text-base text-black">Farm invite code</p>
      <p className="mt-1 text-sm text-[#4d4d4d]">
        Share this with a new hire — they can use it under &ldquo;Join an existing farm&rdquo; at signup to get an
        employee account on this farm.
      </p>
      <div className="mt-4 flex items-center gap-2.5">
        <span className="flex-1 rounded-lg border border-[#e6e6e6] bg-zinc-50 px-4 py-2.5 font-mono text-base tracking-wide text-black">
          {joinCode}
        </span>
        <button
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-2 rounded-full border border-[#e6e6e6] bg-white px-4 py-2.5 text-sm text-[#4d4d4d] hover:bg-zinc-50"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button
        onClick={handleRegenerate}
        disabled={isPending}
        className="mt-4 flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <RefreshCw size={14} />
        {isPending ? "Regenerating…" : "Regenerate code"}
      </button>
    </div>
  );
}
