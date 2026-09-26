export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_KEY = 'agents-hub-theme';

/** Inline, pre-hydration script: apply the stored choice (or the OS preference) before paint. */
export const themeInitScript = `(function(){try{var c=localStorage.getItem('${THEME_KEY}');var d=c==='dark'||((!c||c==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=c||'system';}catch(e){if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark');}})();`;

export function readThemeChoice(): ThemeChoice {
  try {
    const c = localStorage.getItem(THEME_KEY);
    return c === 'light' || c === 'dark' ? c : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* storage may be unavailable */
  }
  const dark =
    choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = choice;
}
