// Drag a vertical divider to resize a target pane within a container.
// Owns the pointer geometry and the min-pane clamp that previously lived in main.ts.
//
// Uses Pointer Events so mouse and touch drags share one path. touch-action: none
// (set in style.css) prevents the browser from hijacking the gesture to scroll.

const MIN_PANE_PX = 200;

export function createDividerResizer(
  divider: HTMLElement,
  container: HTMLElement,
  target: HTMLElement,
) {
  let dragging = false;

  divider.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dragging = true;
    divider.setPointerCapture(e.pointerId);
    divider.classList.add("dragging");
  });

  divider.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const rect = container.getBoundingClientRect();
    const divW = divider.offsetWidth;
    let px = e.clientX - rect.left - divW / 2;
    px = Math.max(MIN_PANE_PX, Math.min(rect.width - divW - MIN_PANE_PX, px));
    target.style.width = px + "px";
    target.style.flex = "none";
  });

  divider.addEventListener("pointerup", () => {
    if (dragging) {
      dragging = false;
      divider.classList.remove("dragging");
    }
  });

  divider.addEventListener("pointercancel", () => {
    if (dragging) {
      dragging = false;
      divider.classList.remove("dragging");
    }
  });
}
