"use client";

import Link from "next/link";
import { useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";

export function HeroCTA() {
  const { isAuthenticated, status } = useLoginWithChatGPT();

  const href = isAuthenticated ? "/chat" : "/sign-in";
  const label =
    status === "loading" ? "Loading…" : isAuthenticated ? "Go to chat" : "Sign in with ChatGPT";

  return (
    <Link
      href={href}
      className="flex h-12 items-center justify-center rounded-full bg-foreground px-7 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
    >
      {label}
    </Link>
  );
}
