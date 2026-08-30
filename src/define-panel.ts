import { parseDefineFlags } from "./glsl-preprocessor";

export { parseDefineFlags } from "./glsl-preprocessor";

export function createDefinePanel(
  container: HTMLElement,
  onToggle: (overrides: Map<string, boolean>) => void,
): ((src: string) => void) & { setOverrides: (next: Map<string, boolean>) => void } {
  const overrides = new Map<string, boolean>();

  function setOverrides(next: Map<string, boolean>) {
    overrides.clear();
    for (const [name, active] of next) overrides.set(name, active);
  }

  function render(flags: Array<{ name: string; active: boolean }>) {
    if (flags.length === 0) {
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    container.innerHTML = "";

    const label = document.createElement("span");
    label.id = "define-panel-label";
    label.textContent = "defines";
    container.appendChild(label);

    const list = document.createElement("div");
    list.id = "define-list";
    container.appendChild(list);

    for (const { name, active } of flags) {
      if (!overrides.has(name)) overrides.set(name, active);

      const row = document.createElement("label");
      row.className = "define-row";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = overrides.get(name)!;
      cb.addEventListener("change", () => {
        overrides.set(name, cb.checked);
        onToggle(new Map(overrides));
      });

      const nameEl = document.createElement("code");
      nameEl.textContent = name;

      row.appendChild(cb);
      row.appendChild(nameEl);
      list.appendChild(row);
    }
  }

  return Object.assign(function update(src: string) {
    const flags = parseDefineFlags(src);
    for (const name of overrides.keys()) {
      if (!flags.find(f => f.name === name)) overrides.delete(name);
    }
    render(flags);
  }, { setOverrides });
}
