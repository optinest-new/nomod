"use client";

type Theme = "light" | "dark";

const STORAGE_KEY = "nomod-theme";

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function readCurrentTheme(): Theme {
  const fromDataset = document.documentElement.dataset.theme;
  if (fromDataset === "dark" || fromDataset === "light") {
    return fromDataset;
  }

  const fromStorage = window.localStorage.getItem(STORAGE_KEY);
  if (fromStorage === "dark" || fromStorage === "light") {
    return fromStorage;
  }

  return "dark";
}

function SunIcon() {
  return (
    <svg className="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <path
        d="M12 2.5V5.2M12 18.8V21.5M21.5 12H18.8M5.2 12H2.5M18.7 5.3L16.8 7.2M7.2 16.8L5.3 18.7M18.7 18.7L16.8 16.8M7.2 7.2L5.3 5.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M14.5 3.2C10.2 4 7 7.8 7 12.3C7 17.3 11 21.3 16 21.3C18.6 21.3 21 20.2 22.6 18.5C16.8 18.9 12 14.2 12 8.4C12 6.4 12.6 4.6 13.7 3.1C14 3.1 14.2 3.1 14.5 3.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ThemeToggle() {
  function handleToggleTheme() {
    const currentTheme = readCurrentTheme();
    const nextTheme: Theme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleToggleTheme}
      aria-label="Toggle color theme"
      title="Toggle color theme"
    >
      <span className="theme-icon-stack" aria-hidden="true">
        <SunIcon />
        <MoonIcon />
      </span>
    </button>
  );
}
