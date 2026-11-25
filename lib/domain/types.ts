export type Role = "super_admin" | "agency_owner" | "team_member" | "client";

export type Plan = "starter" | "pro";

export type PlanStatus = "active" | "trialing" | "canceled";

export type ProjectStatus = "active" | "paused" | "completed";

export type TaskStatus = "backlog" | "in_progress" | "review" | "done";

export type DeliverableStatus = "pending" | "approved" | "changes_requested";

export type InvoiceStatus = "open" | "paid" | "void";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  agencyId: string | null;
  clientId: string | null;
  title: string;
};

export type Viewer = {
  id: string;
  email: string;
  name: string;
  role: Role;
  agencyId: string | null;
  clientId: string | null;
  title: string;
};

export type Actor = {
  id: string;
  role: Role;
  agencyId: string | null;
  clientId: string | null;
};

export type Agency = {
  id: string;
  slug: string;
  name: string;
  logoText: string;
  logoUrl: string | null;
  brandColor: string;
  plan: Plan;
  planStatus: PlanStatus;
  trialEndsAt: string | null;
};

export type ClientOrg = {
  id: string;
  agencyId: string;
  name: string;
  website: string;
};

export type Project = {
  id: string;
  agencyId: string;
  clientId: string;
  name: string;
  summary: string;
  status: ProjectStatus;
  dueDate: string;
};

export type Milestone = {
  id: string;
  projectId: string;
  name: string;
  dueDate: string;
  position: number;
};

export type Task = {
  id: string;
  projectId: string;
  milestoneId: string;
  title: string;
  status: TaskStatus;
  clientVisible: boolean;
  assigneeId: string | null;
};

export type FileAsset = {
  id: string;
  projectId: string;
  agencyId: string;
  name: string;
  filename: string;
  version: string;
  bytes: number;
  mime: string;
  uploadedBy: string;
  uploadedAt: string;
  storagePath: string;
};

export type Deliverable = {
  id: string;
  projectId: string;
  agencyId: string;
  title: string;
  summary: string;
  status: DeliverableStatus;
  version: string;
  fileId: string | null;
  updatedAt: string;
};

export type Comment = {
  id: string;
  deliverableId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type InvoiceLine = {
  description: string;
  amount: number;
};

export type Invoice = {
  id: string;
  agencyId: string;
  clientId: string;
  projectId: string;
  number: string;
  status: InvoiceStatus;
  issuedOn: string;
  dueDate: string;
  lines: InvoiceLine[];
};

export type Notification = {
  id: string;
  userId: string;
  agencyId: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type EmailMessage = {
  id: string;
  agencyId: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
};

export type Database = {
  users: User[];
  agencies: Agency[];
  clients: ClientOrg[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  files: FileAsset[];
  deliverables: Deliverable[];
  comments: Comment[];
  invoices: Invoice[];
  notifications: Notification[];
  emails: EmailMessage[];
};

export type Patch = {
  deliverableStatus?: Record<string, DeliverableStatus>;
  deliverableVersion?: Record<string, string>;
  invoiceStatus?: Record<string, InvoiceStatus>;
  taskStatus?: Record<string, TaskStatus>;
  projectCreate?: Project[];
  milestoneCreate?: Milestone[];
  taskCreate?: Task[];
  commentCreate?: Comment[];
  notificationCreate?: Notification[];
  emailCreate?: EmailMessage[];
  fileCreate?: FileAsset[];
  userCreate?: User[];
  clientCreate?: ClientOrg[];
  agencyCreate?: Agency[];
  agencyUpdate?: Record<string, Partial<Agency>>;
  notificationRead?: string[];
};

export function toViewer(user: User): Viewer {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    agencyId: user.agencyId,
    clientId: user.clientId,
    title: user.title,
  };
}

export function toActor(viewer: Viewer): Actor {
  return {
    id: viewer.id,
    role: viewer.role,
    agencyId: viewer.agencyId,
    clientId: viewer.clientId,
  };
}
