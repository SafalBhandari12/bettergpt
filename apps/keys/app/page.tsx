import Link from "next/link";
import { ArrowRightIcon, KeyIcon, PlugIcon, ShieldIcon, ZapIcon } from "@/components/icons";
import { CodeWindow } from "@/components/CodeWindow";

const codeSample = `curl https://api.bettergpt.dev/v1/chat/completions \\
  -H "Authorization: Bearer sk-bettergpt-••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.5",
    "messages": [{ "role": "user", "content": "Hello!" }]
  }'`;

const features = [
  {
    icon: PlugIcon,
    title: "Drop-in OpenAI compatible",
    body: "Works anywhere an OPENAI_API_KEY and base URL do — the OpenAI SDK, LangChain, LiteLLM, Cursor, your own curl scripts.",
  },
  {
    icon: ZapIcon,
    title: "Billed to your ChatGPT plan",
    body: "No metered API billing. Requests run against the ChatGPT plan you already pay for — Free, Plus, or Pro.",
  },
  {
    icon: ShieldIcon,
    title: "Tokens encrypted at rest",
    body: "Your ChatGPT credentials are encrypted before storage and never appear in a request you didn't make.",
  },
  {
    icon: KeyIcon,
    title: "One key, full control",
    body: "See when it was created and last used. Regenerate any time — the old key stops working immediately.",
  },
];

const steps = [
  {
    title: "Sign in with ChatGPT",
    body: "Authorize with your existing ChatGPT account — no new password, no credit card.",
  },
  {
    title: "Get your API key",
    body: "We mint a standard sk- key tied to your account. You'll see it exactly once, like any API key should be.",
  },
  {
    title: "Use it anywhere",
    body: "Point any OpenAI-compatible base URL at our gateway and pass your key. That's the whole integration.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white font-sans dark:bg-black">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <KeyIcon className="h-4 w-4" />
          </span>
          BetterGPT API
        </span>
        <nav className="flex items-center gap-6">
          <Link
            href="#how-it-works"
            className="hidden text-sm text-zinc-600 hover:text-black sm:inline dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            How it works
          </Link>
          <Link
            href="/sign-in"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Get your API key
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="bg-grid relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-accent/10 via-transparent to-transparent" />
          <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 py-20 sm:py-28 lg:grid-cols-2">
            <div className="flex flex-col items-start gap-6 text-left">
              <span className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
                Your ChatGPT plan, as an API
              </span>
              <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight text-black sm:text-5xl dark:text-zinc-50">
                Turn your ChatGPT account into an OpenAI-compatible API key.
              </h1>
              <p className="max-w-lg text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                Sign in once, get a standard <code className="rounded bg-black/[.05] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">sk-</code>{" "}
                key, and use it in any OpenAI-compatible tool — no separate API billing, no new
                integration to write.
              </p>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/sign-in"
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                >
                  Get your API key
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link
                  href="#how-it-works"
                  className="flex h-12 items-center justify-center rounded-full border border-black/[.08] px-7 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
                >
                  See how it works
                </Link>
              </div>
            </div>

            <div className="w-full">
              <CodeWindow title="terminal">{codeSample}</CodeWindow>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-black dark:text-zinc-50">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{f.body}</p>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            How it works
          </h2>
          <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="relative rounded-2xl border border-black/[.08] p-6 dark:border-white/[.145]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-black dark:text-zinc-50">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex justify-center">
            <Link
              href="/sign-in"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Get your API key
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-10 text-center text-sm text-zinc-500 dark:text-zinc-500">
        BetterGPT API connects to your own ChatGPT account. Built with Login with ChatGPT.
      </footer>
    </div>
  );
}
