import type {
  Actor,
  Agency,
  Deliverable,
  Invoice,
  Project,
  Task,
  User,
} from "./types";

export const STARTER_ACTIVE_PROJECT_LIMIT = 3;
export const STARTER_TEAM_SEAT_LIMIT = 2;

export function demoActor(agencyId: string): Actor {
  return {
    id: "demo",
    role: "agency_owner",
    agencyId,
    clientId: null,
  };
}

export function canAccessAgency(actor: Actor, agencyId: string): boolean {
  if (actor.role === "super_admin") return true;
  return actor.agencyId === agencyId;
}

export function canAccessProject(
  actor: Actor,
  project: Pick<Project, "agencyId" | "clientId">,
): boolean {
  if (actor.role === "super_admin") return true;
  if (actor.agencyId !== project.agencyId) return false;
  if (actor.role === "client") return actor.clientId === project.clientId;
  return actor.role === "agency_owner" || actor.role === "team_member";
}

export function visibleProjects(actor: Actor, projects: Project[]): Project[] {
  return projects.filter((project) => canAccessProject(actor, project));
}

export function canSeeTask(
  actor: Actor,
  task: Pick<Task, "clientVisible">,
  project: Pick<Project, "agencyId" | "clientId">,
): boolean {
  if (!canAccessProject(actor, project)) return false;
  if (actor.role === "client") return task.clientVisible;
  return true;
}

export function visibleTasks(
  actor: Actor,
  tasks: Task[],
  projects: Project[],
): Task[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  return tasks.filter((task) => {
    const project = byId.get(task.projectId);
    if (!project) return false;
    return canSeeTask(actor, task, project);
  });
}

export function canReviewDeliverable(
  actor: Actor,
  project: Pick<Project, "agencyId" | "clientId">,
): boolean {
  return actor.role === "client" && canAccessProject(actor, project);
}

export function canEditProject(
  actor: Actor,
  project: Pick<Project, "agencyId" | "clientId">,
): boolean {
  if (!canAccessProject(actor, project)) return false;
  return actor.role === "agency_owner" || actor.role === "team_member" || actor.role === "super_admin";
}

export function canComment(
  actor: Actor,
  project: Pick<Project, "agencyId" | "clientId">,
): boolean {
  return canAccessProject(actor, project);
}

export function canManageAgency(actor: Actor, agencyId: string): boolean {
  if (actor.role === "super_admin") return true;
  return actor.role === "agency_owner" && actor.agencyId === agencyId;
}

export function canSeeOutbox(actor: Actor, agencyId: string): boolean {
  if (!canAccessAgency(actor, agencyId)) return false;
  return actor.role !== "client";
}

export function canSeeInvoice(
  actor: Actor,
  invoice: Pick<Invoice, "agencyId" | "clientId">,
): boolean {
  if (actor.role === "super_admin") return true;
  if (actor.agencyId !== invoice.agencyId) return false;
  if (actor.role === "client") return actor.clientId === invoice.clientId;
  return actor.role === "agency_owner" || actor.role === "team_member";
}

export function visibleInvoices(actor: Actor, invoices: Invoice[]): Invoice[] {
  return invoices.filter((invoice) => canSeeInvoice(actor, invoice));
}

export function canPayInvoice(actor: Actor, invoice: Invoice): boolean {
  return (
    invoice.status === "open" &&
    actor.role === "client" &&
    actor.agencyId === invoice.agencyId &&
    actor.clientId === invoice.clientId
  );
}

export function visiblePeople(actor: Actor, users: User[], agencyId: string): User[] {
  const inAgency = users.filter((user) => user.agencyId === agencyId);
  if (actor.role === "super_admin" || actor.role === "agency_owner" || actor.role === "team_member") {
    return inAgency;
  }
  if (actor.role === "client") {
    return inAgency.filter((user) => user.role !== "client" || user.clientId === actor.clientId);
  }
  return [];
}

export function pendingDeliverables(
  actor: Actor,
  deliverables: Deliverable[],
  projects: Project[],
): Deliverable[] {
  const visibleIds = new Set(visibleProjects(actor, projects).map((project) => project.id));
  return deliverables.filter(
    (deliverable) => deliverable.status === "pending" && visibleIds.has(deliverable.projectId),
  );
}

export function outstandingCents(actor: Actor, invoices: Invoice[]): number {
  return visibleInvoices(actor, invoices)
    .filter((invoice) => invoice.status === "open")
    .reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
}

export function invoiceTotal(invoice: Pick<Invoice, "lines">): number {
  return invoice.lines.reduce((sum, line) => sum + line.amount, 0);
}

export function canCreateProject(
  actor: Actor,
  agency: Agency,
  projects: Project[],
): { ok: true } | { ok: false; reason: string } {
  if (!canManageAgency(actor, agency.id) && actor.role !== "team_member") {
    return { ok: false, reason: "Only the studio can open a project." };
  }
  if (actor.role === "team_member" && actor.agencyId !== agency.id) {
    return { ok: false, reason: "Only the studio can open a project." };
  }
  if (actor.role === "client") {
    return { ok: false, reason: "Only the studio can open a project." };
  }
  if (!canAccessAgency(actor, agency.id)) {
    return { ok: false, reason: "This workspace is not on your account." };
  }
  if (agency.planStatus === "canceled") {
    return { ok: false, reason: "This workspace is canceled. Reactivate a plan to open projects." };
  }
  if (agency.plan === "starter") {
    const active = projects.filter(
      (project) => project.agencyId === agency.id && project.status === "active",
    ).length;
    if (active >= STARTER_ACTIVE_PROJECT_LIMIT) {
      return {
        ok: false,
        reason: `Starter includes ${STARTER_ACTIVE_PROJECT_LIMIT} active projects. Upgrade to Pro to open another.`,
      };
    }
  }
  return { ok: true };
}

export function canInviteTeam(actor: Actor, agency: Agency, users: User[]): { ok: true } | { ok: false; reason: string } {
  if (!canManageAgency(actor, agency.id)) {
    return { ok: false, reason: "Only the workspace owner can invite people." };
  }
  if (agency.planStatus === "canceled") {
    return { ok: false, reason: "This workspace is canceled." };
  }
  if (agency.plan === "starter") {
    const seats = users.filter(
      (user) =>
        user.agencyId === agency.id &&
        (user.role === "agency_owner" || user.role === "team_member"),
    ).length;
    if (seats >= STARTER_TEAM_SEAT_LIMIT) {
      return {
        ok: false,
        reason: `Starter includes ${STARTER_TEAM_SEAT_LIMIT} team seats. Upgrade to Pro to invite someone else.`,
      };
    }
  }
  return { ok: true };
}
