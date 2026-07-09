"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";

interface ModelPickerProps {
  models: string[];
  model: string;
  onChange: (model: string) => void;
}

export function ModelPicker({ models, model, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (models.length === 0) {
    return <span className="text-sm text-zinc-400">Loading models…</span>;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-black hover:bg-black/[.04] dark:text-zinc-50 dark:hover:bg-white/[.08]"
      >
        {model}
        <ChevronDownIcon className="h-4 w-4 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[220px] overflow-hidden rounded-xl border border-black/[.08] bg-white py-1 shadow-lg dark:border-white/[.145] dark:bg-zinc-900">
          {models.map((m) => (
            <button
              key={m}
              onClick={() => {
                onChange(m);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-black hover:bg-black/[.04] dark:text-zinc-50 dark:hover:bg-white/[.08]"
            >
              {m}
              {m === model && <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
