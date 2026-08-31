import { expect, test } from "@playwright/test";
import { setContent } from "./helpers";

test("invalid GLSL triggers compile error overlay; fixing clears it", async ({ page }) => {
  await page.goto("/");
  await setContent(page, "vec3 broken = ;");

  await expect(page.locator("#status-err")).toBeVisible({ timeout: 3000 });
  await expect(page.locator("#error-overlay")).toBeVisible();

  // fix it — replace with valid shader
  await setContent(page, "void main() { gl_FragColor = vec4(1.0); }");
  await page.waitForTimeout(400); // debounce

  await expect(page.locator("#status-ok")).toBeVisible({ timeout: 3000 });
  await expect(page.locator("#error-overlay")).toBeHidden();
});
