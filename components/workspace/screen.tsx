import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getViewer, loadDatabase } from "@/lib/data";
import { brandForeground, formatBytes, formatDate, formatMoney, invoiceAmount, localizeHref, PLAN_LABEL, PLAN_STATUS_LABEL, PROJECT_STATUS_LABEL, simulatedHost, workspaceHref, DELIVERABLE_STATUS_LABEL, INVOICE_STATUS_LABEL } from "@/lib/domain/format";
import { invoiceTotal } from "@/lib/domain/permissions";
import {
  canAccessAgency,
  canAccessProject,
  canEditProject,
  canManageAgency,
  canPayInvoice,
  canReviewDeliverable,
  canSeeOutbox,
  demoActor,
  outstandingCents,
  pendingDeliverables,
  visibleInvoices,
  visiblePeople,
  visibleProjects,
  visibleTasks,
} from "@/lib/domain/permissions";
import { progressCaption, progressFor } from "@/lib/domain/progress";
import type { Actor, Viewer } from "@/lib/domain/types";
import { hasStripe } from "@/lib/mode";
import { confirmStripeReturn } from "@/lib/actions/work";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WorkspaceChrome, type NavItem } from "@/components/workspace/chrome";
import { EmptyState } from "@/components/workspace/fallback";
import { ProjectPanel } from "@/components/workspace/project-panel";
import { BrandForm, CheckoutCard, CreateProjectForm, InviteForm, MarkReadButton, PayButtons } from "@/components/workspace/controls";

export type WorkspaceView =
  | { kind: "dashboard" }
  | { kind: "projects" }
  | { kind: "project"; projectId: string }
  | { kind: "invoices" }
  | { kind: "invoice"; invoiceId: string }
  | { kind: "checkout"; invoiceId: string }
  | { kind: "notifications" }
  | { kind: "outbox" }
  | { kind: "people" }
  | { kind: "settings" };

export async function WorkspaceScreen({
  demo,
  slug,
  view,
  sessionId,
}: {
  demo: boolean;
  slug: string;
  view: WorkspaceView;
  sessionId?: string;
}) {
  await connection();
  if (!demo && view.kind === "invoice" && sessionId) {
    await confirmStripeReturn(view.invoiceId, sessionId);
  }
  const db = await loadDatabase(demo);
  const agency = db.agencies.find((item) => item.slug === slug);
  if (!agency) return <Unavailable />;
  const viewer = demo ? null : await getViewer();
  if (!demo && !viewer) redirect(`/login?next=${workspaceHref(false, slug)}`);
  const actor: Actor = viewer ?? demoActor(agency.id);
  if (!canAccessAgency(actor, agency.id)) return <Unavailable />;

  const href = (path = "") => workspaceHref(demo, slug, path);
  const clientView = actor.role === "client";
  const items: NavItem[] = [
    { href: href(), label: "Overview", icon: "overview", exact: true },
    { href: href("/projects"), label: "Projects", icon: "projects" },
    { href: href("/invoices"), label: "Invoices", icon: "invoices" },
  ];
  if (!clientView) {
    items.push(
      { href: href("/outbox"), label: "Messages", icon: "outbox" },
      { href: href("/people"), label: "People", icon: "people" },
      { href: href("/settings"), label: "Settings", icon: "settings" },
    );
  }

  const notes = (
    viewer
      ? db.notifications.filter((item) => item.userId === viewer.id)
      : db.notifications.filter((item) => item.userId === db.users.find((user) => user.agencyId === agency.id && user.role === "agency_owner")?.id)
  ).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const unread = notes.filter((item) => !item.read).length;
  const projects = visibleProjects(actor, db.projects).filter((project) => project.agencyId === agency.id);
  const clients = db.clients.filter((client) => client.agencyId === agency.id && (actor.role !== "client" || client.id === actor.clientId));

  return (
    <div style={{ ["--brand" as string]: agency.brandColor, ["--brand-foreground" as string]: brandForeground(agency.brandColor) }}>
      <WorkspaceChrome
        agencyName={agency.name}
        logoText={agency.logoText}
        logoUrl={agency.logoUrl}
        host={simulatedHost(slug)}
        items={items}
        unread={unread}
        demo={demo}
        switchHref={demo ? (slug === "northline" ? "/demo?agency=fieldnote" : "/demo") : undefined}
        switchLabel={demo ? (slug === "northline" ? "Preview Fieldnote" : "Preview Northline") : undefined}
        user={viewer ? { name: viewer.name, email: viewer.email, admin: viewer.role === "super_admin" } : null}
      >
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          {agency.planStatus === "canceled" ? (
            <p className="mb-6 rounded-2xl bg-[#f8e4dc] px-4 py-3 text-sm text-[#8a3320]">
              This workspace is canceled. Existing work stays visible. New projects are paused.
            </p>
          ) : null}
          {agency.planStatus === "trialing" && agency.trialEndsAt ? (
            <p className="mb-6 rounded-2xl bg-[#f8efd8] px-4 py-3 text-sm text-[#7a5410]">
              Pro trial ends {formatDate(agency.trialEndsAt)}.
            </p>
          ) : null}
          {view.kind === "dashboard" ? (
            <Dashboard actor={actor} viewer={viewer} projects={projects} db={db} href={href} clients={clients} agencyName={agency.name} />
          ) : null}
          {view.kind === "projects" ? (
            <Projects projects={projects} clients={clients} actor={actor} db={db} href={href} agencyId={agency.id} demo={demo} />
          ) : null}
          {view.kind === "project" ? (
            <ProjectView projectId={view.projectId} actor={actor} db={db} demo={demo} href={href} />
          ) : null}
          {view.kind === "invoices" ? <Invoices actor={actor} db={db} href={href} /> : null}
          {view.kind === "invoice" ? (
            <InvoiceView invoiceId={view.invoiceId} actor={actor} db={db} href={href} demo={demo} />
          ) : null}
          {view.kind === "checkout" ? (
            <CheckoutView invoiceId={view.invoiceId} actor={actor} db={db} demo={demo} />
          ) : null}
          {view.kind === "notifications" ? <Notifications notes={notes} demo={demo} href={href} /> : null}
          {view.kind === "outbox" ? <Outbox actor={actor} agencyId={agency.id} db={db} /> : null}
          {view.kind === "people" ? (
            <People actor={actor} agencyId={agency.id} db={db} clients={clients} demo={demo} />
          ) : null}
          {view.kind === "settings" ? <Settings actor={actor} agency={agency} demo={demo} /> : null}
        </div>
      </WorkspaceChrome>
    </div>
  );
}

function Dashboard({
  actor,
  viewer,
  projects,
  db,
  href,
  clients,
  agencyName,
}: {
  actor: Actor;
  viewer: Viewer | null;
  projects: ReturnType<typeof visibleProjects>;
  db: Awaited<ReturnType<typeof loadDatabase>>;
  href: (path?: string) => string;
  clients: { id: string; name: string }[];
  agencyName: string;
}) {
  const active = projects.filter((project) => project.status === "active");
  const pending = pendingDeliverables(actor, db.deliverables, projects);
  const open = outstandingCents(actor, db.invoices);
  const name = viewer?.name ?? "there";
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
          {viewer ? `Welcome back, ${name}.` : agencyName}
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {agencyName} has {active.length} active {active.length === 1 ? "project" : "projects"}, {pending.length}{" "}
          {pending.length === 1 ? "approval" : "approvals"} waiting, and {formatMoney(open)} outstanding.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Active projects" value={String(active.length)} />
        <Metric label="Pending approvals" value={String(pending.length)} />
        <Metric label="Outstanding" value={formatMoney(open)} />
      </div>
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" body="Open a project when a client engagement starts. It will show up here with progress, files, and invoices." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => {
            const client = clients.find((item) => item.id === project.clientId);
            const tasks = db.tasks.filter((task) => task.projectId === project.id);
            const progress = progressFor(visibleTasks(actor, tasks, [project]), actor);
            return (
              <Link key={project.id} href={href(`/projects/${project.id}`)} className="block">
                <Card className="h-full p-5 transition-colors hover:bg-accent/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{client?.name}</p>
                      <h2 className="mt-1 font-serif text-2xl">{project.name}</h2>
                    </div>
                    <Badge>{PROJECT_STATUS_LABEL[project.status]}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{project.summary}</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{progress}% · Due {formatDate(project.dueDate)}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Unavailable() {
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">That page is not on this workspace.</h1>
      <p className="mt-3 text-muted-foreground">
        It may belong to another studio, or the link is out of date. Workroom does not reveal work you are not on.
      </p>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
    </Card>
  );
}

function Projects({
  projects,
  clients,
  actor,
  db,
  href,
  agencyId,
  demo,
}: {
  projects: ReturnType<typeof visibleProjects>;
  clients: { id: string; name: string }[];
  actor: Actor;
  db: Awaited<ReturnType<typeof loadDatabase>>;
  href: (path?: string) => string;
  agencyId: string;
  demo: boolean;
}) {
  const agency = db.agencies.find((item) => item.id === agencyId);
  const canCreate = agency ? actor.role === "agency_owner" || actor.role === "team_member" || actor.role === "super_admin" : false;
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Projects</h1>
      {canCreate && agency ? <CreateProjectForm agencyId={agency.id} clients={clients} disabled={demo} /> : null}
      {projects.length === 0 ? (
        <EmptyState title="Nothing open" body="When a project is created for a client you can see, it will land here." />
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const client = clients.find((item) => item.id === project.clientId);
            return (
              <Link key={project.id} href={href(`/projects/${project.id}`)} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-4">
                <span>
                  <span className="block font-medium">{project.name}</span>
                  <span className="text-sm text-muted-foreground">{client?.name} · Due {formatDate(project.dueDate)}</span>
                </span>
                <Badge>{PROJECT_STATUS_LABEL[project.status]}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectView({
  projectId,
  actor,
  db,
  demo,
  href,
}: {
  projectId: string;
  actor: Actor;
  db: Awaited<ReturnType<typeof loadDatabase>>;
  demo: boolean;
  href: (path?: string) => string;
}) {
  const project = db.projects.find((item) => item.id === projectId);
  if (!project || !canAccessProject(actor, project)) return <Unavailable />;
  const client = db.clients.find((item) => item.id === project.clientId);
  const milestones = db.milestones.filter((item) => item.projectId === project.id).sort((a, b) => a.position - b.position);
  const tasks = visibleTasks(actor, db.tasks.filter((task) => task.projectId === project.id), [project]);
  const names = new Map(db.users.map((user) => [user.id, user.name]));
  const milestoneName = new Map(milestones.map((item) => [item.id, item.name]));
  return (
    <div className="space-y-6">
      <div>
        <Link href={href("/projects")} className="text-sm text-muted-foreground">
          Projects
        </Link>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{project.name}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{project.summary}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {client?.name} · Due {formatDate(project.dueDate)}
        </p>
      </div>
      <ProjectPanel
        projectId={project.id}
        readOnly={demo}
        canEdit={!demo && canEditProject(actor, project)}
        canReview={!demo && canReviewDeliverable(actor, project)}
        progress={progressFor(tasks, actor)}
        progressLabel={progressCaption(actor)}
        milestones={milestones.map((item) => ({ id: item.id, name: item.name, dueLabel: formatDate(item.dueDate) }))}
        tasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          clientVisible: task.clientVisible,
          assignee: task.assigneeId ? names.get(task.assigneeId) ?? "Unassigned" : "Unassigned",
          milestone: milestoneName.get(task.milestoneId) ?? "Milestone",
        }))}
        files={db.files
          .filter((file) => file.projectId === project.id)
          .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
          .map((file) => ({
            id: file.id,
            name: file.name,
            version: file.version,
            sizeLabel: formatBytes(file.bytes),
            when: formatDate(file.uploadedAt),
            by: names.get(file.uploadedBy) ?? "Studio",
          }))}
        deliverables={db.deliverables
          .filter((item) => item.projectId === project.id)
          .map((item) => ({
            id: item.id,
            title: item.title,
            summary: item.summary,
            status: item.status,
            statusLabel: DELIVERABLE_STATUS_LABEL[item.status],
            version: item.version,
            fileId: item.fileId,
            comments: db.comments
              .filter((comment) => comment.deliverableId === item.id)
              .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
              .map((comment) => ({
                id: comment.id,
                author: names.get(comment.authorId) ?? "Someone",
                body: comment.body,
                when: formatDate(comment.createdAt),
              })),
          }))}
      />
    </div>
  );
}

function Invoices({
  actor,
  db,
  href,
}: {
  actor: Actor;
  db: Awaited<ReturnType<typeof loadDatabase>>;
  href: (path?: string) => string;
}) {
  const invoices = visibleInvoices(actor, db.invoices);
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Invoices</h1>
      {invoices.length === 0 ? (
        <EmptyState title="No invoices" body="When the studio bills this account, the invoice shows up here." />
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Link key={invoice.id} href={href(`/invoices/${invoice.id}`)} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-4">
              <span>
                <span className="block font-medium">{invoice.number}</span>
                <span className="text-sm text-muted-foreground">Due {formatDate(invoice.dueDate)}</span>
              </span>
              <span className="text-right">
                <span className="block font-medium">{invoiceAmount(invoice)}</span>
                <Badge tone={invoice.status === "paid" ? "ok" : invoice.status === "open" ? "wait" : "neutral"}>
                  {INVOICE_STATUS_LABEL[invoice.status]}
                </Badge>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceView({
  invoiceId,
  actor,
  db,
  href,
  demo,
}: {
  invoiceId: string;
  actor: Actor;
  db: Awaited<ReturnType<typeof loadDatabase>>;
  href: (path?: string) => string;
  demo: boolean;
}) {
  const invoice = db.invoices.find((item) => item.id === invoiceId);
  if (!invoice || !visibleInvoices(actor, [invoice]).length) return <Unavailable />;
  const project = db.projects.find((item) => item.id === invoice.projectId);
  const client = db.clients.find((item) => item.id === invoice.clientId);
  const payable = !demo && canPayInvoice(actor, invoice);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={href("/invoices")} className="text-sm text-muted-foreground">
        Invoices
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-5xl">{invoice.number}</h1>
          <p className="mt-2 text-muted-foreground">
            {client?.name} · {project?.name}
          </p>
        </div>
        <Badge tone={invoice.status === "paid" ? "ok" : "wait"}>{INVOICE_STATUS_LABEL[invoice.status]}</Badge>
      </div>
      <Card className="divide-y divide-border">
        {invoice.lines.map((line) => (
          <div key={line.description} className="flex items-center justify-between px-5 py-4 text-sm">
            <span>{line.description}</span>
            <span>{formatMoney(line.amount)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-5 py-4 font-medium">
          <span>Total</span>
          <span>{formatMoney(invoiceTotal(invoice))}</span>
        </div>
      </Card>
      <p className="text-sm text-muted-foreground">
        Issued {formatDate(invoice.issuedOn)} · Due {formatDate(invoice.dueDate)}
      </p>
      {invoice.status === "open" ? (
        <PayButtons
          invoiceId={invoice.id}
          amountLabel={invoiceAmount(invoice)}
          stripe={!demo && hasStripe()}
          disabled={!payable}
          checkoutHref={href(`/invoices/${invoice.id}/checkout`)}
        />
      ) : (
        <p className="text-sm">This invoice is {INVOICE_STATUS_LABEL[invoice.status].toLowerCase()}.</p>
      )}
      {demo ? <p className="text-sm text-muted-foreground">Payments are disabled in the public demo.</p> : null}
    </div>
  );
}

function CheckoutView({
  invoiceId,
  actor,
  db,
  demo,
}: {
  invoiceId: string;
  actor: Actor;
  db: Awaited<ReturnType<typeof loadDatabase>>;
  demo: boolean;
}) {
  const invoice = db.invoices.find((item) => item.id === invoiceId);
  if (!invoice || !visibleInvoices(actor, [invoice]).length) return <Unavailable />;
  if (hasStripe() && !demo) redirect(workspaceHref(false, db.agencies.find((item) => item.id === invoice.agencyId)?.slug ?? "", `/invoices/${invoice.id}`));
  return (
    <CheckoutCard
      invoiceId={invoice.id}
      number={invoice.number}
      amountLabel={invoiceAmount(invoice)}
      paid={invoice.status === "paid"}
      disabled={demo || !canPayInvoice(actor, invoice) || invoice.status !== "open"}
    />
  );
}

function Notifications({
  notes,
  demo,
  href,
}: {
  notes: { id: string; title: string; body: string; href: string; read: boolean; createdAt: string }[];
  demo: boolean;
  href: (path?: string) => string;
}) {
  const unread = notes.filter((item) => !item.read).map((item) => item.id);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl">Notifications</h1>
        <MarkReadButton ids={unread} disabled={demo} />
      </div>
      {notes.length === 0 ? (
        <EmptyState title="You're caught up" body="Approvals, comments, and payments will show up here." />
      ) : (
        <div className="space-y-3">
          {notes.map((item) => (
            <Link key={item.id} href={localizeHref(item.href, href("").startsWith("/demo"))} className="block rounded-2xl border border-border bg-card px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{item.title}</p>
                {item.read ? null : <Badge tone="wait">New</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Outbox({
  actor,
  agencyId,
  db,
}: {
  actor: Actor;
  agencyId: string;
  db: Awaited<ReturnType<typeof loadDatabase>>;
}) {
  if (!canSeeOutbox(actor, agencyId)) return <Unavailable />;
  const emails = db.emails.filter((item) => item.agencyId === agencyId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Messages</h1>
        <p className="mt-2 text-sm text-muted-foreground">Mocked email. Nothing here leaves the workspace unless a provider is configured.</p>
      </div>
      {emails.length === 0 ? (
        <EmptyState title="Outbox is empty" body="Approvals, comments, invites, and payments write a message here." />
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <article key={email.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                To {email.to} · {formatDate(email.createdAt)}
              </p>
              <h2 className="mt-1 font-medium">{email.subject}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{email.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function People({
  actor,
  agencyId,
  db,
  clients,
  demo,
}: {
  actor: Actor;
  agencyId: string;
  db: Awaited<ReturnType<typeof loadDatabase>>;
  clients: { id: string; name: string }[];
  demo: boolean;
}) {
  if (actor.role === "client") return <Unavailable />;
  const people = visiblePeople(actor, db.users, agencyId);
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-4xl">People</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {people.map((person) => (
          <Card key={person.id} className="p-4">
            <p className="font-medium">{person.name}</p>
            <p className="text-sm text-muted-foreground">{person.title}</p>
            <p className="mt-2 text-sm">{person.email}</p>
            <Badge className="mt-3">{person.role.replaceAll("_", " ")}</Badge>
          </Card>
        ))}
      </div>
      {canManageAgency(actor, agencyId) ? (
        <div>
          <h2 className="mb-3 font-serif text-2xl">Invite</h2>
          <InviteForm agencyId={agencyId} clients={clients} disabled={demo} />
        </div>
      ) : null}
    </div>
  );
}

function Settings({
  actor,
  agency,
  demo,
}: {
  actor: Actor;
  agency: { id: string; name: string; brandColor: string; plan: "starter" | "pro"; planStatus: "active" | "trialing" | "canceled"; slug: string };
  demo: boolean;
}) {
  if (!canManageAgency(actor, agency.id) && actor.role !== "team_member") return <Unavailable />;
  const editable = canManageAgency(actor, agency.id) && !demo;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {PLAN_LABEL[agency.plan]} · {PLAN_STATUS_LABEL[agency.planStatus]} · {simulatedHost(agency.slug)}
        </p>
      </div>
      <BrandForm agencyId={agency.id} name={agency.name} color={agency.brandColor} disabled={!editable} />
      {!editable ? <p className="text-sm text-muted-foreground">Only the workspace owner can change the brand.</p> : null}
    </div>
  );
}
