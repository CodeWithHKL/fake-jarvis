import { useSyncExternalStore } from "react";

/**
 * Theme helpers for the header switch.
 *
 * The source of truth is the `data-theme` attribute on <html>:
 *   - "light" or "dark": the user forced a theme (saved in localStorage)
 *   - missing:           follow the system, and the CSS media query decides
 */

export type Theme = "system" | "light" | "dark";

/** What the user picked: system, light or dark. */
export function getThemePreference(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

export function setThemePreference(next: Theme): void {
  // "system" = no data-theme attribute, so the CSS media query decides.
  if (next === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;
  try {
    if (next === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", next);
  } catch {}
}

/** Tell React when the attribute changes. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

// The server can't know the theme, so it renders "system"; React corrects it after hydration.
export function useThemePreference(): Theme {
  return useSyncExternalStore(subscribe, getThemePreference, () => "system");
}
