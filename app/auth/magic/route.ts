import { NextResponse } from "next/server";
import { sessionCookie, verifyMagicToken } from "@/lib/auth/session";
import { loadDatabase } from "@/lib/data";
import { isLiveSupabase } from "@/lib/mode";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (isLiveSupabase()) {
    return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }
  const parsed = verifyMagicToken(token);
  if (!parsed) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  const db = await loadDatabase(false);
  const user = db.users.find((item) => item.email.toLowerCase() === parsed.email);
  if (!user) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  const destination = user.role === "super_admin" ? "/admin" : `/w/${db.agencies.find((item) => item.id === user.agencyId)?.slug ?? ""}`;
  const response = new NextResponse(null, { status: 303, headers: { Location: destination } });
  const cookie = sessionCookie(user.id);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  response.cookies.set("wr_demo", "", { path: "/", maxAge: 0 });
  return response;
}
