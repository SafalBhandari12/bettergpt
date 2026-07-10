import Link from "next/link";
import { ArrowRightIcon, KeyIcon, ShieldIcon } from "@/components/icons";

export const metadata = {
  title: "How it works — GPTBridge",
};

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <span className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
        Explained simply
      </span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-black sm:text-4xl dark:text-zinc-50">
        How GPTBridge actually works
      </h1>
      <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        No jargon — here&rsquo;s exactly what happens from the moment you sign in to the moment
        you get a reply from a model.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
            The short version
          </h2>
          <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
            You already have a ChatGPT account — Free, Plus, or Pro. That account can talk to
            OpenAI&rsquo;s models. Normally, only the ChatGPT website and app do that talking for
            you. GPTBridge signs in as you (with your permission) and gives you a key that
            lets{" "}
            <span className="font-medium text-black dark:text-zinc-200">any other app</span> talk
            to those same models, using your same account — no separate OpenAI API subscription,
            no extra bill.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Step by step
          </h2>

          <ol className="mt-5 flex flex-col gap-6">
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                1
              </span>
              <div>
                <h3 className="font-semibold text-black dark:text-zinc-50">
                  You sign in with ChatGPT
                </h3>
                <p className="mt-1 leading-7 text-zinc-600 dark:text-zinc-400">
                  We use a &ldquo;device code&rdquo; flow — the same kind of sign-in smart TVs use
                  for streaming apps. You get a short code, enter it on a real OpenAI page in your
                  browser, and approve access. We never see or ask for your ChatGPT password.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                2
              </span>
              <div>
                <h3 className="font-semibold text-black dark:text-zinc-50">
                  We keep a login token for your account, safely
                </h3>
                <p className="mt-1 leading-7 text-zinc-600 dark:text-zinc-400">
                  Once you approve, OpenAI hands back a login token (like a temporary, revocable
                  password) — not your real password. We store it encrypted, and only our server
                  can use it to make requests as you.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                3
              </span>
              <div>
                <h3 className="font-semibold text-black dark:text-zinc-50">
                  We generate your API key
                </h3>
                <p className="mt-1 leading-7 text-zinc-600 dark:text-zinc-400">
                  This is a random string starting with{" "}
                  <code className="rounded bg-black/[.05] px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
                    sk-gptbridge-
                  </code>
                  . It doesn&rsquo;t contain your login token — it&rsquo;s just a lookup code that
                  points back to your account on our server. We show it to you once. After that,
                  we only ever store a one-way hash of it (think: a fingerprint you can&rsquo;t
                  reverse into the original), so even we can&rsquo;t look it back up.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                4
              </span>
              <div>
                <h3 className="font-semibold text-black dark:text-zinc-50">
                  You use the key like any other OpenAI key
                </h3>
                <p className="mt-1 leading-7 text-zinc-600 dark:text-zinc-400">
                  Set it as your <code className="font-mono text-[0.9em]">OPENAI_API_KEY</code>{" "}
                  and point the base URL at ours. Every tool that speaks the standard
                  &ldquo;Chat Completions&rdquo; format — the OpenAI SDK, LangChain, LiteLLM,
                  Cursor, plain curl — just works, unmodified.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                5
              </span>
              <div>
                <h3 className="font-semibold text-black dark:text-zinc-50">
                  What happens on every request
                </h3>
                <p className="mt-1 leading-7 text-zinc-600 dark:text-zinc-400">
                  When a request arrives with your key, we: (1) hash it and look up whose account
                  it belongs to, (2) decrypt that account&rsquo;s stored login token — refreshing
                  it first if it&rsquo;s about to expire, (3) send your message to OpenAI&rsquo;s
                  backend as if it came from the ChatGPT app itself, and (4) translate the reply
                  back into the standard format your tool expects, streaming it back token by
                  token if you asked for streaming.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Common questions
          </h2>
          <div className="mt-5 flex flex-col gap-5">
            <div>
              <h3 className="font-semibold text-black dark:text-zinc-50">Does this cost extra?</h3>
              <p className="mt-1 leading-7 text-zinc-600 dark:text-zinc-400">
                No separate bill from us. Requests count against your existing ChatGPT plan the
                same way using chatgpt.com does.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black dark:text-zinc-50">
                Is this an official OpenAI product?
              </h3>
              <p className="mt-1 leading-7 text-zinc-600 dark:text-zinc-400">
                No. It&rsquo;s an independent project that signs in through the same door the
                official Codex CLI uses. See the{" "}
                <Link href="/security" className="font-medium text-accent underline">
                  security page
                </Link>{" "}
                for what that means in practice.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black dark:text-zinc-50">
                What if I revoke my key?
              </h3>
              <p className="mt-1 leading-7 text-zinc-600 dark:text-zinc-400">
                It stops working immediately — the lookup for its hash simply won&rsquo;t find
                anything anymore. Anything already mid-request finishes; nothing new gets through.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black dark:text-zinc-50">
                Can I have more than one key?
              </h3>
              <p className="mt-1 leading-7 text-zinc-600 dark:text-zinc-400">
                Right now it&rsquo;s one active key per account — creating a new one retires the
                old one immediately, the same way regenerating a password reset link invalidates
                the last one.
              </p>
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-black/[.08] p-6 dark:border-white/[.145]">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <ShieldIcon className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-semibold text-black dark:text-zinc-50">
            Want the honest security details?
          </h3>
          <p className="mt-2 leading-7 text-zinc-600 dark:text-zinc-400">
            We wrote a whole page about what this design does and doesn&rsquo;t protect against,
            including the risks that are inherent to how it works.
          </p>
          <Link
            href="/security"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent"
          >
            Read the security page
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex justify-center">
          <Link
            href="/sign-in"
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <KeyIcon className="h-4 w-4" />
            Get your API key
          </Link>
        </div>
      </div>
    </div>
  );
}
