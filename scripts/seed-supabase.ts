import { baseDatabase } from "../lib/domain/seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = "workroom-demo";

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before seeding.");
  process.exit(1);
}

const db = baseDatabase();

async function authAdmin(path: string, init?: RequestInit) {
  const response = await fetch(`${url}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: key!,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path} ${response.status} ${text}`);
  return body;
}

async function rest(table: string, rows: unknown[]) {
  if (rows.length === 0) return;
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key!,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`${table} ${response.status} ${await response.text()}`);
}

const listed = (await authAdmin("admin/users?per_page=200")) as { users: { id: string; email?: string }[] };
const byEmail = new Map(listed.users.map((user) => [user.email?.toLowerCase(), user.id]));
const idMap = new Map<string, string>();

for (const user of db.users) {
  let id = byEmail.get(user.email.toLowerCase());
  if (!id) {
    const created = (await authAdmin("admin/users", {
      method: "POST",
      body: JSON.stringify({ email: user.email, password, email_confirm: true }),
    })) as { id: string };
    id = created.id;
  }
  idMap.set(user.id, id);
}

const mapUser = (id: string | null) => (id ? idMap.get(id) ?? id : null);

await rest(
  "agencies",
  db.agencies.map((agency) => ({
    id: agency.id,
    slug: agency.slug,
    name: agency.name,
    logo_text: agency.logoText,
    logo_url: agency.logoUrl,
    brand_color: agency.brandColor,
    plan: agency.plan,
    plan_status: agency.planStatus,
    trial_ends_at: agency.trialEndsAt,
  })),
);
await rest(
  "clients",
  db.clients.map((client) => ({
    id: client.id,
    agency_id: client.agencyId,
    name: client.name,
    website: client.website,
  })),
);
await rest(
  "profiles",
  db.users.map((user) => ({
    id: mapUser(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
    agency_id: user.agencyId,
    client_id: user.clientId,
    title: user.title,
  })),
);
await rest(
  "projects",
  db.projects.map((project) => ({
    id: project.id,
    agency_id: project.agencyId,
    client_id: project.clientId,
    name: project.name,
    summary: project.summary,
    status: project.status,
    due_date: project.dueDate,
  })),
);
await rest(
  "milestones",
  db.milestones.map((milestone) => ({
    id: milestone.id,
    project_id: milestone.projectId,
    name: milestone.name,
    due_date: milestone.dueDate,
    position: milestone.position,
  })),
);
await rest(
  "tasks",
  db.tasks.map((task) => ({
    id: task.id,
    project_id: task.projectId,
    milestone_id: task.milestoneId,
    title: task.title,
    status: task.status,
    client_visible: task.clientVisible,
    assignee_id: mapUser(task.assigneeId),
  })),
);
await rest(
  "files",
  db.files.map((file) => ({
    id: file.id,
    project_id: file.projectId,
    agency_id: file.agencyId,
    name: file.name,
    filename: file.filename,
    version: file.version,
    bytes: file.bytes,
    mime: file.mime,
    uploaded_by: mapUser(file.uploadedBy),
    uploaded_at: file.uploadedAt,
    storage_path: file.storagePath,
  })),
);
await rest(
  "deliverables",
  db.deliverables.map((item) => ({
    id: item.id,
    project_id: item.projectId,
    agency_id: item.agencyId,
    title: item.title,
    summary: item.summary,
    status: item.status,
    version: item.version,
    file_id: item.fileId,
    updated_at: item.updatedAt,
  })),
);
await rest(
  "comments",
  db.comments.map((comment) => ({
    id: comment.id,
    deliverable_id: comment.deliverableId,
    author_id: mapUser(comment.authorId),
    body: comment.body,
    created_at: comment.createdAt,
  })),
);
await rest(
  "invoices",
  db.invoices.map((invoice) => ({
    id: invoice.id,
    agency_id: invoice.agencyId,
    client_id: invoice.clientId,
    project_id: invoice.projectId,
    number: invoice.number,
    status: invoice.status,
    issued_on: invoice.issuedOn,
    due_date: invoice.dueDate,
    lines: invoice.lines,
  })),
);
await rest(
  "notifications",
  db.notifications.map((item) => ({
    id: item.id,
    user_id: mapUser(item.userId),
    agency_id: item.agencyId,
    title: item.title,
    body: item.body,
    href: item.href,
    read: item.read,
    created_at: item.createdAt,
  })),
);
await rest(
  "emails",
  db.emails.map((email) => ({
    id: email.id,
    agency_id: email.agencyId,
    to_email: email.to,
    subject: email.subject,
    body: email.body,
    created_at: email.createdAt,
  })),
);

console.log(`Seeded ${db.agencies.length} agencies and ${db.users.length} users.`);
