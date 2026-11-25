import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/mode";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isLiveSupabase()) return NextResponse.redirect(new URL("/login", url.origin));
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  const profile = await supabase.from("profiles").select("role, agency_id").eq("id", userId).maybeSingle();
  if (profile.error || !profile.data) return NextResponse.redirect(new URL("/login", url.origin));
  if (profile.data.role === "super_admin") return NextResponse.redirect(new URL("/admin", url.origin));
  const agency = await supabase.from("agencies").select("slug").eq("id", profile.data.agency_id).maybeSingle();
  if (!agency.data?.slug) return NextResponse.redirect(new URL("/login", url.origin));
  return NextResponse.redirect(new URL(`/w/${agency.data.slug}`, url.origin));
}
