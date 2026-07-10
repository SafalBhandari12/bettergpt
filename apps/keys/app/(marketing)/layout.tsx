import Link from "next/link";
import { KeyIcon } from "@/components/icons";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-white font-sans dark:bg-black">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-black dark:text-zinc-50"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <KeyIcon className="h-4 w-4" />
          </span>
          BetterGPT API
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/how-it-works"
            className="hidden text-sm text-zinc-600 hover:text-black sm:inline dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            How it works
          </Link>
          <Link
            href="/security"
            className="hidden text-sm text-zinc-600 hover:text-black sm:inline dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Security
          </Link>
          <a
            href="https://github.com/SafalBhandari12/bettergpt/blob/main/apps/keys/README.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm text-zinc-600 hover:text-black sm:inline dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Self-host
          </a>
          <Link
            href="/sign-in"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Get your API key
          </Link>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 py-10 text-center text-sm text-zinc-500 dark:text-zinc-500">
        <div className="flex items-center gap-6">
          <Link href="/how-it-works" className="hover:text-black dark:hover:text-zinc-300">
            How it works
          </Link>
          <Link href="/security" className="hover:text-black dark:hover:text-zinc-300">
            Security
          </Link>
          <a
            href="https://github.com/SafalBhandari12/bettergpt/blob/main/apps/keys/README.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-black dark:hover:text-zinc-300"
          >
            Self-host this
          </a>
        </div>
        <p>
          BetterGPT API connects to your own ChatGPT account. Open source — run your own
          instance instead of trusting this one.
        </p>
      </footer>
    </div>
  );
}
