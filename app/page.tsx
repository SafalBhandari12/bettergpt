import Link from "next/link";
import { HeroCTA } from "./components/HeroCTA";
import { DeviceCodeNotice } from "@/components/DeviceCodeNotice";

const features = [
  {
    title: "No API key, ever",
    body: "Sign in with your own ChatGPT account. Every request runs on your plan and usage limits — you never hand over an OpenAI API key.",
  },
  {
    title: "Non-linear conversations",
    body: "Every reply can branch. Fork a conversation from any message, or select a snippet of text and branch from that exact point.",
  },
  {
    title: "Tokens never leave the server",
    body: "Your browser only ever holds a signed, HttpOnly session cookie. Access and refresh tokens stay inside the backend handler.",
  },
  {
    title: "Streamed, formatted responses",
    body: "Replies stream in token by token and render as proper Markdown — code blocks, tables, and lists included.",
  },
];

const steps = [
  {
    title: "Enable device code sign-in",
    body: "Turn on device code authorization for Codex in your ChatGPT account settings.",
  },
  {
    title: "Sign in with ChatGPT",
    body: "Authorize this app on OpenAI's verification page using a short device code.",
  },
  {
    title: "Chat and branch",
    body: "Pick a model, start chatting, and fork any message into a new branch whenever you want to explore a different direction.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
          BetterGPT
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
            className="text-sm font-medium text-black dark:text-zinc-50"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
          <span className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
            Bring your own ChatGPT plan
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-black sm:text-5xl dark:text-zinc-50">
            Chat with ChatGPT, your way &mdash; branching, not linear.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Sign in with your own ChatGPT account and explore ideas on a canvas. Fork any reply
            into a new branch instead of losing your place in one long thread.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <HeroCTA />
            <Link
              href="#how-it-works"
              className="flex h-12 items-center justify-center rounded-full border border-black/[.08] px-7 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
            >
              See how it works
            </Link>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-6 py-10 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
            >
              <h3 className="text-base font-semibold text-black dark:text-zinc-50">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{f.body}</p>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-5xl scroll-mt-20 px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            How it works
          </h2>
          <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="rounded-2xl border border-black/[.08] p-6 dark:border-white/[.145]"
              >
                <span className="text-sm font-medium text-zinc-400">
                  Step {i + 1}
                </span>
                <h3 className="mt-1 text-base font-semibold text-black dark:text-zinc-50">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-8">
            <DeviceCodeNotice />
          </div>

          <div className="mt-8 flex justify-center">
            <HeroCTA />
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-10 text-center text-sm text-zinc-500 dark:text-zinc-500">
        BetterGPT connects to your own ChatGPT account. Built with Login with ChatGPT.
      </footer>
    </div>
  );
}
