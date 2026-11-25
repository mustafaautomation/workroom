import type { Database, Patch } from "./types";

function appendUnique<T extends { id: string }>(list: T[], extra: T[] | undefined): T[] {
  if (!extra || extra.length === 0) return list;
  const ids = new Set(list.map((item) => item.id));
  const fresh = extra.filter((item) => !ids.has(item.id));
  if (fresh.length === 0) return list;
  return list.concat(fresh);
}

export function applyPatch(base: Database, patch: Patch): Database {
  const agencies = appendUnique(base.agencies, patch.agencyCreate).map((agency) => {
    const update = patch.agencyUpdate?.[agency.id];
    return update ? { ...agency, ...update } : agency;
  });

  const read = new Set(patch.notificationRead ?? []);

  return {
    users: appendUnique(base.users, patch.userCreate),
    agencies,
    clients: appendUnique(base.clients, patch.clientCreate),
    projects: appendUnique(base.projects, patch.projectCreate),
    milestones: appendUnique(base.milestones, patch.milestoneCreate),
    tasks: appendUnique(base.tasks, patch.taskCreate).map((task) => {
      const status = patch.taskStatus?.[task.id];
      return status ? { ...task, status } : task;
    }),
    files: appendUnique(base.files, patch.fileCreate),
    deliverables: base.deliverables.map((deliverable) => {
      const status = patch.deliverableStatus?.[deliverable.id];
      const version = patch.deliverableVersion?.[deliverable.id];
      if (!status && !version) return deliverable;
      return {
        ...deliverable,
        status: status ?? deliverable.status,
        version: version ?? deliverable.version,
      };
    }),
    comments: appendUnique(base.comments, patch.commentCreate),
    invoices: base.invoices.map((invoice) => {
      const status = patch.invoiceStatus?.[invoice.id];
      return status ? { ...invoice, status } : invoice;
    }),
    notifications: appendUnique(base.notifications, patch.notificationCreate).map((notification) =>
      read.has(notification.id) ? { ...notification, read: true } : notification,
    ),
    emails: appendUnique(base.emails, patch.emailCreate),
  };
}
