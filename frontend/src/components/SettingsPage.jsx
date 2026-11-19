import { useEffect, useState } from "react";
import { Check, Moon, Sun, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { changeTheme } from "../ThemeToggle.jsx";

const DENSITY_KEY = "lanecove-table-density";
const THEMES = [
  { id: "light", name: "Light mode", help: "Bright panels with blue highlights", icon: Sun },
  { id: "dark", name: "Dark mode", help: "Navy panels with cyan highlights", icon: Moon }
];

function currentDensity() {
  return document.documentElement.dataset.density === "compact" ? "compact" : "comfortable";
}

export default function SettingsPage() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const [density, setDensity] = useState(currentDensity);

  useEffect(() => {
    function sync() { setTheme(document.documentElement.dataset.theme || "light"); }
    window.addEventListener("lanecove-theme-change", sync);
    return () => window.removeEventListener("lanecove-theme-change", sync);
  }, []);

  function selectTheme(value) {
    changeTheme(value);
    setTheme(value);
  }

  function selectDensity(value) {
    document.documentElement.dataset.density = value;
    setDensity(value);
    try { window.localStorage.setItem(DENSITY_KEY, value); } catch { /* Session-only if storage disabled */ }
  }

  return (
    <div className="lc-settings-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORKSPACE PREFERENCES</div>
          <h1>Settings</h1>
          <p>Make LaneCove comfortable for the way you work.</p>
        </div>
      </div>

      <section className="lc-settings-section">
        <div className="lc-settings-title"><Sun size={20} /><div><h2>Appearance</h2><p>Choose your preferred dashboard theme.</p></div></div>
        <div className="lc-theme-choices">
          {THEMES.map(({ id, name, help, icon: Icon }) => (
            <button key={id} type="button" onClick={() => selectTheme(id)}
              className={`lc-theme-choice ${theme === id ? "is-selected" : ""}`}
              aria-pressed={theme === id}>
              <span className={`lc-theme-preview ${id}`}><Icon size={21} /></span>
              <span className="lc-theme-description"><strong>{name}</strong><small>{help}</small></span>
              {theme === id && <Check size={20} className="lc-selected-icon" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <p className="lc-settings-hint">Your choice is saved on this device and used next time you open LaneCove.</p>
      </section>

      <section className="lc-settings-section">
        <div className="lc-settings-title"><SlidersHorizontal size={20} /><div><h2>Table spacing</h2><p>Choose how much information fits on screen.</p></div></div>
        <div className="lc-density-controls" role="group" aria-label="Table spacing">
          <button type="button" aria-pressed={density === "comfortable"} className={density === "comfortable" ? "is-selected" : ""} onClick={() => selectDensity("comfortable")}>Comfortable</button>
          <button type="button" aria-pressed={density === "compact"} className={density === "compact" ? "is-selected" : ""} onClick={() => selectDensity("compact")}>Compact</button>
        </div>
      </section>

      <section className="lc-settings-section lc-settings-info">
        <div className="lc-settings-title"><ShieldCheck size={20} /><div><h2>Data & privacy</h2><p>How LaneCove handles carrier information.</p></div></div>
        <p>Carrier records, outreach notes and accounts are saved in the PostgreSQL database configured for this installation. LaneCove does not automatically publish that data.</p>
        <p>Public email search is optional. Suggested addresses must be reviewed before being saved to a carrier record.</p>
      </section>
    </div>
  );
}
