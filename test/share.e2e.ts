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

test("persisted non-default doc seeds share hash on load", async ({ browser }) => {
  // A saved custom doc must produce an immediately shareable URL at boot, before
  // the first edit — the regression behind "clicking share generates no URL".
  const ctx = await browser.newContext();
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("glsl-editor.doc", "// saved custom"));
  await page.reload();

  await expect(page.locator(EDITOR)).toContainText("// saved custom");

  // Share works immediately, before the async boot hash has necessarily landed —
  // the handler must build the URL from the doc, not trust location.href.
  await page.click("#share-btn");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("#s=");

  // The boot hash eventually appears in the address bar too.
  await expect.poll(() => page.evaluate(() => location.hash)).toContain("#s=");
});

test("opening a share link keeps a shareable URL (Share works immediately)", async ({ browser }) => {
  // Build a real share URL in a helper context.
  const src = await browser.newContext();
  const p = await src.newPage();
  await p.goto("/");
  await setContent(p, "// given hash link");
  await p.waitForTimeout(DEBOUNCE_AND_ENCODE_MS);
  const shareUrl = p.url();
  expect(shareUrl).toContain("#s=");
  await src.close();

  // Receiver: open the link, then Share immediately — the URL must keep a hash.
  const ctx = await browser.newContext();
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();
  await page.goto(shareUrl);
  await expect(page.locator(EDITOR)).toContainText("// given hash link");
  await page.click("#share-btn");
  await expect.poll(() =>
    page.evaluate(() => navigator.clipboard.readText())
  ).toContain("#s=");
});

test("default shader shares a clean URL and leaves hash empty", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page.locator(EDITOR)).toContainText("u_time");
  await page.waitForTimeout(DEBOUNCE_AND_ENCODE_MS);
  expect(await page.evaluate(() => location.hash)).toBe("");

  // Clicking Share on the default shader must yield a clean URL with no hash.
  const expected = await page.evaluate(() => location.origin + location.pathname);
  const ctx = await browser.newContext();
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const p = await ctx.newPage();
  await p.goto("/");
  await p.click("#share-btn");
  const copied = await p.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(expected);
  expect(copied).not.toContain("#");
});
