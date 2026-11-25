import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">That page is not on this workspace.</h1>
      <p className="mt-3 text-muted-foreground">
        It may belong to another studio, or the link is out of date. Workroom does not reveal work you are not on.
      </p>
      <Link href="/" className="mt-8 text-sm font-medium underline">
        Back to Workroom
      </Link>
    </main>
  );
}
