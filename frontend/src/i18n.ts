/**
 * Minimal translation layer for the editor.
 *
 * English is the source language: every UI text is written in English and passed through `t()`. Other languages
 * map the English text to a translation. Missing translations fall back to English. `{name}` placeholders are
 * replaced with the values passed in `vars`.
 *
 * The language follows the NetBox UI language of the user (passed in the editor config).
 */
import { DE } from './i18n.de';

export type Language = 'en' | 'de';

const DICTIONARIES: Record<Language, Record<string, string> | null> = { en: null, de: DE };

let current: Language = 'en';

export function setLanguage(code: string | undefined | null): Language {
  current = code && code.toLowerCase().startsWith('de') ? 'de' : 'en';
  if (typeof document !== 'undefined') document.documentElement.dataset.nscLang = current;
  return current;
}

export function getLanguage(): Language {
  return current;
}

/** BCP 47 locale for dates and numbers. */
export function locale(): string {
  return current === 'de' ? 'de-DE' : 'en-US';
}

export function t(text: string, vars?: Record<string, string | number>): string {
  const translated = DICTIONARIES[current]?.[text] ?? text;
  if (!vars) return translated;
  return translated.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
