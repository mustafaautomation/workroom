import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WorkspaceScreen } from "@/components/workspace/screen";
import { WorkspaceFallback } from "@/components/workspace/fallback";
import { parseView } from "@/lib/routing";

export function generateStaticParams() {
  return [
    { slug: "northline", segments: [] },
    { slug: "northline", segments: ["projects"] },
    { slug: "northline", segments: ["projects", "prj_acme_brand"] },
    { slug: "northline", segments: ["invoices", "inv_acme_identity"] },
    { slug: "fieldnote", segments: [] },
    { slug: "fieldnote", segments: ["projects", "prj_lumen_portal"] },
  ];
}

export default function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; segments?: string[] }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <WorkspacePageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkspacePageContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; segments?: string[] }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const [{ slug, segments }, query] = await Promise.all([params, searchParams]);
  const view = parseView(segments);
  if (!view) notFound();
  return <WorkspaceScreen demo={false} slug={slug} view={view} sessionId={query.session_id} />;
}
