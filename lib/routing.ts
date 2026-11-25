import type { WorkspaceView } from "@/components/workspace/screen";

export function parseView(segments: string[] | undefined): WorkspaceView | null {
  const [first, second, third] = segments ?? [];
  if (!first) return { kind: "dashboard" };
  if (first === "projects" && !second) return { kind: "projects" };
  if (first === "projects" && second && !third) return { kind: "project", projectId: second };
  if (first === "invoices" && !second) return { kind: "invoices" };
  if (first === "invoices" && second && !third) return { kind: "invoice", invoiceId: second };
  if (first === "invoices" && second && third === "checkout") return { kind: "checkout", invoiceId: second };
  if (first === "notifications" && !second) return { kind: "notifications" };
  if (first === "outbox" && !second) return { kind: "outbox" };
  if (first === "people" && !second) return { kind: "people" };
  if (first === "settings" && !second) return { kind: "settings" };
  return null;
}

export function agencyFromSearch(value: string | undefined) {
  return value === "fieldnote" ? "fieldnote" : "northline";
}
