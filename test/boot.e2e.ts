import { expect, test } from "@playwright/test";
import { EDITOR } from "./helpers";

test("boots with default shader, canvas, and live status", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#canvas")).toBeVisible();
  await expect(page.locator("#status-ok")).toBeVisible();
  await expect(page.locator("#status-ok")).toContainText("Live");
  await expect(page.locator("#error-overlay")).toBeHidden();
  await expect(page.locator(EDITOR)).toContainText("u_time");
});

test("loads the 10k24 GA4 gtag snippet", async ({ page }) => {
  // The glsl editor shares the studio's GA4 property; keep the snippet present.
  await page.goto("/");
  await expect(page.locator("script[src*=\"googletagmanager.com/gtag/js?id=G-CPZFEJK5BG\"]")).toHaveCount(1);
  const hasConfig = await page.evaluate(() =>
    (window as { dataLayer?: Array<Array<string>> }).dataLayer?.some((e) => e[0] === "config" && e[1] === "G-CPZFEJK5BG") ?? false
  );
  expect(hasConfig).toBe(true);
});

test("autocomplete preference persists across reloads", async ({ page }) => {
  await page.goto("/");
  const cb = page.locator("#ac-checkbox");
  // New visitor defaults to autocomplete on.
  await expect(cb).toBeChecked();
  await cb.uncheck();
  await page.reload();
  await expect(cb).not.toBeChecked();
  await cb.check();
  await page.reload();
  await expect(cb).toBeChecked();
});
