import type { DeliverableStatus, Invoice, InvoiceStatus, Plan, PlanStatus, ProjectStatus, TaskStatus } from "./types";
import { invoiceTotal } from "./permissions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  const monthIndex = Number(month) - 1;
  const label = MONTHS[monthIndex] ?? month;
  return `${label} ${Number(day)}, ${year}`;
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${remainder.toString().padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function invoiceAmount(invoice: Pick<Invoice, "lines">): string {
  return formatMoney(invoiceTotal(invoice));
}

export function brandForeground(hex: string): string {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#f7fffb";
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#1c1915" : "#f7fffb";
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  in_progress: "In progress",
  review: "In review",
  done: "Done",
};

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: "Open",
  paid: "Paid",
  void: "Void",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

export const PLAN_LABEL: Record<Plan, string> = {
  starter: "Starter",
  pro: "Pro",
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  active: "Active",
  trialing: "Pro trial",
  canceled: "Canceled",
};

export function workspaceHref(demo: boolean, slug: string, path = ""): string {
  if (!demo) return `/w/${slug}${path}`;
  const query = slug === "northline" ? "" : `?agency=${slug}`;
  return `/demo${path}${query}`;
}

export function localizeHref(href: string, demo: boolean): string {
  if (!demo) return href;
  const match = href.match(/^\/w\/([^/]+)(.*)$/);
  if (!match) return href;
  return workspaceHref(true, match[1], match[2]);
}

export function simulatedHost(slug: string): string {
  return `${slug}.workroom.app`;
}
