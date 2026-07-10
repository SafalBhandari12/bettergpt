interface CodeWindowProps {
  title: string;
  children: string;
}

export function CodeWindow({ title, children }: CodeWindowProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-[#0d0d12] shadow-xl shadow-black/5 dark:border-white/10">
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[.03] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 font-mono text-xs text-zinc-500">{title}</span>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-zinc-300">
        <code>{children}</code>
      </pre>
    </div>
  );
}
