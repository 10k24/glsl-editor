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
  await page.keyboard.press("Enter"); // accept the highlighted (first) option
  await expect(page.locator(EDITOR)).toContainText("color.");
  // The accepted member must not produce a double dot (e.g. `color..x`).
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
  await page.keyboard.press("Enter");
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
