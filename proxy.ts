import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isLiveSupabase, supabasePublishableKey } from "@/lib/mode";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    const headers = new Headers(request.headers);
    headers.set("x-workroom-demo", "1");
    const response = NextResponse.next({ request: { headers } });
    response.cookies.set("wr_demo", "1", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
    });
    return response;
  }

  let response = NextResponse.next();
  if (request.cookies.get("wr_demo") && !pathname.startsWith("/api")) {
    response.cookies.set("wr_demo", "", { path: "/", maxAge: 0 });
  }

  if (isLiveSupabase()) {
    response = await refreshSupabase(request, response);
  }

  const needsSession = pathname.startsWith("/w/") || pathname === "/admin" || pathname.startsWith("/admin/");
  if (needsSession && !hasSession(request)) {
    const redirect = new NextResponse(null, {
      status: 303,
      headers: { Location: `/login?next=${encodeURIComponent(pathname)}` },
    });
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

function hasSession(request: NextRequest) {
  if (request.cookies.get("wr_session")?.value) return true;
  return request.cookies.getAll().some((cookie) => cookie.name.includes("auth-token"));
}

async function refreshSupabase(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = supabasePublishableKey();
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};
