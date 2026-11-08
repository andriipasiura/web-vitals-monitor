'use client';

import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY as STORAGE_KEY } from './theme-script';

export type ThemePreference = 'system' | 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function apply(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

function readStored(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function subscribe(listener: () => void): () => void {
  const media = matchMedia(DARK_QUERY);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    apply(readStored());
    notify();
  };
  listeners.add(listener);
  media.addEventListener('change', listener);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getPreference(): ThemePreference {
  const value = document.documentElement.getAttribute('data-theme');
  return value === 'light' || value === 'dark' ? value : 'system';
}

const getIsDark = () => {
  const preference = getPreference();
  return preference === 'system'
    ? matchMedia(DARK_QUERY).matches
    : preference === 'dark';
};

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {}
  apply(preference);
  notify();
}

export function useTheme() {
  const preference = useSyncExternalStore(
    subscribe,
    getPreference,
    () => 'system' as const,
  );
  const isDark = useSyncExternalStore(subscribe, getIsDark, () => false);
  return { preference, isDark };
}

export const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
