import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../i18n';
import type { ObjectDescriptor } from '../types';
import { NODE_ICONS } from './ObjectNode';

const MAX_RESULTS = 8;

/** Text that describes an object besides its name (host, IP, ports, version). */
function details(d: ObjectDescriptor): string {
  const parts = [d.service?.parent_name, d.primary_ip, d.subtitle, d.application?.version];
  return parts.filter(Boolean).join(' · ');
}

/**
 * Objects on the canvas that match the query, best first: name starts with the query, then name contains it, then
 * host, IP, ports or other details contain it. Every word of the query must match.
 */
export function searchObjects(objects: ObjectDescriptor[], query: string, limit = MAX_RESULTS): ObjectDescriptor[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { d: ObjectDescriptor; score: number }[] = [];
  for (const d of objects) {
    const name = d.name.toLowerCase();
    const all = `${name} ${details(d).toLowerCase()}`;
    if (!words.every((w) => all.includes(w))) continue;
    const score = name.startsWith(words[0]) ? 0 : words.every((w) => name.includes(w)) ? 1 : 2;
    scored.push({ d, score });
  }
  scored.sort((a, b) => a.score - b.score || a.d.name.localeCompare(b.d.name));
  return scored.slice(0, limit).map((s) => s.d);
}

interface Props {
  objects: ObjectDescriptor[];
  onPick: (key: string) => void;
}

/** Small search field in the toolbar: find an object on the canvas and jump to it. */
export function CanvasSearch({ objects, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchObjects(objects, query), [objects, query]);

  const pick = (d: ObjectDescriptor) => {
    onPick(d.key);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (results.length) {
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((i) => (i + step + results.length) % results.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[active] ?? results[0];
      if (hit) pick(hit);
    } else if (e.key === 'Escape') {
      if (query) setQuery('');
      else inputRef.current?.blur();
      setOpen(false);
    }
  };

  return (
    <div className="nsc-search" role="search">
      <i className="mdi mdi-magnify nsc-search-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        className="form-control form-control-sm"
        placeholder={t('Find on canvas…')}
        aria-label={t('Find on canvas')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open && query.trim() && (
        <ul className="nsc-search-results" role="listbox">
          {results.length === 0 && <li className="nsc-search-empty">{t('No matches on this canvas')}</li>}
          {results.map((d, i) => (
            <li
              key={d.key}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              // mousedown instead of click: the input's blur would close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                pick(d);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <i className={`mdi ${d.application?.icon || NODE_ICONS[d.type] || 'mdi-shape-outline'}`} />
              <span className="nsc-search-name">{d.name}</span>
              <span className="nsc-search-detail">{details(d)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
