"use client";

import { useActionState, useRef, useState } from "react";
import { sendMagicLink, signIn, type MagicResult } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/work/result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const seats = [
  { email: "maya@northline.studio", label: "Maya Chen", detail: "Northline owner" },
  { email: "jordan@northline.studio", label: "Jordan Hale", detail: "Northline team" },
  { email: "priya@acmerobotics.com", label: "Priya Shah", detail: "Acme client" },
  { email: "luis@harborandco.com", label: "Luis Ortega", detail: "Harbor client" },
  { email: "sam@fieldnote.advisory", label: "Sam Okonkwo", detail: "Fieldnote owner" },
  { email: "elena@lumenhealth.com", label: "Elena Voss", detail: "Lumen client" },
  { email: "mustafa@quvantic.com", label: "Mustafa", detail: "Platform admin" },
];

export function LoginForm({
  mockMode,
  demoPassword,
  nextPath,
  linkError,
}: {
  mockMode: boolean;
  demoPassword: string;
  nextPath: string;
  linkError: boolean;
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(signIn, null as ActionResult | null);
  const [magic, setMagic] = useState<MagicResult | null>(null);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicPending, setMagicPending] = useState(false);

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input ref={emailRef} id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input ref={passwordRef} id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state && !state.ok ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {linkError ? <p className="text-sm text-destructive">That sign-in link expired or was changed. Request another.</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 className="font-medium">Email a sign-in link</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mockMode
              ? "No email provider is configured. If the address is on a workspace, the link appears here and in the studio outbox."
              : "We'll send a magic link if this address can sign in."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={magicPending}
          onClick={() => {
            const email = emailRef.current?.value ?? "";
            const formData = new FormData();
            formData.set("email", email);
            formData.set("origin", window.location.origin);
            setMagicEmail(email);
            setMagicPending(true);
            void sendMagicLink(null, formData)
              .then(setMagic)
              .finally(() => setMagicPending(false));
          }}
        >
          {magicPending ? "Preparing link…" : "Send magic link"}
        </Button>
        {magic && !magic.ok ? <p className="text-sm text-destructive">{magic.error}</p> : null}
        {magic && magic.ok && magic.previewUrl ? (
          <p className="text-sm">
            Demo link:{" "}
            <a className="underline" href={magic.previewUrl}>
              Sign in as {magicEmail}
            </a>
          </p>
        ) : null}
        {magic && magic.ok && !magic.previewUrl ? (
          <p className="text-sm text-muted-foreground">If this email is on a workspace, the link is on its way.</p>
        ) : null}
      </div>

      {mockMode ? (
        <div>
          <h2 className="text-sm font-medium">Demo seats</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every seat uses the password <span className="font-mono text-foreground">{demoPassword}</span>.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {seats.map((seat) => (
              <button
                key={seat.email}
                type="button"
                className="rounded-xl border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  if (emailRef.current) emailRef.current.value = seat.email;
                  if (passwordRef.current) passwordRef.current.value = demoPassword;
                }}
              >
                <span className="block font-medium">{seat.label}</span>
                <span className="text-muted-foreground">{seat.detail}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
