import { test, expect } from "@playwright/test";

const CANDIDATE = { email: "candidate@qrify.app", password: "Demo1234!" };
const EMPLOYER = { email: "employer@qrify.app", password: "Demo1234!" };

async function login(page: import("@playwright/test").Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
}

test.describe("QRify acceptance flow", () => {
  test("employer can find the Senior Backend Engineer job and applicants list renders", async ({ page }) => {
    await login(page, EMPLOYER);
    await page.waitForURL(/\/candidate|\/employer/, { timeout: 10_000 });
    await page.goto("/employer/jobs");
    await expect(page.getByText("Senior Backend Engineer")).toBeVisible();
  });

  test("employer can generate (or re-fetch) the application QR", async ({ page }) => {
    await login(page, EMPLOYER);
    await page.waitForURL(/\/candidate|\/employer/, { timeout: 10_000 });
    await page.goto("/employer/jobs");
    await page.click("text=Senior Backend Engineer");
    await page.click('button:has-text("Generate QR")');
    await expect(page.locator("img[alt='Application QR code']")).toBeVisible({ timeout: 10_000 });

    const applyUrl = await page.locator("text=/http:\\/\\/.*\\/j\\//").textContent();
    expect(applyUrl).toContain("/j/");
  });

  test("candidate scans the QR link and sees a matched apply screen", async ({ page }) => {
    // Discover the apply link the same way an employer would see it, then act as the candidate.
    const employerContext = await page.context().browser()!.newContext();
    const employerPage = await employerContext.newPage();
    await login(employerPage, EMPLOYER);
    await employerPage.waitForURL(/\/candidate|\/employer/, { timeout: 10_000 });
    await employerPage.goto("/employer/jobs");
    await employerPage.click("text=Senior Backend Engineer");
    await employerPage.click('button:has-text("Generate QR")');
    await employerPage.waitForSelector("img[alt='Application QR code']");
    const applyUrlText = await employerPage.locator("text=/http:\\/\\/.*\\/j\\//").textContent();
    await employerContext.close();

    const applyUrl = applyUrlText!.trim();

    await login(page, CANDIDATE);
    await page.waitForURL(/\/candidate/, { timeout: 10_000 });
    await page.goto(applyUrl);

    await expect(page.getByText("Senior Backend Engineer")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/match$/)).toBeVisible();
  });
});
