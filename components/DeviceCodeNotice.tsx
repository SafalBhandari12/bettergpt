import Image from "next/image";

const steps = [
  "ChatGPT → Settings",
  "Security and login",
  'Under "Secure sign in with ChatGPT", enable "Device code authorization for Codex"',
];

export function DeviceCodeNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-amber-300/50 bg-amber-50 text-left dark:border-amber-400/20 dark:bg-amber-500/10 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <p
        className={`font-semibold text-amber-900 dark:text-amber-200 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        One-time setup required
      </p>

      <ol
        className={`mt-2 space-y-1 text-amber-900/90 dark:text-amber-100/80 ${
          compact ? "text-xs leading-5" : "text-sm leading-6"
        }`}
      >
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-medium text-amber-700 dark:text-amber-400">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-3 overflow-hidden rounded-xl border border-amber-300/40 dark:border-amber-400/20">
        <Image
          src="/enable-device-code-codex.png"
          alt='ChatGPT Settings → Security and login, showing the "Enable device code authorization for Codex" toggle switched on'
          width={934}
          height={797}
          className="w-full"
          priority
        />
      </div>

      {!compact && (
        <p className="mt-3 rounded-xl bg-amber-100/80 p-3 text-xs leading-5 text-amber-900/90 dark:bg-amber-500/10 dark:text-amber-100/70">
          Device code sign-in is for headless or remote environments where the normal browser
          flow isn&rsquo;t available. Exercise caution enabling it, as device codes can be
          phished. <span className="font-medium">Never share a device code.</span>
        </p>
      )}
    </div>
  );
}
