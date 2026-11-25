import { afterEach, describe, expect, it } from 'vitest';
import { APPLICATION_STATUSES, DIRECTIONS, HOP_TYPES, STATUSES } from './choices';
import { getLanguage, setLanguage, t } from './i18n';
import { DE } from './i18n.de';

/** Raw source of every module of the editor (tests excluded). */
const SOURCES = import.meta.glob<string>(['./**/*.ts', './**/*.tsx', '!./**/*.test.ts'], {
  query: '?raw', import: 'default', eager: true,
});

/** Every literal text passed to t('…') in the source code. */
function literalTexts(): string[] {
  const texts = new Set<string>();
  for (const src of Object.values(SOURCES)) {
    for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) texts.add(m[1].replace(/\\(.)/g, '$1'));
  }
  return [...texts];
}

describe('i18n', () => {
  afterEach(() => setLanguage('en'));

  it('defaults to English and follows the NetBox language', () => {
    expect(setLanguage(undefined)).toBe('en');
    expect(setLanguage('de-at')).toBe('de');
    expect(getLanguage()).toBe('de');
    expect(setLanguage('fr')).toBe('en');
  });

  it('translates, interpolates and falls back to English', () => {
    setLanguage('de');
    expect(t('Remove')).toBe('Entfernen');
    expect(t('{service} now runs on {host}.', { service: 'grafana', host: 'nas' })).toBe('grafana läuft jetzt auf nas.');
    expect(t('Not translated yet')).toBe('Not translated yet');
    setLanguage('en');
    expect(t('{count} object(s) added.', { count: 3 })).toBe('3 object(s) added.');
  });

  it('has a German text for every t() call in the source code', () => {
    const texts = literalTexts();
    expect(texts.length).toBeGreaterThan(100);
    expect(texts.filter((text) => !(text in DE))).toEqual([]);
  });

  it('has a German text for every choice label rendered with t()', () => {
    const labels = [
      ...APPLICATION_STATUSES, ...STATUSES, ...DIRECTIONS,
    ].map(([, label]) => label).concat(HOP_TYPES.map((h) => h.title));
    expect(labels.filter((label) => !(label in DE))).toEqual([]);
  });
});
