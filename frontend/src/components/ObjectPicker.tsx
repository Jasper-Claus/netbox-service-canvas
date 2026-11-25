import { useEffect, useState } from 'react';
import type { BriefObject } from '../api';
import { useEditor } from '../context';

export interface PickerType {
  label: string; // "app.model"
  title: string;
}

interface Props {
  types: PickerType[];
  value: { label: string; id: number | null };
  onChange: (value: { label: string; id: number | null; display?: string }) => void;
  idPrefix: string;
}

/**
 * Object type selector plus a searchable object list, backed by the NetBox REST API (no CDN, no select2).
 */
export function ObjectPicker({ types, value, onChange, idPrefix }: Props) {
  const { api } = useEditor();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<BriefObject[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api.searchAny(value.label, q, 50)
        .then((data) => {
          if (!cancelled) {
            setResults(data.results);
            setError(null);
          }
        })
        .catch((e: Error) => !cancelled && setError(e.message));
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, value.label, q]);

  return (
    <div className="nsc-picker">
      <select
        id={`${idPrefix}-type`}
        className="form-select form-select-sm mb-1"
        value={value.label}
        onChange={(e) => {
          setQ('');
          onChange({ label: e.target.value, id: null });
        }}
      >
        {types.map((t) => (
          <option key={t.label} value={t.label}>{t.title}</option>
        ))}
      </select>
      <input
        type="search"
        className="form-control form-control-sm mb-1"
        placeholder="Suchen…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        id={`${idPrefix}-object`}
        className="form-select form-select-sm"
        size={5}
        value={value.id ?? ''}
        onChange={(e) => {
          const id = Number(e.target.value);
          onChange({ label: value.label, id, display: results.find((r) => r.id === id)?.display });
        }}
      >
        {results.map((r) => (
          <option key={r.id} value={r.id}>{r.display}</option>
        ))}
      </select>
      {error && <div className="text-danger small">{error}</div>}
    </div>
  );
}
