import { expect, test } from "@playwright/test";

const exitOpacity = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.getElementById("exit-present-btn")!).opacity);

test("present hides chrome; exit button and Esc restore the editor", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#header")).toBeVisible();
  await expect(page.locator("#editor-pane")).toBeVisible();

  // Entering presentation hides all chrome; the exit button is hidden until activity.
  await page.click("#present-btn");
  await expect(page.locator("#header")).toBeHidden();
  await expect(page.locator("#editor-pane")).toBeHidden();
  await expect(page.locator("footer")).toBeHidden();
  await expect(page.locator("#canvas")).toBeVisible();
  await expect.poll(() => exitOpacity(page)).toBe("0");

  // Moving the mouse reveals it.
  await page.mouse.move(100, 100);
  await expect.poll(() => exitOpacity(page)).toBe("1");

  // A real click (pointerdown counts as activity) still works to exit.
  await page.click("#exit-present-btn", { force: true });
  await expect(page.locator("#header")).toBeVisible();
  await expect(page.locator("#editor-pane")).toBeVisible();
});

test("esc works without prior mouse move", async ({ page }) => {
  await page.goto("/");
  await page.click("#present-btn");
  await expect(page.locator("#editor-pane")).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(page.locator("#editor-pane")).toBeVisible();
});

test("exit button fades out after idle in presentation", async ({ page }) => {
  await page.goto("/");
  await page.click("#present-btn");
  await page.mouse.move(100, 100);
  await expect.poll(() => exitOpacity(page)).toBe("1");

  await page.waitForTimeout(3500);
  await expect.poll(() => exitOpacity(page)).toBe("0");
});

test("tap reveals exit button on a touchscreen", async ({ browser }) => {
  // touchscreen.tap needs a context with hasTouch enabled.
  const ctx = await browser.newContext({ hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.click("#present-btn");
  await expect.poll(() => exitOpacity(page)).toBe("0");

  await page.touchscreen.tap(50, 50);
  await expect.poll(() => exitOpacity(page)).toBe("1");
});
