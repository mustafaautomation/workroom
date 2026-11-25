import "server-only";

import { cookies, headers } from "next/headers";

export async function isDemoMutation() {
  const headerStore = await headers();
  if (headerStore.get("x-workroom-demo") === "1") return true;
  const referer = headerStore.get("referer") ?? "";
  let path = "";
  try {
    path = new URL(referer).pathname;
  } catch {
    path = "";
  }
  if (path === "/demo" || path.startsWith("/demo/")) return true;
  const demoCookie = (await cookies()).get("wr_demo");
  if (demoCookie && (path === "" || path.startsWith("/demo"))) return true;
  return false;
}

export async function isDemoGuest() {
  const headerStore = await headers();
  if (headerStore.get("x-workroom-demo") === "1") return true;
  return Boolean((await cookies()).get("wr_demo"));
}
