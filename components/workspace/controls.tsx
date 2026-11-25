"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changePlan, markRead, payMockInvoice, saveBrand, saveInvite, saveProject, saveTenant, startCheckout } from "@/lib/actions/work";
import type { ActionResult } from "@/lib/work/result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function note(state: ActionResult | null) {
  if (!state || state.ok) return null;
  return <p className="text-sm text-destructive">{state.error}</p>;
}

export function CreateProjectForm({
  agencyId,
  clients,
  disabled,
}: {
  agencyId: string;
  clients: { id: string; name: string }[];
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(saveProject, null as ActionResult | null);
  if (clients.length === 0) return null;
  return (
    <details className="rounded-2xl border border-border bg-card p-4">
      <summary className="cursor-pointer font-medium">New project</summary>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="agencyId" value={agencyId} />
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-name">Name</Label>
          <Input id="project-name" name="name" required disabled={disabled || pending} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-summary">Summary</Label>
          <Textarea id="project-summary" name="summary" disabled={disabled || pending} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-client">Client</Label>
          <select id="project-client" name="clientId" className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm" disabled={disabled || pending}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-due">Due date</Label>
          <Input id="project-due" name="dueDate" type="date" required disabled={disabled || pending} />
        </div>
        <Button type="submit" disabled={disabled || pending}>
          {disabled ? "Read-only demo" : "Open project"}
        </Button>
        {note(state)}
      </form>
    </details>
  );
}

export function BrandForm({
  agencyId,
  name,
  color,
  disabled,
}: {
  agencyId: string;
  name: string;
  color: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(saveBrand, null as ActionResult | null);
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-border bg-card p-5">
      <input type="hidden" name="agencyId" value={agencyId} />
      <div className="space-y-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input id="workspace-name" name="name" defaultValue={name} disabled={disabled || pending} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="brand-color">Brand color</Label>
        <Input id="brand-color" name="brandColor" defaultValue={color} pattern="#[0-9a-fA-F]{6}" disabled={disabled || pending} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="logo">Logo</Label>
        <Input id="logo" name="logo" type="file" accept="image/*" disabled={disabled || pending} />
        <p className="text-xs text-muted-foreground">Under 24 KB. Leave empty to keep the current mark.</p>
      </div>
      <Button type="submit" disabled={disabled || pending}>
        Save brand
      </Button>
      {note(state)}
    </form>
  );
}

export function InviteForm({
  agencyId,
  clients,
  disabled,
}: {
  agencyId: string;
  clients: { id: string; name: string }[];
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(saveInvite, null as ActionResult | null);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
      <input type="hidden" name="agencyId" value={agencyId} />
      <div className="space-y-2">
        <Label htmlFor="invite-name">Name</Label>
        <Input id="invite-name" name="name" required disabled={disabled || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" name="email" type="email" required disabled={disabled || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-role">Role</Label>
        <select id="invite-role" name="role" className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm" disabled={disabled || pending}>
          <option value="team_member">Team member</option>
          <option value="client">Client</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-title">Title</Label>
        <Input id="invite-title" name="title" disabled={disabled || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-client">Existing client</Label>
        <select id="invite-client" name="clientId" className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm" disabled={disabled || pending} defaultValue="">
          <option value="">New client below</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-client">New client name</Label>
        <Input id="new-client" name="newClientName" disabled={disabled || pending} />
      </div>
      <Button type="submit" disabled={disabled || pending}>
        Send invite
      </Button>
      {note(state)}
    </form>
  );
}

export function PayButtons({
  invoiceId,
  amountLabel,
  stripe,
  disabled,
  checkoutHref,
}: {
  invoiceId: string;
  amountLabel: string;
  stripe: boolean;
  disabled: boolean;
  checkoutHref: string;
}) {
  const [pending, start] = useTransition();
  if (!stripe) {
    if (disabled) {
      return (
        <Button type="button" variant="brand" disabled>
          Review and pay {amountLabel}
        </Button>
      );
    }
    return (
      <Button asChild variant="brand">
        <Link href={checkoutHref}>Review and pay {amountLabel}</Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="brand"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const result = await startCheckout(invoiceId);
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      Continue to Stripe Checkout
    </Button>
  );
}

export function CheckoutCard({
  invoiceId,
  amountLabel,
  number,
  disabled,
  paid,
}: {
  invoiceId: string;
  amountLabel: string;
  number: string;
  disabled: boolean;
  paid: boolean;
}) {
  if (paid) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-6">
        <p className="text-sm text-brand">Paid</p>
        <h1 className="mt-2 font-serif text-4xl">{number} is paid.</h1>
        <p className="mt-2 text-muted-foreground">The studio has the receipt in Messages and notifications.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">Stripe test mode is not configured</p>
      <h1 className="mt-2 font-serif text-4xl">Pay {number}</h1>
      <p className="mt-2 text-muted-foreground">This payment is simulated. Use the Stripe test card.</p>
      <div className="mt-6 space-y-3 text-sm">
        <p>Card number</p>
        <p className="rounded-xl bg-muted px-3 py-2 font-mono">4242 4242 4242 4242</p>
        <div className="grid grid-cols-2 gap-3">
          <p className="rounded-xl bg-muted px-3 py-2 font-mono">12 / 34</p>
          <p className="rounded-xl bg-muted px-3 py-2 font-mono">424</p>
        </div>
      </div>
      <div className="mt-6">
        <MockPayButton invoiceId={invoiceId} amountLabel={amountLabel} disabled={disabled} />
      </div>
    </div>
  );
}

function MockPayButton({
  invoiceId,
  amountLabel,
  disabled,
}: {
  invoiceId: string;
  amountLabel: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="brand"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const result = await payMockInvoice(invoiceId);
          if (!result.ok) toast.error(result.error);
          else {
            toast.success(`Paid ${amountLabel}`);
            router.refresh();
          }
        })
      }
    >
      Pay {amountLabel} with test card
    </Button>
  );
}

export function MarkReadButton({ ids, disabled }: { ids: string[]; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (ids.length === 0) return null;
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const result = await markRead(ids);
          if (!result.ok) toast.error(result.error);
          else router.refresh();
        })
      }
    >
      Mark all read
    </Button>
  );
}

export function PlanButtons({ agencyId }: { agencyId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const actions = [
    ["starter", "Set Starter"],
    ["trial", "Start Pro trial"],
    ["upgrade", "Upgrade to Pro"],
    ["cancel", "Cancel"],
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(([action, label]) => (
        <Button
          key={action}
          type="button"
          size="sm"
          variant={action === "cancel" ? "outline" : "secondary"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await changePlan(agencyId, action);
              if (!result.ok) toast.error(result.error);
              else {
                toast.success(label);
                router.refresh();
              }
            })
          }
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

export function TenantForm() {
  const [state, action, pending] = useActionState(saveTenant, null as ActionResult | null);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="tenant-name">Studio name</Label>
        <Input id="tenant-name" name="name" required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tenant-slug">Slug</Label>
        <Input id="tenant-slug" name="slug" placeholder="lumen-studio" required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner-name">Owner name</Label>
        <Input id="owner-name" name="ownerName" required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner-email">Owner email</Label>
        <Input id="owner-email" name="ownerEmail" type="email" required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tenant-plan">Plan</Label>
        <select id="tenant-plan" name="plan" className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm" disabled={pending}>
          <option value="starter">Starter</option>
          <option value="pro">Pro trial</option>
        </select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          Create workspace
        </Button>
      </div>
      {note(state)}
    </form>
  );
}
