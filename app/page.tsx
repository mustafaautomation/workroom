import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const features = [
  {
    title: "A path that feels like a subdomain",
    body: "Each studio lives at /w/northline and presents itself as northline.workroom.app. Logo, name, and brand color travel with every screen.",
  },
  {
    title: "Approvals with a thread, not a PDF comment",
    body: "Clients approve or request changes. The note stays on the deliverable, and the studio gets an in-app notice plus a mocked email.",
  },
  {
    title: "One invoice, actually payable",
    body: "Keep billing thin. A client opens an invoice and pays it in Stripe test mode, or in the built-in test checkout when Stripe isn't configured.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          Workroom
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <a href="#product" className="hidden px-3 py-2 sm:inline">
            Product
          </a>
          <a href="#pricing" className="hidden px-3 py-2 sm:inline">
            Pricing
          </a>
          <Link href="/demo" className="rounded-full px-3 py-2 hover:bg-accent">
            View demo
          </Link>
          <Link href="/login" className="rounded-full bg-primary px-4 py-2 text-primary-foreground">
            Sign in
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-end gap-12 px-5 pb-16 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
          <div>
            <p className="text-sm font-medium text-brand">For agencies and consultants</p>
            <h1 className="mt-4 max-w-xl font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">
              Send the room. Not the folder.
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Workroom is a white-label client portal. Projects, approvals, files, and invoices live under your name and your color.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-primary-foreground">
                Open the Northline demo
              </Link>
              <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-6">
                Sign in to a seat
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border bg-sidebar text-sidebar-foreground shadow-[0_24px_80px_rgba(28,25,21,0.12)]">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs text-sidebar-muted">
              <span className="size-2 rounded-full bg-[#c9b8a2]" />
              <span className="size-2 rounded-full bg-[#c9b8a2]/70" />
              <span className="size-2 rounded-full bg-[#c9b8a2]/40" />
              <span className="ml-2 font-mono">northline.workroom.app</span>
            </div>
            <div className="grid grid-cols-[140px_1fr]">
              <div className="space-y-3 border-r border-white/10 p-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-[#1f6b4a] text-[10px] font-semibold">NL</span>
                  <span>Northline</span>
                </div>
                <p className="rounded-lg bg-white/10 px-2 py-1">Overview</p>
                <p className="px-2 text-sidebar-muted">Projects</p>
                <p className="px-2 text-sidebar-muted">Invoices</p>
              </div>
              <div className="space-y-3 bg-[#f7f3ec] p-4 text-[#1c1915]">
                <p className="text-xs text-[#6f675e]">2 waiting on clients</p>
                <p className="font-serif text-2xl leading-none">Atlas brand system</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#e7dfd0]">
                  <div className="h-full w-[71%] bg-[#1f6b4a]" />
                </div>
                <div className="rounded-xl border border-[#e4dccf] bg-white p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Color and type · v1</span>
                    <span className="rounded-full bg-[#f8efd8] px-2 py-0.5 text-[#7a5410]">Pending review</span>
                  </div>
                  <p className="mt-2 text-[#6f675e]">Priya can approve it, or send it back with a note.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title}>
                <h2 className="font-serif text-2xl tracking-tight">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <h2 className="font-serif text-4xl tracking-tight">The client sees their work. Not the studio&apos;s whole book.</h2>
            <p className="mt-4 text-muted-foreground">
              Owners and teammates see the studio. A client sees only their organization: their projects, the tasks you marked visible, their files, and their invoices. Another agency&apos;s room returns a 404.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              "Board and list for the same tasks",
              "Milestones with due dates",
              "File versions you can download",
              "Threaded comments on each deliverable",
              "Notifications, plus an outbox when email isn't connected",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 md:grid-cols-2">
          <article className="rounded-3xl border border-border bg-card p-8">
            <p className="text-sm text-muted-foreground">Starter</p>
            <p className="mt-3 font-serif text-5xl">$49</p>
            <p className="text-sm text-muted-foreground">per workspace / month</p>
            <ul className="mt-6 space-y-2 text-sm">
              <li>3 active projects</li>
              <li>2 team seats</li>
              <li>Client approvals, files, and invoices</li>
            </ul>
          </article>
          <article className="rounded-3xl bg-sidebar p-8 text-sidebar-foreground">
            <p className="text-sm text-sidebar-muted">Pro</p>
            <p className="mt-3 font-serif text-5xl">$149</p>
            <p className="text-sm text-sidebar-muted">per workspace / month, 14-day trial</p>
            <ul className="mt-6 space-y-2 text-sm">
              <li>Unlimited projects and seats</li>
              <li>Custom logo and brand color</li>
              <li>Optional Groq or Gemini status notes</li>
            </ul>
            <Link href="/demo" className="mt-8 inline-flex items-center gap-2 text-sm font-medium">
              Preview a Pro studio <ArrowUpRight className="size-4" />
            </Link>
          </article>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>Workroom. Northline Studio and Fieldnote Advisory are fictional.</p>
          <p>Demo mode is read-only. No account required.</p>
        </div>
      </footer>
    </div>
  );
}
