export type ActionResult = { ok: true } | { ok: false; error: string };

export type SummaryResult =
  | { ok: true; text: string; source: "groq" | "gemini" | "local" }
  | { ok: false; error: string };
