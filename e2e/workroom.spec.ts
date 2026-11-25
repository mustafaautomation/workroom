import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("workroom-demo");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/w\//);
}

test("password sign-in and magic link reach the studio", async ({ page }) => {
  await signIn(page, "maya@northline.studio");
  await expect(page).toHaveURL(/\/w\/northline/);
  await expect(page.getByRole("heading", { name: "Welcome back, Maya Chen." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Atlas brand system" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email").fill("jordan@northline.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.getByRole("link", { name: "Sign in as jordan@northline.studio" }).click();
  await expect(page).toHaveURL(/\/w\/northline/);
  await expect(page.getByRole("heading", { name: "Welcome back, Jordan Hale." })).toBeVisible();
});

test("a client cannot see another agency's project", async ({ page }) => {
  await signIn(page, "priya@acmerobotics.com");
  await expect(page.getByRole("link", { name: "Atlas brand system" })).toBeVisible();
  await expect(page.getByText("Harbor site relaunch")).toHaveCount(0);
  await expect(page.getByText("Patient portal UX")).toHaveCount(0);

  await page.goto("/w/fieldnote/projects/prj_lumen_portal");
  await expect(page.getByRole("heading", { name: "That page is not on this workspace." })).toBeVisible();

  await page.goto("/w/northline/projects/prj_harbor_web");
  await expect(page.getByRole("heading", { name: "That page is not on this workspace." })).toBeVisible();

  await page.goto("/w/northline/projects/prj_acme_brand");
  await expect(page.getByRole("heading", { name: "Atlas brand system" })).toBeVisible();
});

test("a client approves a deliverable", async ({ page }) => {
  await signIn(page, "priya@acmerobotics.com");
  await page.getByRole("link", { name: "Atlas brand system" }).click();
  const card = page.getByRole("article").filter({ hasText: "Color and type" });
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card.getByText("Approved")).toBeVisible();
});

test("a client pays a test invoice", async ({ page }) => {
  await signIn(page, "priya@acmerobotics.com");
  await page.goto("/w/northline/invoices/inv_acme_identity");
  await page.getByRole("link", { name: /Review and pay/ }).click();
  await expect(page.getByText("4242 4242 4242 4242")).toBeVisible();
  await page.getByRole("button", { name: "Pay $4,800.00 with test card" }).click();
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NL-1042 is paid." })).toBeVisible();
});

test("the public demo is read-only", async ({ page }) => {
  await page.goto("/demo/projects/prj_acme_brand");
  await expect(page.getByText("Read-only preview")).toBeVisible();
  await page.getByRole("tab", { name: "Approvals" }).click();
  await expect(page.getByRole("button", { name: "Approve" }).first()).toBeDisabled();
  const response = await page.request.post("/api/deliverables/del_color/decision", {
    data: { decision: "approved" },
  });
  expect(response.status()).toBe(403);
  await page.reload();
  await page.getByRole("tab", { name: "Approvals" }).click();
  await expect(page.getByRole("article").filter({ hasText: "Color and type" }).getByText("Pending review")).toBeVisible();
});
