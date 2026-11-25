import { useEffect, useState } from 'react';
import type { BriefObject } from '../api';
import { useEditor } from '../context';
import { t } from '../i18n';

export interface PickerType {
  label: string; // "app.model"
  title: string;
  icon?: string;
}

export interface Picked {
  label: string;
  id: number | null;
  display?: string;
}

function useSearch(label: string, q: string, limit = 50) {
  const { api } = useEditor();
  const [results, setResults] = useState<BriefObject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api.searchAny(label, q, limit)
        .then((data) => {
          if (!cancelled) {
            setResults(data.results);
            setError(null);
          }
        })
        .catch((e: Error) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, label, q, limit]);

  return { results, error, loading };
}

function TypeSwitch({ types, value, onChange, idPrefix }: {
  types: PickerType[];
  value: string;
  onChange: (label: string) => void;
  idPrefix: string;
}) {
  if (types.length <= 1) return null;
  if (types.length <= 4) {
    return (
      <div className="nsc-segmented mb-2" role="tablist">
        {types.map((ty) => (
          <button
            key={ty.label}
            type="button"
            role="tab"
            aria-selected={value === ty.label}
            className={value === ty.label ? 'active' : ''}
            onClick={() => onChange(ty.label)}
          >
            {ty.icon && <i className={`mdi ${ty.icon}`} />} {t(ty.title)}
          </button>
        ))}
      </div>
    );
  }
  return (
    <select
      id={`${idPrefix}-type`}
      className="form-select mb-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {types.map((ty) => (
        <option key={ty.label} value={ty.label}>{t(ty.title)}</option>
      ))}
    </select>
  );
}

function SearchInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="nsc-search mb-2">
      <i className="mdi mdi-magnify" />
      <input
        id={id}
        type="search"
        className="form-control"
        placeholder={t('Search…')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface Props {
  types: PickerType[];
  value: Picked;
  onChange: (value: Picked) => void;
  idPrefix: string;
  /** Compact variant for narrow side panels. */
  compact?: boolean;
}

/**
 * Object type switch plus a searchable, clickable result list, backed by the NetBox REST API (no CDN, no select2).
 */
export function ObjectPicker({ types, value, onChange, idPrefix, compact }: Props) {
  const [q, setQ] = useState('');
  const { results, error, loading } = useSearch(value.label, q);

  return (
    <div className={`nsc-picker${compact ? ' compact' : ''}`}>
      <TypeSwitch
        types={types}
        value={value.label}
        idPrefix={idPrefix}
        onChange={(label) => {
          setQ('');
          onChange({ label, id: null });
        }}
      />
      <SearchInput id={`${idPrefix}-search`} value={q} onChange={setQ} />
      <div className="nsc-picker-list" role="listbox" id={`${idPrefix}-object`}>
        {results.map((r) => (
          <button
            key={r.id}
            type="button"
            role="option"
            aria-selected={value.id === r.id}
            className={`nsc-picker-item${value.id === r.id ? ' active' : ''}`}
            onClick={() => onChange({ label: value.label, id: r.id, display: r.display })}
          >
            <span className="text-truncate">{r.display}</span>
            {value.id === r.id && <i className="mdi mdi-check" />}
          </button>
        ))}
        {!loading && !error && results.length === 0 && <div className="nsc-picker-empty">{t('No results')}</div>}
        {error && <div className="nsc-picker-empty text-danger">{error}</div>}
      </div>
    </div>
  );
}

interface MultiProps {
  label: string;
  value: Array<{ id: number; display: string }>;
  onChange: (value: Array<{ id: number; display: string }>) => void;
  idPrefix: string;
}

/** Searchable multi-selection of objects of one type (selected items are shown as removable chips). */
export function MultiObjectPicker({ label, value, onChange, idPrefix }: MultiProps) {
  const [q, setQ] = useState('');
  const { results, error, loading } = useSearch(label, q);
  const selected = new Set(value.map((v) => v.id));

  const toggle = (item: { id: number; display: string }) => {
    onChange(selected.has(item.id) ? value.filter((v) => v.id !== item.id) : [...value, item]);
  };

  return (
    <div className="nsc-picker">
      {value.length > 0 && (
        <div className="nsc-chips mb-2">
          {value.map((v) => (
            <span key={v.id} className="nsc-chip">
              {v.display}
              <button type="button" aria-label={t('Remove {name}', { name: v.display })} onClick={() => toggle(v)}>
                <i className="mdi mdi-close" />
              </button>
            </span>
          ))}
        </div>
      )}
      <SearchInput id={`${idPrefix}-search`} value={q} onChange={setQ} />
      <div className="nsc-picker-list" role="listbox" aria-multiselectable="true">
        {results.map((r) => (
          <button
            key={r.id}
            type="button"
            role="option"
            aria-selected={selected.has(r.id)}
            className={`nsc-picker-item${selected.has(r.id) ? ' active' : ''}`}
            onClick={() => toggle({ id: r.id, display: r.display })}
          >
            <i className={`mdi ${selected.has(r.id) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'}`} />
            <span className="text-truncate flex-grow-1">{r.display}</span>
          </button>
        ))}
        {!loading && !error && results.length === 0 && <div className="nsc-picker-empty">{t('No results')}</div>}
        {error && <div className="nsc-picker-empty text-danger">{error}</div>}
      </div>
    </div>
  );
}
