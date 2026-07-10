import Link from "next/link";
import { ShieldIcon } from "@/components/icons";

export const metadata = {
  title: "Security — GPTBridge",
};

function Callout({
  tone,
  title,
  children,
}: {
  tone: "amber" | "zinc";
  title: string;
  children: React.ReactNode;
}) {
  const toneClasses =
    tone === "amber"
      ? "border-amber-300/50 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/10"
      : "border-black/[.08] bg-zinc-50 dark:border-white/[.145] dark:bg-zinc-900";
  const titleClasses =
    tone === "amber"
      ? "text-amber-900 dark:text-amber-200"
      : "text-black dark:text-zinc-50";
  const bodyClasses =
    tone === "amber"
      ? "text-amber-900/90 dark:text-amber-100/80"
      : "text-zinc-600 dark:text-zinc-400";

  return (
    <div className={`rounded-2xl border p-5 ${toneClasses}`}>
      <p className={`text-sm font-semibold ${titleClasses}`}>{title}</p>
      <div className={`mt-2 text-sm leading-6 ${bodyClasses}`}>{children}</div>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <span className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
        Read this before you sign in
      </span>
      <h1 className="mt-4 flex items-center gap-3 text-3xl font-semibold tracking-tight text-black sm:text-4xl dark:text-zinc-50">
        <ShieldIcon className="h-8 w-8 text-accent" />
        Security &amp; risk
      </h1>
      <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        We&rsquo;d rather you know exactly what you&rsquo;re trusting us with than find out the
        hard way. Nothing here is buried in fine print.
      </p>

      <div className="mt-10 flex flex-col gap-6">
        <Callout tone="amber" title="This is not an official OpenAI product">
          <p>
            GPTBridge signs in using the same OAuth flow OpenAI&rsquo;s own Codex CLI uses,
            then talks to the ChatGPT-backed model API on your behalf. That path is meant for
            OpenAI&rsquo;s official client, not third-party proxies like this one. It could stop
            working if OpenAI changes how that works, and using automated or third-party access to
            your account is a gray area under most ChatGPT terms of service — in the worst case,
            unusual usage patterns could get an account flagged or limited by OpenAI. That risk is
            inherent to how this works, not something we can engineer away.
          </p>
        </Callout>

        <div>
          <h2 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
            What we store, and how
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            <li>
              <span className="font-medium text-black dark:text-zinc-200">
                Your ChatGPT login token
              </span>{" "}
              (access + refresh token) is encrypted at rest with AES-256-GCM before it ever
              touches our database. &ldquo;Encrypted at rest&rdquo; protects against someone
              stealing a database backup or disk snapshot — it does{" "}
              <span className="font-medium">not</span> mean we can&rsquo;t use it: our server
              holds the decryption key too, because it needs to decrypt your token to make
              requests on your behalf. That&rsquo;s the entire point of the product, so it&rsquo;s
              worth being explicit about the trust you&rsquo;re placing in us.
            </li>
            <li>
              <span className="font-medium text-black dark:text-zinc-200">Your API key</span> is
              never stored in a form we can read back. We store a SHA-256 hash of it — the same
              approach used for passwords. We show you the real key exactly once, when you create
              or regenerate it.
            </li>
            <li>
              <span className="font-medium text-black dark:text-zinc-200">
                Your chat messages
              </span>{" "}
              pass through our server in memory to be forwarded and streamed back — we don&rsquo;t
              write message content to any database or log. There is currently no analytics or
              logging pipeline that persists what you send or receive.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Your API key is a password
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Anyone who has it can send requests as you, against your ChatGPT plan, until you
            revoke it. Treat it exactly like you&rsquo;d treat a database password or an SSH key:
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            <li>Never commit it to a public (or private) git repository.</li>
            <li>Don&rsquo;t paste it into client-side/browser code — anyone viewing the page can read it.</li>
            <li>Regenerate it immediately if you suspect it leaked. The old one stops working the instant you do.</li>
            <li>Never share a ChatGPT device code with anyone — that&rsquo;s a separate, one-time secret that authorizes a sign-in.</li>
          </ul>
        </div>

        <Callout tone="zinc" title="Revoking is immediate and one-way">
          Regenerating or revoking your key deletes its hash from our database. The lookup a
          request needs to succeed simply no longer exists — there&rsquo;s no grace period, no
          cache to wait out.
        </Callout>

        <div>
          <h2 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Current limitations, plainly stated
          </h2>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            <li>
              There&rsquo;s no additional rate limiting on top of whatever limits your own ChatGPT
              plan already has — a leaked key can be used as fast as your plan allows.
            </li>
            <li>
              There&rsquo;s one active key per account today, not scoped/revocable sub-keys per
              project or environment.
            </li>
            <li>
              This project depends on an unofficial integration path (see above) — availability
              isn&rsquo;t guaranteed the way a paid, official API is.
            </li>
          </ul>
        </div>

        <p className="text-sm leading-6 text-zinc-500">
          If any of this changes how comfortable you are proceeding, that&rsquo;s a completely
          reasonable reaction — this trade-off (convenience and no extra billing, in exchange for
          the above) is the whole shape of the product, not a bug to be fixed later.
        </p>

        <Callout tone="zinc" title="Don't want to trust our hosted instance?">
          <p>
            The whole thing — this app, the backend, the Worker code that decrypts your tokens —
            is open source. Self-hosting means your tokens and key only ever touch infrastructure
            you control.{" "}
            <a
              href="https://github.com/SafalBhandari12/bettergpt/blob/main/apps/keys/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline"
            >
              Self-hosting instructions
            </a>
            .
          </p>
        </Callout>

        <div className="flex justify-center">
          <Link
            href="/how-it-works"
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-black/[.08] px-7 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Back to how it works
          </Link>
        </div>
      </div>
    </div>
  );
}
