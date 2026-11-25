import "server-only";

import type {
  Agency,
  ClientOrg,
  Comment,
  Database,
  Deliverable,
  EmailMessage,
  FileAsset,
  Invoice,
  InvoiceLine,
  Milestone,
  Notification,
  Plan,
  PlanStatus,
  Project,
  Task,
  User,
  Viewer,
} from "@/lib/domain/types";
import { toViewer } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

const READY = "The workspace database is not ready. Apply supabase/migrations and run npm run seed.";

function text(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullable(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function flag(row: Row, key: string) {
  return row[key] === true;
}

function lines(value: unknown): InvoiceLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((line) => {
    if (!line || typeof line !== "object") return [];
    const record = line as Row;
    const amount = record.amount;
    return [
      {
        description: typeof record.description === "string" ? record.description : "Line",
        amount: typeof amount === "number" ? amount : 0,
      },
    ];
  });
}

function mapUser(row: Row): User {
  return {
    id: text(row, "id"),
    email: text(row, "email"),
    name: text(row, "name"),
    role: text(row, "role") as User["role"],
    agencyId: nullable(row, "agency_id"),
    clientId: nullable(row, "client_id"),
    title: text(row, "title"),
  };
}

function mapAgency(row: Row): Agency {
  return {
    id: text(row, "id"),
    slug: text(row, "slug"),
    name: text(row, "name"),
    logoText: text(row, "logo_text"),
    logoUrl: nullable(row, "logo_url"),
    brandColor: text(row, "brand_color"),
    plan: text(row, "plan") as Plan,
    planStatus: text(row, "plan_status") as PlanStatus,
    trialEndsAt: nullable(row, "trial_ends_at"),
  };
}

async function rows(query: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(READY);
  return (data ?? []) as Row[];
}

export async function loadLiveViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const profile = await supabase.from("profiles").select("*").eq("id", data.claims.sub).maybeSingle();
  if (profile.error || !profile.data) return null;
  return toViewer(mapUser(profile.data as Row));
}

export async function loadLiveDatabase(): Promise<Database> {
  const supabase = await createClient();
  const [
    users,
    agencies,
    clients,
    projects,
    milestones,
    tasks,
    files,
    deliverables,
    comments,
    invoices,
    notifications,
    emails,
  ] = await Promise.all([
    rows(supabase.from("profiles").select("*")),
    rows(supabase.from("agencies").select("*")),
    rows(supabase.from("clients").select("*")),
    rows(supabase.from("projects").select("*")),
    rows(supabase.from("milestones").select("*")),
    rows(supabase.from("tasks").select("*")),
    rows(supabase.from("files").select("*")),
    rows(supabase.from("deliverables").select("*")),
    rows(supabase.from("comments").select("*")),
    rows(supabase.from("invoices").select("*")),
    rows(supabase.from("notifications").select("*")),
    rows(supabase.from("emails").select("*")),
  ]);

  return {
    users: users.map(mapUser),
    agencies: agencies.map(mapAgency),
    clients: clients.map(
      (row): ClientOrg => ({
        id: text(row, "id"),
        agencyId: text(row, "agency_id"),
        name: text(row, "name"),
        website: text(row, "website"),
      }),
    ),
    projects: projects.map(
      (row): Project => ({
        id: text(row, "id"),
        agencyId: text(row, "agency_id"),
        clientId: text(row, "client_id"),
        name: text(row, "name"),
        summary: text(row, "summary"),
        status: text(row, "status") as Project["status"],
        dueDate: text(row, "due_date").slice(0, 10),
      }),
    ),
    milestones: milestones.map(
      (row): Milestone => ({
        id: text(row, "id"),
        projectId: text(row, "project_id"),
        name: text(row, "name"),
        dueDate: text(row, "due_date").slice(0, 10),
        position: typeof row.position === "number" ? row.position : 0,
      }),
    ),
    tasks: tasks.map(
      (row): Task => ({
        id: text(row, "id"),
        projectId: text(row, "project_id"),
        milestoneId: text(row, "milestone_id"),
        title: text(row, "title"),
        status: text(row, "status") as Task["status"],
        clientVisible: flag(row, "client_visible"),
        assigneeId: nullable(row, "assignee_id"),
      }),
    ),
    files: files.map(
      (row): FileAsset => ({
        id: text(row, "id"),
        projectId: text(row, "project_id"),
        agencyId: text(row, "agency_id"),
        name: text(row, "name"),
        filename: text(row, "filename"),
        version: text(row, "version"),
        bytes: typeof row.bytes === "number" ? row.bytes : 0,
        mime: text(row, "mime"),
        uploadedBy: text(row, "uploaded_by"),
        uploadedAt: text(row, "uploaded_at"),
        storagePath: text(row, "storage_path"),
      }),
    ),
    deliverables: deliverables.map(
      (row): Deliverable => ({
        id: text(row, "id"),
        projectId: text(row, "project_id"),
        agencyId: text(row, "agency_id"),
        title: text(row, "title"),
        summary: text(row, "summary"),
        status: text(row, "status") as Deliverable["status"],
        version: text(row, "version"),
        fileId: nullable(row, "file_id"),
        updatedAt: text(row, "updated_at"),
      }),
    ),
    comments: comments.map(
      (row): Comment => ({
        id: text(row, "id"),
        deliverableId: text(row, "deliverable_id"),
        authorId: text(row, "author_id"),
        body: text(row, "body"),
        createdAt: text(row, "created_at"),
      }),
    ),
    invoices: invoices.map(
      (row): Invoice => ({
        id: text(row, "id"),
        agencyId: text(row, "agency_id"),
        clientId: text(row, "client_id"),
        projectId: text(row, "project_id"),
        number: text(row, "number"),
        status: text(row, "status") as Invoice["status"],
        issuedOn: text(row, "issued_on").slice(0, 10),
        dueDate: text(row, "due_date").slice(0, 10),
        lines: lines(row.lines),
      }),
    ),
    notifications: notifications.map(
      (row): Notification => ({
        id: text(row, "id"),
        userId: text(row, "user_id"),
        agencyId: text(row, "agency_id"),
        title: text(row, "title"),
        body: text(row, "body"),
        href: text(row, "href"),
        read: flag(row, "read"),
        createdAt: text(row, "created_at"),
      }),
    ),
    emails: emails.map(
      (row): EmailMessage => ({
        id: text(row, "id"),
        agencyId: text(row, "agency_id"),
        to: text(row, "to_email"),
        subject: text(row, "subject"),
        body: text(row, "body"),
        createdAt: text(row, "created_at"),
      }),
    ),
  };
}
