export interface ChatMessage {
  role: string;
  content: unknown;
}

export interface CoreMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function toCoreMessages(raw: ChatMessage[]): CoreMessage[] {
  return raw.map((m) => {
    if (m.role !== "system" && m.role !== "user" && m.role !== "assistant") {
      throw new Error(`Unsupported role: ${m.role}`);
    }
    if (typeof m.content !== "string") {
      throw new Error("Only string message content is supported");
    }
    return { role: m.role, content: m.content };
  });
}
