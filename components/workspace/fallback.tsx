export function WorkspaceFallback() {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]" aria-busy="true" aria-live="polite">
      <div className="hidden bg-sidebar lg:block" />
      <div className="space-y-4 p-8">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        </div>
        <p className="text-sm text-muted-foreground">Loading the workspace…</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
