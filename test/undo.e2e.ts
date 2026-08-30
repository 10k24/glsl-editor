import { expect, test } from "@playwright/test";
import { EDITOR, cmRedo, cmUndo, HISTORY_GROUP_GAP_MS, setContent } from "./helpers";

test("undo command reverts typed edit; redo restores it", async ({ page }) => {
  await page.goto("/");
  const cm = page.locator(EDITOR);
  await setContent(page, "// my edit");
  await expect(cm).toContainText("// my edit");

  await cmUndo(page);
  await expect(cm).toContainText("u_time");
  await expect(cm).not.toContainText("// my edit");

  await cmRedo(page);
  await expect(cm).toContainText("// my edit");
});

test("after reset, undo command restores prior user code", async ({ page }) => {
  await page.goto("/");
  const cm = page.locator(EDITOR);
  await setContent(page, "// user work");

  // Force a separate history group so reset and type don't compose to a no-op.
  await page.waitForTimeout(HISTORY_GROUP_GAP_MS);

  await page.locator("#reset-btn").click();
  await expect(cm).toContainText("u_time");
  await expect(cm).not.toContainText("// user work");

  await cmUndo(page);
  await expect(cm).toContainText("// user work");
});
