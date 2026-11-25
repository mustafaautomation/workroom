import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WorkspaceScreen } from "@/components/workspace/screen";
import { WorkspaceFallback } from "@/components/workspace/fallback";
import { agencyFromSearch, parseView } from "@/lib/routing";

export const metadata = { title: "Demo" };

export function generateStaticParams() {
  return [
    { segments: [] },
    { segments: ["projects"] },
    { segments: ["projects", "prj_acme_brand"] },
    { segments: ["invoices"] },
    { segments: ["invoices", "inv_acme_identity"] },
  ];
}

export default function DemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<{ agency?: string }>;
}) {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <DemoContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DemoContent({
  params,
  searchParams,
}: {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<{ agency?: string }>;
}) {
  const [{ segments }, query] = await Promise.all([params, searchParams]);
  const view = parseView(segments);
  if (!view) notFound();
  return <WorkspaceScreen demo slug={agencyFromSearch(query.agency)} view={view} />;
}
