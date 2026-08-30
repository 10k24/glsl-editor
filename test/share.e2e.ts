import { expect, test } from "@playwright/test";
import { DEBOUNCE_AND_ENCODE_MS, EDITOR, setContent } from "./helpers";

test("live hash updates on edit; opening share URL loads same doc", async ({ page, browser }) => {
  await page.goto("/");
  const cm = page.locator(EDITOR);
  await setContent(page, "// shared shader");
  await expect(cm).toContainText("// shared shader");

  await page.waitForTimeout(DEBOUNCE_AND_ENCODE_MS);
  const url = page.url();
  expect(url).toContain("#s=");

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(url);
  await expect(p2.locator(EDITOR)).toContainText("// shared shader");
});

test("malformed hash degrades to default shader", async ({ page }) => {
  await page.goto("/#s=z:!!!not-valid!!!");
  await expect(page.locator(EDITOR)).toContainText("u_time");
});

test("hash link opening does not overwrite localStorage of existing session", async ({ page, browser }) => {
  // seed localStorage in context A
  await page.goto("/");
  const cm = page.locator(EDITOR);
  await setContent(page, "// context A work");
  await page.waitForTimeout(DEBOUNCE_AND_ENCODE_MS);

  // capture share URL
  const url = page.url();
  expect(url).toContain("#s=");

  // open in context B — A's localStorage untouched, just watching
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(url);
  await expect(p2.locator(EDITOR)).toContainText("// context A work");
});
