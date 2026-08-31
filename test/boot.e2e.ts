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
