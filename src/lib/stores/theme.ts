import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark' | 'system';

function createThemeStore() {
  const storedTheme = browser ? (localStorage.getItem('theme') as Theme) || 'system' : 'system';
  const { subscribe, set, update } = writable<Theme>(storedTheme);

  return {
    subscribe,
    set: (theme: Theme) => {
      if (browser) {
        localStorage.setItem('theme', theme);
        applyTheme(theme);
      }
      set(theme);
    },
    toggle: () => {
      update(theme => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        if (browser) {
          localStorage.setItem('theme', newTheme);
          applyTheme(newTheme);
        }
        return newTheme;
      });
    },
    init: () => {
      if (browser) {
        const theme = (localStorage.getItem('theme') as Theme) || 'system';
        applyTheme(theme);
        set(theme);
      }
    }
  };
}

function applyTheme(theme: Theme) {
  if (!browser) return;
  
  const root = document.documentElement;
  
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

export const theme = createThemeStore();

// Derived store for the actual theme (resolved system preference)
export const resolvedTheme = derived(theme, ($theme, set) => {
  if (!browser) {
    set('light');
    return;
  }

  if ($theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    set(prefersDark ? 'dark' : 'light');
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      set(e.matches ? 'dark' : 'light');
      applyTheme('system');
    };
    mediaQuery.addEventListener('change', handler);
    
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  } else {
    set($theme);
  }
});