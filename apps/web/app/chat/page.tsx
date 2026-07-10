"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";
import { ChatView } from "./ChatView";

export default function ChatPage() {
  const router = useRouter();
  // Called once here — `useLoginWithChatGPT` owns its own local state, so a
  // second call in ChatView would be a second, independent copy of that
  // state: calling `logout()` there would clear its own copy but never
  // update this one, and this effect (which decides whether to redirect)
  // would never see it. `user`/`logout` are passed down instead.
  const { status, isAuthenticated, user, logout } = useLoginWithChatGPT();

  useEffect(() => {
    if (status !== "loading" && !isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [status, isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-black dark:text-zinc-400">
        {status === "loading" ? "Checking session…" : "Redirecting to sign in…"}
      </div>
    );
  }

  return <ChatView user={user} logout={logout} />;
}
