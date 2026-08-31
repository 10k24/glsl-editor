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
  // Seed a distinctive saved doc and inspect it in this (receiver) context.
  await page.goto("/");
  await setContent(page, "// context A work");
  await page.waitForTimeout(DEBOUNCE_AND_ENCODE_MS);

  const saved = await page.evaluate(() => localStorage.getItem("glsl-editor.doc"));
  expect(saved).toContain("// context A work");

  // Produce a share URL for a DIFFERENT doc from a separate context, so importing
  // it into the receiver would be observable if it clobbered saved storage.
  const src = await browser.newContext();
  const p = await src.newPage();
  await p.goto("/");
  await setContent(p, "// shared shader");
  await p.waitForTimeout(DEBOUNCE_AND_ENCODE_MS);
  const url = p.url();
  await src.close();
  expect(url).toContain("#s=");

  // Open the shared link in a fresh page of the SAME context (shares origin +
  // localStorage with the receiver) so the import runs against the seeded value.
  const p2 = await page.context().newPage();
  await p2.goto(url);
  await expect(p2.locator(EDITOR)).toContainText("// shared shader");

  // The imported doc is shown, but the pre-existing saved value is untouched.
  const after = await p2.evaluate(() => localStorage.getItem("glsl-editor.doc"));
  expect(after).toBe(saved);
});

test("persisted non-default doc seeds share hash on load", async ({ page }) => {
  // A saved custom doc must produce an immediately shareable URL at boot, before
  // the first edit — the regression behind "clicking share generates no URL".
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("glsl-editor.doc", "// saved custom"));
  await page.reload();

  await expect(page.locator(EDITOR)).toContainText("// saved custom");
  await expect.poll(() => page.evaluate(() => location.hash)).toContain("#s=");
});

test("default shader on fresh load leaves share hash empty", async ({ page }) => {
  // Stock default content must not clutter the URL with a share hash.
  await page.goto("/");
  await expect(page.locator(EDITOR)).toContainText("u_time");
  await page.waitForTimeout(DEBOUNCE_AND_ENCODE_MS);
  expect(await page.evaluate(() => location.hash)).toBe("");
});
