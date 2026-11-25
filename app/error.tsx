"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-sm font-medium text-destructive">Something went wrong</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">The room didn&apos;t load.</h1>
      <p className="mt-3 text-muted-foreground">{error.message || "Try again. If this keeps happening, the data source is unreachable."}</p>
      <button type="button" onClick={reset} className="mt-8 h-10 w-fit rounded-full bg-primary px-4 text-sm text-primary-foreground">
        Try again
      </button>
    </main>
  );
}
