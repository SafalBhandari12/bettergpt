"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";
import type { UseLoginWithChatGPTResult } from "@opencoredev/loginwithchatgpt-react";
import { DeviceCodeNotice } from "@/components/DeviceCodeNotice";

export default function SignInPage() {
  const router = useRouter();
  const [consented, setConsented] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-16 font-sans dark:bg-black">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            &larr; BetterGPT API
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Sign in with ChatGPT
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Get an OpenAI-compatible API key tied to your own ChatGPT plan.
          </p>
        </div>

        <LoginWithChatGPT consent={{ appName: "BetterGPT API" }}>
          {(state) => (
            <SignInFlow
              state={state}
              consented={consented}
              onConsent={() => setConsented(true)}
              onDone={() => router.push("/dashboard")}
            />
          )}
        </LoginWithChatGPT>
      </div>
    </div>
  );
}

function SignInFlow({
  state,
  consented,
  onConsent,
  onDone,
}: {
  state: UseLoginWithChatGPTResult;
  consented: boolean;
  onConsent: () => void;
  onDone: () => void;
}) {
  const { status, login, logout, userCode, verificationUrl, copied, copyCode, reopen, error } =
    state;

  useEffect(() => {
    if (status === "authenticated") onDone();
  }, [status, onDone]);

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-black/[.08] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.145] dark:bg-zinc-950">
        Checking session&hellip;
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <div className="rounded-2xl border border-black/[.08] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.145] dark:bg-zinc-950">
        Signed in. Redirecting&hellip;
      </div>
    );
  }

  if (status === "connecting" || status === "pending") {
    return (
      <div className="space-y-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {status === "connecting" ? "Starting sign-in…" : "Waiting for authorization"}
          </p>
          {userCode && (
            <p className="mt-3 rounded-xl bg-zinc-100 py-4 font-mono text-3xl tracking-[0.3em] text-black dark:bg-zinc-900 dark:text-zinc-50">
              {userCode}
            </p>
          )}
        </div>

        {verificationUrl && (
          <div className="space-y-3 text-center text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              Enter this code at{" "}
              <a
                href={verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline"
              >
                {verificationUrl}
              </a>
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => copyCode()}
                className="rounded-full border border-black/[.08] px-4 py-1.5 text-xs font-medium text-black hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
              >
                {copied ? "Copied" : "Copy code"}
              </button>
              <button
                onClick={() => reopen()}
                className="rounded-full border border-black/[.08] px-4 py-1.5 text-xs font-medium text-black hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
              >
                Reopen verification tab
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-zinc-400">
          Never share this code with anyone else. It authorizes this app only.
        </p>

        <button
          onClick={() => logout()}
          className="w-full text-center text-xs font-medium text-zinc-500 hover:text-black dark:hover:text-zinc-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  // unauthenticated | expired | error
  return (
    <div className="space-y-6">
      <DeviceCodeNotice />

      {(status === "expired" || status === "error" || error) && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {status === "expired"
            ? "Your sign-in code expired. Try again."
            : (error ?? "Something went wrong. Try again.")}
        </p>
      )}

      {!consented ? (
        <div className="rounded-2xl border border-black/[.08] bg-white p-6 text-sm dark:border-white/[.145] dark:bg-zinc-950">
          <p className="text-zinc-600 dark:text-zinc-400">
            Signing in lets BetterGPT API generate a key that can send chat requests on your
            ChatGPT plan until you revoke it. Only continue if you trust this app with that
            access.
          </p>
          <button
            onClick={onConsent}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Continue
          </button>
        </div>
      ) : (
        <button
          onClick={() => login()}
          className="flex h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Sign in with ChatGPT
        </button>
      )}
    </div>
  );
}
