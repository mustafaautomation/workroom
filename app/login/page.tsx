import { Suspense } from "react";
import Link from "next/link";
import { DEMO_PASSWORD } from "@/lib/auth/password";
import { isLiveSupabase } from "@/lib/mode";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginPageContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/w/") || params.next === "/admin" ? params.next : "";
  return (
    <main id="main" className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex flex-col justify-between bg-sidebar px-8 py-8 text-sidebar-foreground lg:px-12">
        <Link href="/" className="font-serif text-3xl">
          Workroom
        </Link>
        <div className="max-w-sm py-16">
          <h1 className="font-serif text-5xl leading-none tracking-tight">The room is already furnished.</h1>
          <p className="mt-4 text-sidebar-muted">
            Sign in as a studio, a teammate, or a client. Or open the public demo and change nothing.
          </p>
        </div>
        <p className="text-sm text-sidebar-muted">Fictional studios. Real isolation rules.</p>
      </section>
      <section className="px-6 py-10 sm:px-12 lg:py-16">
        <div className="mx-auto max-w-md">
          <h2 className="font-serif text-3xl">Sign in</h2>
          <div className="mt-8">
            <LoginForm
              mockMode={!isLiveSupabase()}
              demoPassword={DEMO_PASSWORD}
              nextPath={nextPath}
              linkError={params.error === "link"}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
