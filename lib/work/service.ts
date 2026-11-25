import "server-only";

import { readFile } from "fs/promises";
import path from "path";
import type { Agency, Database, FileAsset, Patch, User } from "@/lib/domain/types";
import {
  canComment,
  canCreateProject,
  canEditProject,
  canInviteTeam,
  canManageAgency,
  canPayInvoice,
  canReviewDeliverable,
} from "@/lib/domain/permissions";
import { getViewer, loadDatabase } from "@/lib/data";
import { isDemoMutation } from "@/lib/demo-gate";
import { createId, nowIso } from "@/lib/ids";
import { getBlob, putBlob } from "@/lib/mock/blobs";
import { updatePatch } from "@/lib/mock/cookies";
import { hasStripe, isLiveSupabase } from "@/lib/mode";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/work/result";

const READ_ONLY = "This demo is read-only.";
const SIGN_IN = "Sign in to continue.";
const HIDDEN = "That isn't available on your account.";

function notify(
  patch: Patch,
  users: User[],
  agency: Agency,
  title: string,
  body: string,
  href: string,
  createdAt: string,
) {
  patch.notificationCreate = patch.notificationCreate ?? [];
  patch.emailCreate = patch.emailCreate ?? [];
  for (const user of users) {
    patch.notificationCreate.push({
      id: createId("ntf"),
      userId: user.id,
      agencyId: agency.id,
      title,
      body: body.slice(0, 500),
      href,
      read: false,
      createdAt,
    });
    patch.emailCreate.push({
      id: createId("em"),
      agencyId: agency.id,
      to: user.email,
      subject: title,
      body: `${body}\n\nOpen Workroom: ${href}`,
      createdAt,
    });
  }
}

function staffOf(db: Database, agencyId: string) {
  return db.users.filter(
    (user) => user.agencyId === agencyId && (user.role === "agency_owner" || user.role === "team_member"),
  );
}

function clientsOf(db: Database, clientId: string) {
  return db.users.filter((user) => user.clientId === clientId && user.role === "client");
}

async function liveRpc(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (!error) return { ok: true };
  console.error(error.message);
  if (error.message.includes("comment_required")) {
    return { ok: false, error: "Tell the studio what should change." };
  }
  if (error.message.includes("starter_limit")) {
    return { ok: false, error: "Starter includes 3 active projects. Upgrade to Pro to open another." };
  }
  if (error.message.includes("seat_limit")) {
    return { ok: false, error: "Starter includes 2 team seats. Upgrade to Pro to invite someone else." };
  }
  if (error.message.includes("canceled")) {
    return { ok: false, error: "This workspace is canceled." };
  }
  if (error.message.includes("not_found")) return { ok: false, error: HIDDEN };
  return { ok: false, error: "That change didn't save. Try again in a moment." };
}

async function guard() {
  if (await isDemoMutation()) return { ok: false as const, error: READ_ONLY };
  const viewer = await getViewer();
  if (!viewer) return { ok: false as const, error: SIGN_IN };
  return { ok: true as const, viewer };
}

export async function decideDeliverable(
  id: string,
  decision: "approved" | "changes_requested",
  comment: string,
): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  if (decision !== "approved" && decision !== "changes_requested") {
    return { ok: false, error: "Choose approve or request changes." };
  }
  const trimmed = comment.trim().slice(0, 2000);
  if (decision === "changes_requested" && trimmed.length < 2) {
    return { ok: false, error: "Tell the studio what should change." };
  }
  if (isLiveSupabase()) {
    return liveRpc("decide_deliverable", { p_id: id, p_decision: decision, p_comment: trimmed });
  }
  const db = await loadDatabase(false);
  const deliverable = db.deliverables.find((item) => item.id === id);
  const project = deliverable ? db.projects.find((item) => item.id === deliverable.projectId) : undefined;
  const agency = project ? db.agencies.find((item) => item.id === project.agencyId) : undefined;
  if (!deliverable || !project || !agency || !canReviewDeliverable(access.viewer, project)) {
    return { ok: false, error: HIDDEN };
  }
  if (deliverable.status === decision && trimmed.length === 0) return { ok: true };
  const createdAt = nowIso();
  try {
    await updatePatch((patch) => {
      patch.deliverableStatus = { ...patch.deliverableStatus, [id]: decision };
      if (trimmed) {
        patch.commentCreate = [
          ...(patch.commentCreate ?? []),
          { id: createId("cmt"), deliverableId: id, authorId: access.viewer.id, body: trimmed, createdAt },
        ];
      }
      const title = decision === "approved" ? `${deliverable.title} approved` : `Changes requested on ${deliverable.title}`;
      const body = trimmed || `${access.viewer.name} approved ${deliverable.title}.`;
      notify(patch, staffOf(db, agency.id), agency, title, body, `/w/${agency.slug}/projects/${project.id}`, createdAt);
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save that change." };
  }
  return { ok: true };
}

export async function addComment(deliverableId: string, body: string): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  const trimmed = body.trim().slice(0, 2000);
  if (trimmed.length < 2) return { ok: false, error: "Write a comment before sending." };
  if (isLiveSupabase()) return liveRpc("add_comment", { p_deliverable_id: deliverableId, p_body: trimmed });
  const db = await loadDatabase(false);
  const deliverable = db.deliverables.find((item) => item.id === deliverableId);
  const project = deliverable ? db.projects.find((item) => item.id === deliverable.projectId) : undefined;
  const agency = project ? db.agencies.find((item) => item.id === project.agencyId) : undefined;
  if (!deliverable || !project || !agency || !canComment(access.viewer, project)) return { ok: false, error: HIDDEN };
  const createdAt = nowIso();
  const recipients =
    access.viewer.role === "client" ? staffOf(db, agency.id) : clientsOf(db, project.clientId);
  try {
    await updatePatch((patch) => {
      patch.commentCreate = [
        ...(patch.commentCreate ?? []),
        { id: createId("cmt"), deliverableId, authorId: access.viewer.id, body: trimmed, createdAt },
      ];
      notify(
        patch,
        recipients,
        agency,
        `${access.viewer.name} commented on ${deliverable.title}`,
        trimmed,
        `/w/${agency.slug}/projects/${project.id}`,
        createdAt,
      );
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save that comment." };
  }
  return { ok: true };
}

export async function resubmitDeliverable(id: string, version: string): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  const label = version.trim().slice(0, 20);
  if (label.length < 2) return { ok: false, error: "Add a version label, such as v3." };
  if (isLiveSupabase()) return liveRpc("resubmit_deliverable", { p_id: id, p_version: label });
  const db = await loadDatabase(false);
  const deliverable = db.deliverables.find((item) => item.id === id);
  const project = deliverable ? db.projects.find((item) => item.id === deliverable.projectId) : undefined;
  const agency = project ? db.agencies.find((item) => item.id === project.agencyId) : undefined;
  if (!deliverable || !project || !agency || !canEditProject(access.viewer, project)) {
    return { ok: false, error: HIDDEN };
  }
  const createdAt = nowIso();
  try {
    await updatePatch((patch) => {
      patch.deliverableStatus = { ...patch.deliverableStatus, [id]: "pending" };
      patch.deliverableVersion = { ...patch.deliverableVersion, [id]: label };
      notify(
        patch,
        clientsOf(db, project.clientId),
        agency,
        `${deliverable.title} is ready for another look`,
        `${access.viewer.name} sent ${label}.`,
        `/w/${agency.slug}/projects/${project.id}`,
        createdAt,
      );
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not send that version." };
  }
  return { ok: true };
}

export async function moveTask(taskId: string, status: string): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  if (!["backlog", "in_progress", "review", "done"].includes(status)) {
    return { ok: false, error: "That status isn't on the board." };
  }
  if (isLiveSupabase()) return liveRpc("set_task_status", { p_task_id: taskId, p_status: status });
  const db = await loadDatabase(false);
  const task = db.tasks.find((item) => item.id === taskId);
  const project = task ? db.projects.find((item) => item.id === task.projectId) : undefined;
  if (!task || !project || !canEditProject(access.viewer, project)) return { ok: false, error: HIDDEN };
  try {
    await updatePatch((patch) => {
      patch.taskStatus = { ...patch.taskStatus, [taskId]: status as typeof task.status };
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not move that task." };
  }
  return { ok: true };
}

export async function payInvoice(invoiceId: string): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  if (hasStripe()) return { ok: false, error: "Pay this invoice through Stripe Checkout." };
  const db = await loadDatabase(false);
  const invoice = db.invoices.find((item) => item.id === invoiceId);
  if (!invoice || !canPayInvoice(access.viewer, invoice)) return { ok: false, error: HIDDEN };
  return markInvoicePaid(invoiceId);
}

export async function markInvoicePaid(invoiceId: string): Promise<ActionResult> {
  if (isLiveSupabase()) {
    const admin = createServiceClient();
    if (!admin) return { ok: false, error: "Add SUPABASE_SECRET_KEY to record payments." };
    const { error } = await admin.from("invoices").update({ status: "paid" }).eq("id", invoiceId).eq("status", "open");
    if (error) return { ok: false, error: "The payment was received but the invoice did not update." };
    return { ok: true };
  }
  const db = await loadDatabase(false);
  const invoice = db.invoices.find((item) => item.id === invoiceId);
  const agency = invoice ? db.agencies.find((item) => item.id === invoice.agencyId) : undefined;
  const project = invoice ? db.projects.find((item) => item.id === invoice.projectId) : undefined;
  if (!invoice || !agency || !project) return { ok: false, error: HIDDEN };
  if (invoice.status === "paid") return { ok: true };
  const createdAt = nowIso();
  const viewer = await getViewer();
  try {
    await updatePatch((patch) => {
      patch.invoiceStatus = { ...patch.invoiceStatus, [invoiceId]: "paid" };
      notify(
        patch,
        [...staffOf(db, agency.id), ...clientsOf(db, invoice.clientId)].filter((user) => user.id !== viewer?.id),
        agency,
        `Invoice ${invoice.number} paid`,
        `${viewer?.name ?? "A client"} paid invoice ${invoice.number}.`,
        `/w/${agency.slug}/invoices/${invoice.id}`,
        createdAt,
      );
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not record that payment." };
  }
  return { ok: true };
}

export async function uploadProjectFile(input: {
  projectId: string;
  name: string;
  version: string;
  filename: string;
  mime: string;
  bytes: Uint8Array;
}): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  const name = input.name.trim().slice(0, 80);
  const version = input.version.trim().slice(0, 20);
  if (name.length < 2 || version.length < 2) return { ok: false, error: "Name the file and give it a version label." };
  if (input.bytes.byteLength === 0) return { ok: false, error: "Choose a file to upload." };
  if (input.bytes.byteLength > 5 * 1024 * 1024) return { ok: false, error: "Files need to be 5 MB or smaller." };
  const db = await loadDatabase(false);
  const project = db.projects.find((item) => item.id === input.projectId);
  if (!project || !canEditProject(access.viewer, project)) return { ok: false, error: HIDDEN };
  const id = createId("file");
  const filename = path.basename(input.filename || "upload.txt").slice(0, 120);
  if (isLiveSupabase()) {
    const supabase = await createClient();
    const storagePath = `${project.agencyId}/${project.id}/${id}/${filename}`;
    const upload = await supabase.storage.from("project-files").upload(storagePath, input.bytes, {
      contentType: input.mime || "application/octet-stream",
      upsert: false,
    });
    if (upload.error) return { ok: false, error: "The file did not upload." };
    return liveRpc("register_file", {
      p_id: id,
      p_project_id: project.id,
      p_name: name,
      p_filename: filename,
      p_version: version,
      p_bytes: input.bytes.byteLength,
      p_mime: input.mime || "application/octet-stream",
      p_storage_path: `sb:${storagePath}`,
    });
  }
  putBlob(id, input.bytes);
  const createdAt = nowIso();
  try {
    await updatePatch((patch) => {
      patch.fileCreate = [
        ...(patch.fileCreate ?? []),
        {
          id,
          projectId: project.id,
          agencyId: project.agencyId,
          name,
          filename,
          version,
          bytes: input.bytes.byteLength,
          mime: input.mime || "application/octet-stream",
          uploadedBy: access.viewer.id,
          uploadedAt: createdAt,
          storagePath: `mem:${id}`,
        },
      ];
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not store that file." };
  }
  return { ok: true };
}

export async function readStoredFile(file: FileAsset): Promise<Uint8Array> {
  if (file.storagePath.startsWith("seed:")) {
    const name = path.basename(file.storagePath.slice(5));
    const full = path.join(process.cwd(), "seed-files", name);
    return new Uint8Array(await readFile(full));
  }
  if (file.storagePath.startsWith("mem:")) {
    const bytes = getBlob(file.storagePath.slice(4));
    if (bytes) return bytes;
    return new TextEncoder().encode(
      `${file.name} ${file.version}\nThis upload lived in the server process and is no longer available. Upload it again.`,
    );
  }
  if (file.storagePath.startsWith("sb:") && isLiveSupabase()) {
    const supabase = await createClient();
    const downloaded = await supabase.storage.from("project-files").download(file.storagePath.slice(3));
    if (downloaded.error || !downloaded.data) throw new Error("missing");
    return new Uint8Array(await downloaded.data.arrayBuffer());
  }
  throw new Error("missing");
}

export async function createProject(input: {
  agencyId: string;
  clientId: string;
  name: string;
  summary: string;
  dueDate: string;
}): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  const name = input.name.trim().slice(0, 80);
  const summary = input.summary.trim().slice(0, 400);
  if (name.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    return { ok: false, error: "Add a project name and a due date." };
  }
  const db = await loadDatabase(false);
  const agency = db.agencies.find((item) => item.id === input.agencyId);
  const client = db.clients.find((item) => item.id === input.clientId && item.agencyId === input.agencyId);
  if (!agency || !client) return { ok: false, error: HIDDEN };
  const allowed = canCreateProject(access.viewer, agency, db.projects);
  if (!allowed.ok) return { ok: false, error: allowed.reason };
  if (isLiveSupabase()) {
    return liveRpc("create_project", {
      p_client_id: client.id,
      p_name: name,
      p_summary: summary,
      p_due_date: input.dueDate,
    });
  }
  const projectId = createId("prj");
  const milestoneId = createId("ms");
  try {
    await updatePatch((patch) => {
      patch.projectCreate = [
        ...(patch.projectCreate ?? []),
        {
          id: projectId,
          agencyId: agency.id,
          clientId: client.id,
          name,
          summary: summary || "New engagement.",
          status: "active",
          dueDate: input.dueDate,
        },
      ];
      patch.milestoneCreate = [
        ...(patch.milestoneCreate ?? []),
        { id: milestoneId, projectId, name: "Kickoff", dueDate: input.dueDate, position: 1 },
      ];
      patch.taskCreate = [
        ...(patch.taskCreate ?? []),
        {
          id: createId("t"),
          projectId,
          milestoneId,
          title: "Kickoff notes",
          status: "backlog",
          clientVisible: true,
          assigneeId: access.viewer.id,
        },
      ];
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not open that project." };
  }
  return { ok: true };
}

export async function updateBrand(input: {
  agencyId: string;
  name: string;
  brandColor: string;
  logoDataUrl: string | null;
}): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  if (!canManageAgency(access.viewer, input.agencyId)) return { ok: false, error: HIDDEN };
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2 || !/^#[0-9a-fA-F]{6}$/.test(input.brandColor)) {
    return { ok: false, error: "Use a workspace name and a 6-digit color." };
  }
  const logoText = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  if (isLiveSupabase()) {
    return liveRpc("update_brand", {
      p_agency_id: input.agencyId,
      p_name: name,
      p_brand_color: input.brandColor,
      p_logo_text: logoText || "WR",
      p_logo_url: input.logoDataUrl,
    });
  }
  try {
    await updatePatch((patch) => {
      patch.agencyUpdate = {
        ...patch.agencyUpdate,
        [input.agencyId]: {
          ...patch.agencyUpdate?.[input.agencyId],
          name,
          brandColor: input.brandColor,
          logoText: logoText || "WR",
          logoUrl: input.logoDataUrl,
        },
      };
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the brand." };
  }
  return { ok: true };
}

export async function markNotificationsRead(ids: string[]): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  if (isLiveSupabase()) return liveRpc("mark_notifications_read", { p_ids: ids });
  const db = await loadDatabase(false);
  const own = ids.filter((id) => db.notifications.some((item) => item.id === id && item.userId === access.viewer.id));
  try {
    await updatePatch((patch) => {
      patch.notificationRead = Array.from(new Set([...(patch.notificationRead ?? []), ...own]));
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update notifications." };
  }
  return { ok: true };
}

export async function setAgencyPlan(input: {
  agencyId: string;
  plan: "starter" | "pro";
  planStatus: "active" | "trialing" | "canceled";
  trialEndsAt: string | null;
}): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  if (access.viewer.role !== "super_admin") return { ok: false, error: HIDDEN };
  if (isLiveSupabase()) {
    return liveRpc("set_agency_plan", {
      p_agency_id: input.agencyId,
      p_plan: input.plan,
      p_plan_status: input.planStatus,
      p_trial_ends_at: input.trialEndsAt,
    });
  }
  try {
    await updatePatch((patch) => {
      patch.agencyUpdate = {
        ...patch.agencyUpdate,
        [input.agencyId]: {
          ...patch.agencyUpdate?.[input.agencyId],
          plan: input.plan,
          planStatus: input.planStatus,
          trialEndsAt: input.trialEndsAt,
        },
      };
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update the plan." };
  }
  return { ok: true };
}

export async function invitePerson(input: {
  agencyId: string;
  name: string;
  email: string;
  role: "team_member" | "client";
  title: string;
  clientId: string | null;
  newClientName: string;
}): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  const db = await loadDatabase(false);
  const agency = db.agencies.find((item) => item.id === input.agencyId);
  if (!agency || !canManageAgency(access.viewer, agency.id)) return { ok: false, error: HIDDEN };
  const name = input.name.trim().slice(0, 80);
  const email = input.email.trim().toLowerCase();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Add a name and a real email." };
  }
  if (db.users.some((user) => user.email.toLowerCase() === email)) {
    return { ok: false, error: "That email is already on Workroom." };
  }
  if (input.role === "team_member") {
    const seats = canInviteTeam(access.viewer, agency, db.users);
    if (!seats.ok) return { ok: false, error: seats.reason };
  }
  let clientId = input.clientId;
  let newClient: { id: string; name: string } | null = null;
  if (input.role === "client") {
    if (clientId && !db.clients.some((client) => client.id === clientId && client.agencyId === agency.id)) {
      return { ok: false, error: "Choose a client on this workspace." };
    }
    if (!clientId) {
      const clientName = input.newClientName.trim().slice(0, 80);
      if (clientName.length < 2) return { ok: false, error: "Name the client organization." };
      clientId = createId("cli");
      newClient = { id: clientId, name: clientName };
    }
  }
  const createdAt = nowIso();
  if (isLiveSupabase()) {
    const admin = createServiceClient();
    if (!admin) return { ok: false, error: "Add SUPABASE_SECRET_KEY to invite people." };
    if (newClient) {
      const { error } = await admin.from("clients").insert({
        id: newClient.id,
        agency_id: agency.id,
        name: newClient.name,
        website: "",
      });
      if (error) return { ok: false, error: "Could not add that client." };
    }
    const invited = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name },
    });
    if (invited.error || !invited.data.user) {
      return { ok: false, error: "The invite email did not send. Check Supabase Auth email settings." };
    }
    const { error } = await admin.from("profiles").insert({
      id: invited.data.user.id,
      email,
      name,
      role: input.role,
      agency_id: agency.id,
      client_id: input.role === "client" ? clientId : null,
      title: input.title.trim().slice(0, 80) || (input.role === "client" ? "Client" : "Team"),
    });
    if (error) return { ok: false, error: "The account was created but the profile was not." };
    return { ok: true };
  }
  try {
    await updatePatch((patch) => {
      if (newClient) {
        patch.clientCreate = [
          ...(patch.clientCreate ?? []),
          { id: newClient.id, agencyId: agency.id, name: newClient.name, website: "" },
        ];
      }
      patch.userCreate = [
        ...(patch.userCreate ?? []),
        {
          id: createId("usr"),
          email,
          name,
          role: input.role,
          agencyId: agency.id,
          clientId: input.role === "client" ? clientId : null,
          title: input.title.trim().slice(0, 80) || (input.role === "client" ? "Client" : "Team"),
        },
      ];
      patch.emailCreate = [
        ...(patch.emailCreate ?? []),
        {
          id: createId("em"),
          agencyId: agency.id,
          to: email,
          subject: `You're invited to ${agency.name} on Workroom`,
          body: `${name}, you have a seat on ${agency.name}. In this demo, sign in with ${email} and the shared demo password.`,
          createdAt,
        },
      ];
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not send that invite." };
  }
  return { ok: true };
}

export async function createTenant(input: {
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  plan: "starter" | "pro";
}): Promise<ActionResult> {
  const access = await guard();
  if (!access.ok) return access;
  if (access.viewer.role !== "super_admin") return { ok: false, error: HIDDEN };
  const name = input.name.trim().slice(0, 80);
  const slug = input.slug.trim().toLowerCase();
  const ownerName = input.ownerName.trim().slice(0, 80);
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  if (name.length < 2 || ownerName.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, error: "Add a studio name, a slug, and an owner." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return { ok: false, error: "Add the owner's email." };
  const db = await loadDatabase(false);
  if (db.agencies.some((agency) => agency.slug === slug) || db.users.some((user) => user.email === ownerEmail)) {
    return { ok: false, error: "That slug or email is already in use." };
  }
  const planStatus = input.plan === "pro" ? "trialing" : "active";
  const trialEndsAt =
    input.plan === "pro" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null;
  if (isLiveSupabase()) {
    const admin = createServiceClient();
    if (!admin) return { ok: false, error: "Add SUPABASE_SECRET_KEY to create a workspace." };
    const agencyId = createId("ag");
    const { error: agencyError } = await admin.from("agencies").insert({
      id: agencyId,
      slug,
      name,
      logo_text: name.slice(0, 2).toUpperCase(),
      logo_url: null,
      brand_color: "#1f6b4a",
      plan: input.plan,
      plan_status: planStatus,
      trial_ends_at: trialEndsAt,
    });
    if (agencyError) return { ok: false, error: "Could not create that workspace." };
    const invited = await admin.auth.admin.inviteUserByEmail(ownerEmail, { data: { name: ownerName } });
    if (invited.error || !invited.data.user) return { ok: false, error: "The workspace exists, but the owner invite failed." };
    await admin.from("profiles").insert({
      id: invited.data.user.id,
      email: ownerEmail,
      name: ownerName,
      role: "agency_owner",
      agency_id: agencyId,
      client_id: null,
      title: "Owner",
    });
    return { ok: true };
  }
  const agencyId = createId("ag");
  const createdAt = nowIso();
  try {
    await updatePatch((patch) => {
      patch.agencyCreate = [
        ...(patch.agencyCreate ?? []),
        {
          id: agencyId,
          slug,
          name,
          logoText: name.slice(0, 2).toUpperCase(),
          logoUrl: null,
          brandColor: "#1f6b4a",
          plan: input.plan,
          planStatus,
          trialEndsAt,
        },
      ];
      patch.userCreate = [
        ...(patch.userCreate ?? []),
        {
          id: createId("usr"),
          email: ownerEmail,
          name: ownerName,
          role: "agency_owner",
          agencyId,
          clientId: null,
          title: "Owner",
        },
      ];
      patch.emailCreate = [
        ...(patch.emailCreate ?? []),
        {
          id: createId("em"),
          agencyId,
          to: ownerEmail,
          subject: `${name} is ready on Workroom`,
          body: `Sign in as ${ownerEmail} with the shared demo password. The workspace path is /w/${slug}.`,
          createdAt,
        },
      ];
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create that workspace." };
  }
  return { ok: true };
}
