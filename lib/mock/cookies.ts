import "server-only";

import { deflateSync, inflateSync } from "zlib";
import { cookies } from "next/headers";
import type { Patch } from "@/lib/domain/types";

const CHUNK = 3000;
const LIMIT = 12;

export async function readPatch(): Promise<Patch> {
  const jar = await cookies();
  const parts: string[] = [];
  for (let index = 0; index < LIMIT; index += 1) {
    const value = jar.get(`wr_p${index}`)?.value;
    if (!value) break;
    parts.push(value);
  }
  if (parts.length === 0) return {};
  try {
    const json = inflateSync(Buffer.from(parts.join(""), "base64url")).toString("utf8");
    const parsed = JSON.parse(json) as Patch;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function writePatch(patch: Patch) {
  const jar = await cookies();
  const raw = deflateSync(Buffer.from(JSON.stringify(patch))).toString("base64url");
  const chunks: string[] = [];
  for (let index = 0; index < raw.length; index += CHUNK) {
    chunks.push(raw.slice(index, index + CHUNK));
  }
  if (chunks.length > LIMIT) {
    throw new Error("This browser's demo store is full. Sign out and start a fresh session.");
  }
  chunks.forEach((chunk, index) => {
    jar.set(`wr_p${index}`, chunk, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14,
    });
  });
  for (let index = chunks.length; index < LIMIT; index += 1) {
    if (jar.get(`wr_p${index}`)) jar.delete(`wr_p${index}`);
  }
}

export async function updatePatch(mutate: (patch: Patch) => void) {
  const patch = await readPatch();
  mutate(patch);
  await writePatch(patch);
}
