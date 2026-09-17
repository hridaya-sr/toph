"use client";

import { Search } from "lucide-react";

export function SearchBar({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex w-full max-w-[370px] items-center gap-2.5 rounded-full border border-[#e6e6e6] bg-white px-4 py-2">
      <Search size={16} className="shrink-0 text-[#cccccc]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent text-sm text-black outline-none placeholder:text-[#cccccc]"
      />
    </div>
  );
}
