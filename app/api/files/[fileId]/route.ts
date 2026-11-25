import { NextResponse } from "next/server";
import { getViewer, loadDatabase } from "@/lib/data";
import { isDemoGuest } from "@/lib/demo-gate";
import { canAccessProject, demoActor } from "@/lib/domain/permissions";
import { readStoredFile } from "@/lib/work/service";

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const viewer = await getViewer();
  const demo = !viewer && (await isDemoGuest());
  if (!viewer && !demo) return new NextResponse("Sign in to download this file.", { status: 401 });
  const db = await loadDatabase(demo);
  const file = db.files.find((item) => item.id === fileId);
  const project = file ? db.projects.find((item) => item.id === file.projectId) : undefined;
  const actor = viewer ?? (demo && file ? demoActor(file.agencyId) : null);
  if (!file || !project || !actor || !canAccessProject(actor, project)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const bytes = await readStoredFile(file);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": file.mime || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.filename.replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
