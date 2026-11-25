import type { Deliverable, Invoice, Project, Task } from "./types";
import { invoiceTotal } from "./permissions";
import { formatMoney } from "./format";
import { progressFor } from "./progress";
import type { Actor } from "./types";

export function localStatusSummary(input: {
  project: Project;
  clientName: string;
  tasks: Task[];
  deliverables: Deliverable[];
  invoices: Invoice[];
  actor: Actor;
}): string {
  const { project, clientName, tasks, deliverables, invoices, actor } = input;
  const progress = progressFor(tasks, actor);
  const done = tasks.filter((task) => task.status === "done").length;
  const waiting = deliverables.filter((item) => item.status === "pending").map((item) => item.title);
  const changes = deliverables.filter((item) => item.status === "changes_requested").map((item) => item.title);
  const approved = deliverables.filter((item) => item.status === "approved").map((item) => item.title);
  const open = invoices.filter((invoice) => invoice.status === "open");
  const openTotal = open.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);

  const sentences = [
    `${project.name} for ${clientName} is ${project.status}. Shared progress sits at ${progress}%, with ${done} of ${tasks.length} tasks done.`,
  ];

  if (approved.length > 0) {
    sentences.push(`${approved.join(" and ")} ${approved.length === 1 ? "is" : "are"} already approved.`);
  }
  if (waiting.length > 0) {
    sentences.push(
      `${waiting.join(" and ")} ${waiting.length === 1 ? "is" : "are"} still waiting on the client.`,
    );
  }
  if (changes.length > 0) {
    sentences.push(`Changes were requested on ${changes.join(" and ")}.`);
  }
  if (open.length > 0) {
    sentences.push(
      `${open.length === 1 ? "One invoice is" : `${open.length} invoices are`} open, totaling ${formatMoney(openTotal)}.`,
    );
  } else {
    sentences.push("Nothing is waiting on payment.");
  }

  return sentences.join(" ");
}
