"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

interface CodeTab {
  label: string;
  code: string;
}

interface TabbedCodeWindowProps {
  tabs: CodeTab[];
}

export function TabbedCodeWindow({ tabs }: TabbedCodeWindowProps) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(tabs[active].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-zinc-50 shadow-xl shadow-black/5 dark:border-white/10 dark:bg-[#0d0d12]">
      <div className="flex items-center gap-1.5 border-b border-black/10 bg-black/[.02] px-3 py-2 dark:border-white/10 dark:bg-white/[.03]">
        <span className="ml-1 h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <div className="ml-2 flex items-center gap-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                i === active
                  ? "bg-black/[.06] text-black dark:bg-white/[.1] dark:text-zinc-50"
                  : "text-zinc-500 hover:text-black dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-black/[.05] hover:text-black dark:hover:bg-white/[.08] dark:hover:text-zinc-50"
        >
          {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-zinc-700 dark:text-zinc-300">
        <code>{tabs[active].code}</code>
      </pre>
    </div>
  );
}
