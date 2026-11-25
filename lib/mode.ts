export function supabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

export function supabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function isLiveSupabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && supabasePublishableKey());
}

export function stripeSecret() {
  return process.env.STRIPE_SECRET_KEY || "";
}

export function hasStripe() {
  return Boolean(stripeSecret());
}
