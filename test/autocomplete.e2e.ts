import { expect, test } from "@playwright/test";
import { EDITOR, setContent } from "./helpers";

// CodeMirror renders the completion menu as a listbox whose options each carry
// the completion text. Use ARIA roles for robustness.
function menu(page: import("@playwright/test").Page) {
  return page.getByRole("listbox", { name: "Completions" });
}

// The completion label only, not the trailing detail/signature.
async function menuOptionLabels(page: import("@playwright/test").Page): Promise<string[]> {
  return menu(page).getByRole("option").locator(".cm-completionLabel").allTextContents();
}

const fullMenuTexts = (page: import("@playwright/test").Page) =>
  menu(page).getByRole("option").allTextContents();

// Select a completion by clicking its option. (Enter-to-accept is intentionally
// suppressed by CodeMirror for `interactionDelay` (default 75 ms) after a menu
// opens, so an instant Enter drops the accept and inserts a newline. Clicking
// calls applyCompletion directly, bypassing that gate, and is deterministic.)
async function clickOption(page: import("@playwright/test").Page, label: string) {
  await expect(menu(page).getByRole("option", { name: label })).toBeVisible();
  await menu(page).getByRole("option", { name: label }).click();
}

// Autocomplete defaults on; toggle via the checkbox so completion sources run
// (or don't) as the test expects.
async function setAutocomplete(page: import("@playwright/test").Page, on: boolean) {
  const cb = page.locator("#ac-checkbox");
  if ((await cb.isChecked()) !== on) {
    if (on) {
      await cb.check();
    } else {
      await cb.uncheck();
    }
  }
}

test("typing . after a declared vec4 offers swizzle members", async ({ page }) => {
  await page.goto("/");
  await setAutocomplete(page, true);
  await setContent(page, "vec4 color = vec4(1.0);\n");
  await page.keyboard.type("color.");
  await expect(menu(page)).toBeVisible();
  const options = await menuOptionLabels(page);
  for (const c of ["x", "y", "z", "w", "r", "g", "b", "a", "s", "t", "p", "q"]) {
    expect(options).toContain("." + c);
  }
  // Each swizzle member also surfaces a readable context hint in the popup.
  const all = await fullMenuTexts(page);
  for (const c of ["component", "channel", "texture coord"]) {
    expect(all.some((o) => o.endsWith(c))).toBe(true);
  }
});

test("accepting a swizzle member inserts it without doubling the dot", async ({ page }) => {
  await page.goto("/");
  await setAutocomplete(page, true);
  await setContent(page, "vec4 color = vec4(1.0);\n");
  await page.keyboard.type("color.");
  await expect(menu(page)).toBeVisible();
  // Click the first swizzle option (`.x`); it must apply just the char, so the
  // result is `color.x` — never a double dot.
  await clickOption(page, ".x");
  await expect(page.locator(EDITOR)).toContainText("color.x");
  expect(await page.locator(EDITOR).textContent()).not.toContain("..");
});

test("typing [ after a declared matrix offers and applies a bracket skeleton", async ({ page }) => {
  await page.goto("/");
  await setAutocomplete(page, true);
  await setContent(page, "mat3 m;\n");
  await page.keyboard.type("m[");
  await expect(menu(page)).toBeVisible();
  const labels = await menuOptionLabels(page);
  expect(labels).toContain("[row][col]");
  await clickOption(page, "[row][col]");
  await expect(page.locator(EDITOR)).toContainText("m[0][0]");
});

test("typing a type word lists the bare keyword and a constructor option", async ({ page }) => {
  await page.goto("/");
  await setAutocomplete(page, true);
  await page.click(EDITOR);
  await page.keyboard.type("vec3");
  await expect(menu(page)).toBeVisible();
  const labels = await menuOptionLabels(page);
  // The bare type keyword is offered...
  expect(labels).toContain("vec3");
  // ...alongside a snippet constructor.
  expect(labels.some((o) => o.startsWith("vec3"))).toBe(true);
  const all = await fullMenuTexts(page);
  expect(all.some((o) => o.includes("constructor"))).toBe(true);
});

test("typing [ after a vector does not offer dot-member completions", async ({ page }) => {
  await page.goto("/");
  await setAutocomplete(page, true);
  await setContent(page, "vec4 color;\n");
  await page.keyboard.type("color[");
  await page.waitForTimeout(200);
  // A swizzle char must never replace the `[` (which would yield `colorx`), so
  // no member menu opens for a vector in bracket context.
  await expect(menu(page)).toBeHidden();
});

// Move the cursor to a live-document offset, then clear any pending menu so a
// later `.`/word opens a fresh completion. Auto-indentation shifts offsets from
// the raw source, so offsets must be computed from the live document.
async function setCursor(page: import("@playwright/test").Page, pos: number) {
  await page.evaluate((p) => window.__cmSetCursor(p), pos);
  await page.keyboard.press("Escape");
}

// End offset of `needle` in the live editor document (after setContent's
// auto-indent), so cursor placement survives indentation shifts.
async function liveEndOffset(page: import("@playwright/test").Page, needle: string): Promise<number> {
  return page.evaluate((n) => {
    const doc = window.__cmGetDoc();
    const i = doc.indexOf(n);
    return i + n.length;
  }, needle);
}

test("same-name variable in another function does not shadow dot members", async ({ page }) => {
  await page.goto("/");
  await setAutocomplete(page, true);
  // `weight` is `float` in quads() but `vec2` in noise(). A `weight.` typed
  // inside noise() must resolve to the vec2 and offer swizzles — the later
  // `float weight` must not shadow it across functions.
  await setContent(
    page,
    "float quads() {\n" +
    "  float weight = 1.0;\n" +
    "  return weight;\n" +
    "}\n" +
    "void noise() {\n" +
    "  vec2 weight = smoothstep(0.0, 1.0, vec2(0.0));\n" +
    "  vec2 q = weight;\n" +
    "}\n"
  );
  // Place the cursor right after the `weight` token on the last line of noise().
  await setCursor(page, await liveEndOffset(page, "q = weight"));
  await page.keyboard.type(".");
  await expect(menu(page)).toBeVisible();
  const labels = await menuOptionLabels(page);
  expect(labels).toContain(".x");
  expect(labels).toContain(".y");
  await clickOption(page, ".x");
  await expect(page.locator(EDITOR)).toContainText("weight.x");
});

test("word completion offers an in-scope variable first", async ({ page }) => {
  await page.goto("/");
  await setAutocomplete(page, true);
  await setContent(
    page,
    "uniform vec2 u_resolution;\n" +
    "void main() {\n" +
    "  vec3 target = vec3(0.0);\n" +
    "  vec3 done;\n" +
    "}\n"
  );
  // Type on a fresh line inside main(), after the closing brace of the
  // `vec3 done;` declaration's line — so `t` starts a brand-new token.
  await setCursor(page, await liveEndOffset(page, "vec3 done;"));
  await page.keyboard.type("t");
  await expect(menu(page)).toBeVisible();
  // The in-scope variable is top priority, above any GLSL keyword/type.
  const labels = await menuOptionLabels(page);
  expect(labels[0]).toBe("target");
  await clickOption(page, "target");
  await expect(page.locator(EDITOR)).toContainText("target");
});

test("word completion does not offer an out-of-scope variable", async ({ page }) => {
  await page.goto("/");
  await setAutocomplete(page, true);
  await setContent(
    page,
    "float other() {\n" +
    "  vec4 hidden = vec4(1.0);\n" +
    "}\n" +
    "void main() {\n" +
    "  vec3 q = vec3(0.0);\n" +
    "}\n"
  );
  await setCursor(page, await liveEndOffset(page, "vec3 q = vec3(0.0);"));
  await page.keyboard.type("h");
  await page.waitForTimeout(300);
  // `hidden` lives only inside other(); it must not be suggested in main().
  expect((await fullMenuTexts(page)).some((o) => o.includes("hidden"))).toBe(false);
});

test("one-line function local resolves to vec2 for dot members", async ({ page }) => {
  await page.goto("/");
  await setAutocomplete(page, true);
  await setContent(
    page,
    "float square() {\n" +
    "  vec2 p = vec2(1.0);\n" +
    "  return p.x;\n" +
    "}\n" +
    "float other(float x) { vec3 p = vec3(x); return p.x; }\n" +
    "vec2 q = vec2(0.0);\n"
  );
  // Type `.` after the one-line function's local `p` (a vec3 inside other()).
  await setCursor(page, await liveEndOffset(page, "other(float x) { vec3 p"));
  await page.keyboard.type(".");
  await expect(menu(page)).toBeVisible();
  const labels = await menuOptionLabels(page);
  expect(labels).toContain(".z");
  // vec3 has no `.w` — the local's vec3 type must drive the members exactly.
  expect(labels).not.toContain(".w");
  // A one-line function's local must not leak out: q at file scope is the vec2,
  // but offer / resolve `q.` correctly at file scope too.
  await setCursor(page, await liveEndOffset(page, "vec2 q"));
  await page.keyboard.type(".");
  await expect(menu(page)).toBeVisible();
  const fileLabels = await menuOptionLabels(page);
  expect(fileLabels).toContain(".x");
  expect(fileLabels).toContain(".y");
  expect(fileLabels).not.toContain(".z");
});
