/**
 * Atom-LocalStore
 * LocalStorage 自動保存・復元
 * 設計: ../../../50_Mission/Mermaid Maker/Atom-LocalStore.md
 */

const STORAGE_KEY = 'mm-maker-text';

export function saveText(text: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, text);
    }
  } catch {
    // QuotaExceeded 等は無視
  }
}

export function loadText(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
  } catch {}
  return null;
}

export function clearText(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}
