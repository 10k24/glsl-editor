// DOM helpers.
// `hidden` is a global utility class (defined in style.css) that toggles
// display — kept here as a single source of truth for that class name.

export function toggleHidden(el: HTMLElement, on: boolean) {
  el.classList.toggle("hidden", on);
}
