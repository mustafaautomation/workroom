"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, FolderKanban, LayoutDashboard, LogOut, Mail, Menu, Receipt, Settings, Users } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { Menu as UserMenu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

const icons = {
  overview: LayoutDashboard,
  projects: FolderKanban,
  invoices: Receipt,
  outbox: Mail,
  people: Users,
  settings: Settings,
};

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof icons;
  exact?: boolean;
};

export function WorkspaceChrome({
  agencyName,
  logoText,
  logoUrl,
  host,
  items,
  user,
  unread,
  demo,
  switchHref,
  switchLabel,
  children,
}: {
  agencyName: string;
  logoText: string;
  logoUrl: string | null;
  host: string;
  items: NavItem[];
  user: { name: string; email: string; admin?: boolean } | null;
  unread: number;
  demo: boolean;
  switchHref?: string;
  switchLabel?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const notifications = items[0] ? `${items[0].href.split("?")[0].replace(/\/$/, "")}/notifications${items[0].href.includes("?") ? `?${items[0].href.split("?")[1]}` : ""}` : "/login";

  function active(item: NavItem) {
    const path = item.href.split("?")[0];
    if (item.exact) return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const current = active(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
              current ? "bg-white/10 text-sidebar-foreground" : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground",
            )}
          >
            <Icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 px-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-10 rounded-full object-cover" />
          ) : (
            <span className="grid size-10 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
              {logoText}
            </span>
          )}
          <div>
            <p className="font-medium leading-tight">{agencyName}</p>
            <p className="font-mono text-[11px] text-sidebar-muted">{host}</p>
          </div>
        </div>
        <div className="mt-8">{nav}</div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-8">
          <button type="button" className="rounded-full border border-border p-2 lg:hidden" aria-expanded={open} aria-label="Open navigation" onClick={() => setOpen(true)}>
            <Menu className="size-4" />
          </button>
          <p className="font-mono text-xs text-muted-foreground lg:hidden">{host}</p>
          <div className="ml-auto flex items-center gap-2">
            <Link href={notifications} className="relative rounded-full border border-border p-2" aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
              <Bell className="size-4" />
              {unread > 0 ? (
                <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] text-brand-foreground">
                  {unread}
                </span>
              ) : null}
            </Link>
            {demo || !user ? (
              <Link href="/login" className="rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground">
                Sign in
              </Link>
            ) : (
              <UserMenu>
                <MenuTrigger className="rounded-full border border-border px-3 py-2 text-sm">{user.name}</MenuTrigger>
                <MenuContent>
                  <div className="px-3 py-2 text-xs text-muted-foreground">{user.email}</div>
                  {user.admin ? (
                    <MenuItem asChild>
                      <Link href="/admin">Platform admin</Link>
                    </MenuItem>
                  ) : null}
                  <MenuItem asChild>
                    <form action={signOut}>
                      <button type="submit" className="flex w-full items-center gap-2">
                        <LogOut className="size-4" /> Sign out
                      </button>
                    </form>
                  </MenuItem>
                </MenuContent>
              </UserMenu>
            )}
          </div>
        </header>
        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar p-4 text-sidebar-foreground">
              <p className="px-2 font-serif text-2xl">{agencyName}</p>
              <div className="mt-6">{nav}</div>
            </div>
          </div>
        ) : null}
        {demo ? (
          <div className="border-b border-border bg-[#f8efd8] px-4 py-3 text-sm text-[#5c4310] sm:px-8">
            Read-only preview. Nothing you do is saved.{" "}
            {switchHref && switchLabel ? (
              <>
                <Link className="font-medium underline" href={switchHref}>
                  {switchLabel}
                </Link>
                {" · "}
              </>
            ) : null}
            <Link className="font-medium underline" href="/login">
              Sign in
            </Link>{" "}
            to use a seat.
          </div>
        ) : null}
        <div id="main">{children}</div>
      </div>
    </div>
  );
}
