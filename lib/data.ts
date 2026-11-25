import "server-only";

import { cache } from "react";
import { applyPatch } from "@/lib/domain/patch";
import { baseDatabase } from "@/lib/domain/seed";
import { toViewer, type Viewer } from "@/lib/domain/types";
import { readSession } from "@/lib/auth/session";
import { readPatch } from "@/lib/mock/cookies";
import { isLiveSupabase } from "@/lib/mode";
import { loadLiveDatabase, loadLiveViewer } from "@/lib/supabase/repository";

export const loadDatabase = cache(async (demo: boolean) => {
  if (demo) return baseDatabase();
  if (!isLiveSupabase()) return applyPatch(baseDatabase(), await readPatch());
  return loadLiveDatabase();
});

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (isLiveSupabase()) return loadLiveViewer();
  const session = await readSession();
  if (!session) return null;
  const db = await loadDatabase(false);
  const user = db.users.find((item) => item.id === session.uid);
  return user ? toViewer(user) : null;
});
