import { expect, test } from "@playwright/test";
import { DEBOUNCE_AND_ENCODE_MS, EDITOR, setContent } from "./helpers";

test("typed shader persists after reload", async ({ page }) => {
  await page.goto("/");
  const cm = page.locator(EDITOR);
  await setContent(page, "// persisted code");
  await expect(cm).toContainText("// persisted code");

  await page.waitForTimeout(DEBOUNCE_AND_ENCODE_MS);
  await page.reload();
  await expect(cm).toContainText("// persisted code");
});
