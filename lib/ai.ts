import "server-only";

import { localStatusSummary } from "@/lib/domain/summary";
import type { Actor, Deliverable, Invoice, Project, Task } from "@/lib/domain/types";
import type { SummaryResult } from "@/lib/work/result";

function facts(input: {
  project: Project;
  clientName: string;
  tasks: Task[];
  deliverables: Deliverable[];
  invoices: Invoice[];
  actor: Actor;
}) {
  return localStatusSummary(input);
}

async function groq(prompt: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You write calm, specific project status notes. Use only the facts given. Four sentences. No slogans." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  return text || null;
}

async function gemini(prompt: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Write a calm four-sentence project status note from these facts only. No slogans.\n\n${prompt}` }] }],
      }),
    },
  );
  if (!response.ok) return null;
  const json = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text || null;
}

export async function summarize(input: {
  project: Project;
  clientName: string;
  tasks: Task[];
  deliverables: Deliverable[];
  invoices: Invoice[];
  actor: Actor;
}): Promise<SummaryResult> {
  const prompt = facts(input);
  try {
    const fromGroq = await groq(prompt);
    if (fromGroq) return { ok: true, text: fromGroq, source: "groq" };
    const fromGemini = await gemini(prompt);
    if (fromGemini) return { ok: true, text: fromGemini, source: "gemini" };
  } catch (error) {
    console.error(error);
  }
  return { ok: true, text: prompt, source: "local" };
}
