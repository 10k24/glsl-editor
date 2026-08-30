import type { Page } from "@playwright/test";

// Shared E2E helpers and timing constants for the GLSL editor tests.

export const EDITOR = ".cm-content";

// ── Timing constants ──────────────────────────────────────────────────────────
// Reflect production debounce/encode timings in main.ts. Named here so E2E tests
// don't sprinkle unexplained magic numbers and so intent is explicit.
//
// Autosave debounces 280ms; then the share-URL encode runs (async, may compress).
// 1000ms gives both room to finish under parallel-worker load.
export const DEBOUNCE_AND_ENCODE_MS = 1000;

// CM6 history() composes adjacent full-document changes within its newGroupDelay
// (500ms) into a single cancellable group. If "type" and "reset" land inside that
// window their inverted changes compose to a no-op, so a later undo can't restore
// the typed text. Wait longer than the delay to force separate history groups.
export const HISTORY_GROUP_GAP_MS = 600;

// Wait for CM6 to apply a programmatically dispatched undo/redo before asserting.
export const CM_COMMAND_SETTLE_MS = 100;

// ── Editor helpers ────────────────────────────────────────────────────────────
/** Select all content, then replace it with the given text (single CM6 history group). */
export async function setContent(page: Page, text: string) {
  await page.click(EDITOR);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
}

// CM6's history() activates on `beforeinput` events that headless Chromium doesn't
// emit for synthetic keyboard input, so real ControlOrMeta+z can't drive undo in E2E.
// The app exposes the undo/redo commands on window (see src/global.d.ts) purely for
// tests; call those directly. This verifies history recording/replay, not the
// Mod-z keybinding.
export async function cmUndo(page: Page) {
  await page.evaluate(() => window.__cmUndo());
  await page.waitForTimeout(CM_COMMAND_SETTLE_MS);
}

export async function cmRedo(page: Page) {
  await page.evaluate(() => window.__cmRedo());
  await page.waitForTimeout(CM_COMMAND_SETTLE_MS);
}
