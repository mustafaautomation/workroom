import "server-only";

import { stripeSecret } from "@/lib/mode";

export async function getStripe() {
  const key = stripeSecret();
  if (!key) return null;
  const { default: Stripe } = await import("stripe");
  return new Stripe(key);
}
