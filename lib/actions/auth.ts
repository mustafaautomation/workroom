"use server";

import { redirect } from "next/navigation";
import { checkDemoPassword } from "@/lib/auth/password";
import { clearSession, setSession, signMagicToken } from "@/lib/auth/session";
import { getViewer, loadDatabase } from "@/lib/data";
import { createId, nowIso } from "@/lib/ids";
import { updatePatch } from "@/lib/mock/cookies";
import { isLiveSupabase } from "@/lib/mode";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/work/result";

export type MagicResult = { ok: true; previewUrl: string | null } | { ok: false; error: string };

function safeNext(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return null;
  if (value.startsWith("/w/") || value === "/admin" || value.startsWith("/admin?")) return value;
  return null;
}

async function destination(next: string | null) {
  const viewer = await getViewer();
  if (!viewer) return null;
  if (viewer.role === "super_admin") return next ?? "/admin";
  const db = await loadDatabase(false);
  const agency = db.agencies.find((item) => item.id === viewer.agencyId);
  if (!agency) return null;
  return next ?? `/w/${agency.slug}`;
}

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  if (!email || !password) return { ok: false, error: "Enter your email and password." };

  if (isLiveSupabase()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: "That email and password don't match." };
    const href = await destination(next);
    if (!href) return { ok: false, error: "Signed in, but this email has no workspace profile." };
    redirect(href);
  }

  const db = await loadDatabase(false);
  const user = db.users.find((item) => item.email.toLowerCase() === email);
  if (!user || !checkDemoPassword(password)) {
    return { ok: false, error: "That email and password don't match." };
  }
  await setSession(user.id);
  const href = await destination(next);
  redirect(href ?? "/login");
}

export async function sendMagicLink(_prev: MagicResult | null, formData: FormData): Promise<MagicResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter the email on your workspace." };
  }
  if (isLiveSupabase()) {
    const supabase = await createClient();
    const origin = await requestOrigin();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return { ok: false, error: "The sign-in link didn't send. Check the auth email settings." };
    return { ok: true, previewUrl: null };
  }
  const db = await loadDatabase(false);
  const user = db.users.find((item) => item.email.toLowerCase() === email);
  if (!user) return { ok: true, previewUrl: null };
  const token = signMagicToken(email);
  const requested = String(formData.get("origin") ?? "");
  const origin = /^https?:\/\//.test(requested) ? requested.replace(/\/$/, "") : await requestOrigin();
  const previewUrl = `${origin}/auth/magic?token=${token}`;
  const agency = db.agencies.find((item) => item.id === user.agencyId);
  try {
    await updatePatch((patch) => {
      patch.emailCreate = [
        ...(patch.emailCreate ?? []),
        {
          id: createId("em"),
          agencyId: agency?.id ?? "ag_northline",
          to: email,
          subject: "Your Workroom sign-in link",
          body: `This demo has no email provider. Open ${previewUrl} to sign in. The link expires in 30 minutes.`,
          createdAt: nowIso(),
        },
      ];
    });
  } catch {
    return { ok: true, previewUrl };
  }
  return { ok: true, previewUrl };
}

export async function signOut() {
  if (isLiveSupabase()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  await clearSession();
  redirect("/");
}
