"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";
import { Dashboard } from "./Dashboard";

export default function DashboardPage() {
  const router = useRouter();
  const { status, isAuthenticated } = useLoginWithChatGPT();

  useEffect(() => {
    if (status !== "loading" && !isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [status, isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-sm text-zinc-500 dark:bg-black dark:text-zinc-400">
        {status === "loading" ? "Checking session…" : "Redirecting to sign in…"}
      </div>
    );
  }

  return <Dashboard />;
}
