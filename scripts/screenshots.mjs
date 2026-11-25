// Captures the README screenshots from a running Workroom in mock mode (no env vars).
//
//   npm run build && npx next start --hostname 127.0.0.1 --port 4510
//   SCREENSHOT_BASE=http://127.0.0.1:4510 node scripts/screenshots.mjs
//
// Start from a fresh server so the seeded mock data is untouched.
import { chromium } from "@playwright/test"
import { mkdir } from "node:fs/promises"

const base = process.env.SCREENSHOT_BASE ?? "http://127.0.0.1:3847"
const dir = "docs/screenshots"
await mkdir(dir, { recursive: true })
const browser = await chromium.launch()

async function signIn(page, email) {
  await page.context().clearCookies()
  await page.goto(`${base}/login`)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill("workroom-demo")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/(w|admin)/)
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(base, { waitUntil: "networkidle" })
await page.screenshot({ path: `${dir}/marketing.png` })

await signIn(page, "maya@northline.studio")
await page.goto(`${base}/w/northline`)
await page.getByRole("heading", { name: "Welcome back, Maya Chen." }).waitFor()
await page.getByRole("link", { name: "Atlas brand system" }).first().waitFor()
await page.waitForLoadState("networkidle")
await page.screenshot({ path: `${dir}/dashboard.png` })

// Approvals and the invoice from the client's seat, where Approve and Pay are live.
await signIn(page, "priya@acmerobotics.com")
await page.goto(`${base}/w/northline/projects/prj_acme_brand`)
await page.getByRole("heading", { name: "Atlas brand system" }).waitFor()
await page.getByRole("tab", { name: "Approvals" }).click()
const pending = page.getByRole("article").filter({ hasText: "Color and type" })
await pending.getByRole("button", { name: "Approve" }).waitFor()
await page.getByRole("tablist").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24))
await page.waitForLoadState("networkidle")
await page.screenshot({ path: `${dir}/approvals.png` })

await page.goto(`${base}/w/northline/invoices/inv_acme_identity`)
await page.getByText("NL-1042").first().waitFor()
await page.waitForLoadState("networkidle")
await page.screenshot({ path: `${dir}/invoice.png` })

await signIn(page, "mustafa@quvantic.com")
await page.goto(`${base}/admin`)
await page.getByRole("heading", { name: "Workspaces" }).waitFor()
await page.waitForLoadState("networkidle")
await page.screenshot({ path: `${dir}/admin.png` })

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await mobile.goto(`${base}/demo`)
await mobile.getByText("Read-only preview").first().waitFor()
await mobile.waitForLoadState("networkidle")
await mobile.screenshot({ path: `${dir}/demo-mobile.png` })

await browser.close()
console.log("screenshots written to", dir)
