import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "lanecove-color-theme";
const DENSITY_KEY = "lanecove-table-density";

export function initializeTheme() {
  let savedTheme = null;
  let savedDensity = null;
  try {
    savedTheme = window.localStorage.getItem(THEME_KEY);
    savedDensity = window.localStorage.getItem(DENSITY_KEY);
  } catch { /* browser storage may be disabled */ }
  const systemDark = Boolean(window.matchMedia?.("(prefers-color-scheme: dark)")?.matches);
  const theme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme : (systemDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.density = savedDensity === "compact" ? "compact" : "comfortable";
  return theme;
}

export function changeTheme(theme) {
  if (theme !== "light" && theme !== "dark") return;
  document.documentElement.dataset.theme = theme;
  try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* session-only */ }
  window.dispatchEvent(new Event("lanecove-theme-change"));
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.dataset.theme || "light");
    window.addEventListener("lanecove-theme-change", sync);
    return () => window.removeEventListener("lanecove-theme-change", sync);
  }, []);
  const isDark = theme === "dark";
  return (
    <button type="button" className="theme-switch" onClick={() => changeTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={isDark}>
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
