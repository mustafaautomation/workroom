"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canPayInvoice } from "@/lib/domain/permissions";
import { getViewer, loadDatabase } from "@/lib/data";
import { isDemoMutation } from "@/lib/demo-gate";
import { hasStripe } from "@/lib/mode";
import { requestOrigin } from "@/lib/origin";
import { getStripe } from "@/lib/stripe";
import { summarize } from "@/lib/ai";
import {
  addComment,
  createProject,
  createTenant,
  decideDeliverable,
  invitePerson,
  markInvoicePaid,
  markNotificationsRead,
  moveTask,
  payInvoice,
  resubmitDeliverable,
  setAgencyPlan,
  updateBrand,
  uploadProjectFile,
} from "@/lib/work/service";
import type { ActionResult, SummaryResult } from "@/lib/work/result";

function refresh() {
  revalidatePath("/w/[slug]", "layout");
  revalidatePath("/demo/[[...segments]]", "page");
  revalidatePath("/admin");
}

async function done(result: ActionResult): Promise<ActionResult> {
  if (result.ok) refresh();
  return result;
}

export async function approveDeliverable(id: string) {
  return done(await decideDeliverable(id, "approved", ""));
}

export async function requestChanges(id: string, comment: string) {
  return done(await decideDeliverable(id, "changes_requested", comment));
}

export async function commentOnDeliverable(id: string, body: string) {
  return done(await addComment(id, body));
}

export async function sendUpdatedVersion(id: string, version: string) {
  return done(await resubmitDeliverable(id, version));
}

export async function updateTaskStatus(taskId: string, status: string) {
  return done(await moveTask(taskId, status));
}

export async function payMockInvoice(invoiceId: string) {
  return done(await payInvoice(invoiceId));
}

export async function confirmStripeReturn(invoiceId: string, sessionId: string) {
  if (!sessionId || (await isDemoMutation())) return;
  const stripe = await getStripe();
  if (!stripe) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return;
    if (session.metadata?.invoiceId !== invoiceId) return;
    const result = await markInvoicePaid(invoiceId);
    if (result.ok) refresh();
  } catch (error) {
    console.error(error);
  }
}

export async function startCheckout(invoiceId: string): Promise<ActionResult> {
  if (await isDemoMutation()) return { ok: false, error: "This demo is read-only." };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to continue." };
  const db = await loadDatabase(false);
  const invoice = db.invoices.find((item) => item.id === invoiceId);
  const agency = invoice ? db.agencies.find((item) => item.id === invoice.agencyId) : undefined;
  if (!invoice || !agency || !canPayInvoice(viewer, invoice)) {
    return { ok: false, error: "That invoice isn't on your account." };
  }
  if (!hasStripe()) redirect(`/w/${agency.slug}/invoices/${invoice.id}/checkout`);
  const stripe = await getStripe();
  if (!stripe) redirect(`/w/${agency.slug}/invoices/${invoice.id}/checkout`);
  const origin = await requestOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: viewer.email,
    line_items: invoice.lines.map((line) => ({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: line.amount,
        product_data: { name: line.description },
      },
    })),
    success_url: `${origin}/w/${agency.slug}/invoices/${invoice.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/w/${agency.slug}/invoices/${invoice.id}`,
    metadata: { invoiceId: invoice.id },
  });
  if (!session.url) return { ok: false, error: "Stripe did not return a checkout link." };
  redirect(session.url);
}

export async function saveProject(_prev: ActionResult | null, formData: FormData) {
  return done(
    await createProject({
      agencyId: String(formData.get("agencyId") ?? ""),
      clientId: String(formData.get("clientId") ?? ""),
      name: String(formData.get("name") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
    }),
  );
}

export async function saveBrand(_prev: ActionResult | null, formData: FormData) {
  const logo = formData.get("logo");
  let logoDataUrl: string | null = null;
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 24_000) return { ok: false, error: "Use a logo under 24 KB." };
    const bytes = Buffer.from(await logo.arrayBuffer());
    const mime = logo.type.startsWith("image/") ? logo.type : "image/png";
    logoDataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  }
  return done(
    await updateBrand({
      agencyId: String(formData.get("agencyId") ?? ""),
      name: String(formData.get("name") ?? ""),
      brandColor: String(formData.get("brandColor") ?? ""),
      logoDataUrl,
    }),
  );
}

export async function saveInvite(_prev: ActionResult | null, formData: FormData) {
  const role = String(formData.get("role") ?? "");
  if (role !== "team_member" && role !== "client") return { ok: false, error: "Choose a role." };
  const clientId = String(formData.get("clientId") ?? "");
  return done(
    await invitePerson({
      agencyId: String(formData.get("agencyId") ?? ""),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role,
      title: String(formData.get("title") ?? ""),
      clientId: clientId || null,
      newClientName: String(formData.get("newClientName") ?? ""),
    }),
  );
}

export async function markRead(ids: string[]) {
  return done(await markNotificationsRead(ids));
}

export async function changePlan(agencyId: string, action: "starter" | "trial" | "upgrade" | "cancel") {
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  if (action === "starter") {
    return done(await setAgencyPlan({ agencyId, plan: "starter", planStatus: "active", trialEndsAt: null }));
  }
  if (action === "trial") {
    return done(await setAgencyPlan({ agencyId, plan: "pro", planStatus: "trialing", trialEndsAt }));
  }
  if (action === "upgrade") {
    return done(await setAgencyPlan({ agencyId, plan: "pro", planStatus: "active", trialEndsAt: null }));
  }
  return done(await setAgencyPlan({ agencyId, plan: "pro", planStatus: "canceled", trialEndsAt: null }));
}

export async function saveTenant(_prev: ActionResult | null, formData: FormData) {
  const plan = String(formData.get("plan") ?? "starter");
  return done(
    await createTenant({
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      ownerName: String(formData.get("ownerName") ?? ""),
      ownerEmail: String(formData.get("ownerEmail") ?? ""),
      plan: plan === "pro" ? "pro" : "starter",
    }),
  );
}

export async function uploadFile(_prev: ActionResult | null, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a file to upload." };
  return done(
    await uploadProjectFile({
      projectId: String(formData.get("projectId") ?? ""),
      name: String(formData.get("name") ?? ""),
      version: String(formData.get("version") ?? ""),
      filename: file.name,
      mime: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    }),
  );
}

export async function projectSummary(projectId: string): Promise<SummaryResult> {
  if (await isDemoMutation()) {
    const db = await loadDatabase(true);
    const project = db.projects.find((item) => item.id === projectId);
    if (!project) return { ok: false, error: "That project isn't available." };
    const client = db.clients.find((item) => item.id === project.clientId);
    const { demoActor } = await import("@/lib/domain/permissions");
    return summarize({
      project,
      clientName: client?.name ?? "Client",
      tasks: db.tasks.filter((task) => task.projectId === project.id),
      deliverables: db.deliverables.filter((item) => item.projectId === project.id),
      invoices: db.invoices.filter((item) => item.projectId === project.id),
      actor: demoActor(project.agencyId),
    });
  }
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to continue." };
  const db = await loadDatabase(false);
  const project = db.projects.find((item) => item.id === projectId);
  if (!project) return { ok: false, error: "That project isn't available." };
  const { canAccessProject } = await import("@/lib/domain/permissions");
  if (!canAccessProject(viewer, project)) return { ok: false, error: "That project isn't available." };
  const client = db.clients.find((item) => item.id === project.clientId);
  return summarize({
    project,
    clientName: client?.name ?? "Client",
    tasks: db.tasks.filter((task) => task.projectId === project.id),
    deliverables: db.deliverables.filter((item) => item.projectId === project.id),
    invoices: db.invoices.filter((item) => item.projectId === project.id),
    actor: viewer,
  });
}
