# Workroom deploy notes

- Build command: `npm run build`
- Dev command: `npm run dev` (http://127.0.0.1:3847)
- Start command: `npm run start`
- Typecheck: `npm run typecheck` (`next typegen && tsc --noEmit`)
- Unit tests: `npm test`
- E2E: `npm run test:e2e` (Playwright, `@playwright/test` >= 1.65.1)
- CI: `.github/workflows/ci.yml` on `ubuntu-latest`, zero secrets
- Live URL target: https://workroom.quvantic.com
- Vercel project name: `workroom`
- GitHub target: https://github.com/mustafaautomation/workroom

All environment variables are optional. With none set, the app runs in mock mode (auth, demo, approvals, files, test checkout).

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | no | Public origin for magic links and Stripe return URLs |
| `AUTH_SECRET` | no | Signs mock session cookies. Set before real users. Fallback is a public demo secret |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Enables Supabase when a publishable key is also set |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no | Supabase publishable key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` also accepted |
| `SUPABASE_SECRET_KEY` | no | Server-only secret for seed, invites, and recording payments. `SUPABASE_SERVICE_ROLE_KEY` also accepted |
| `STRIPE_SECRET_KEY` | no | Stripe test secret. Enables hosted Checkout |
| `STRIPE_WEBHOOK_SECRET` | no | Verifies `checkout.session.completed` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no | Not required for hosted Checkout |
| `GROQ_API_KEY` | no | Optional project summary. `GROQ_MODEL` defaults to `llama-3.3-70b-versatile` |
| `GEMINI_API_KEY` | no | Used when Groq is unset. `GEMINI_MODEL` defaults to `gemini-2.5-flash` |

Live Supabase: apply `supabase/migrations/202611250001_init.sql`, then `npm run seed`.

DNS for the live host: CNAME `workroom.quvantic.com` to `cname.vercel-dns.com`.
