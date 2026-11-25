import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getViewer, loadDatabase } from "@/lib/data";
import { formatDate, PLAN_LABEL, PLAN_STATUS_LABEL } from "@/lib/domain/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PlanButtons, TenantForm } from "@/components/workspace/controls";
import { WorkspaceFallback } from "@/components/workspace/fallback";

export const metadata = { title: "Platform" };

export default function AdminPage() {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  await connection();
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (viewer.role !== "super_admin") notFound();
  const db = await loadDatabase(false);
  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Platform</p>
          <h1 className="font-serif text-5xl">Workspaces</h1>
        </div>
        <Link href="/" className="text-sm underline">
          Marketing site
        </Link>
      </div>
      <div className="mt-8 space-y-4">
        {db.agencies.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No workspaces yet. Create the first one below.</Card>
        ) : null}
        {db.agencies.map((agency) => {
          const people = db.users.filter((user) => user.agencyId === agency.id).length;
          const projects = db.projects.filter((project) => project.agencyId === agency.id).length;
          return (
            <Card key={agency.id} className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-3xl">{agency.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    /w/{agency.slug} · {projects} projects · {people} people
                  </p>
                </div>
                <Badge tone={agency.planStatus === "canceled" ? "warn" : agency.planStatus === "trialing" ? "wait" : "ok"}>
                  {PLAN_LABEL[agency.plan]} · {PLAN_STATUS_LABEL[agency.planStatus]}
                  {agency.trialEndsAt ? ` · ends ${formatDate(agency.trialEndsAt)}` : ""}
                </Badge>
              </div>
              <PlanButtons agencyId={agency.id} />
              <Link href={`/w/${agency.slug}`} className="inline-block text-sm underline">
                Open workspace
              </Link>
            </Card>
          );
        })}
      </div>
      <h2 className="mb-3 mt-10 font-serif text-3xl">New workspace</h2>
      <TenantForm />
    </main>
  );
}
