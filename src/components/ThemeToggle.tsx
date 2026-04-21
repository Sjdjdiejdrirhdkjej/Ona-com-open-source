'use client';

import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark' | 'system';

function applyMode(mode: Mode) {
  if (mode === 'system') {
    try {
      localStorage.removeItem('theme');
    } catch {}
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefersDark);
  } else {
    try {
      localStorage.setItem('theme', mode);
    } catch {}
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }
}

function readMode(): Mode {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return 'system';
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>('system');

  useEffect(() => {
    setMode(readMode());
    setMounted(true);
  }, []);

  function cycle() {
    const next: Mode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    setMode(next);
    applyMode(next);
  }

  const label = mode === 'system' ? 'Theme: system (click to switch to light)' : mode === 'light' ? 'Theme: light (click to switch to dark)' : 'Theme: dark (click to follow system)';

  return (
    <button
      onClick={cycle}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/8"
    >
      {mounted
        ? mode === 'dark'
          ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            )
          : mode === 'light'
            ? (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M7.5 1a6.5 6.5 0 000 13 6.5 6.5 0 000-13zm0 0a4.5 4.5 0 010 9A4.5 4.5 0 010 7.5 6.497 6.497 0 007.5 1z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )
            : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M5.5 14h5M8 11.5V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              )
        : null}
    </button>
  );
}
