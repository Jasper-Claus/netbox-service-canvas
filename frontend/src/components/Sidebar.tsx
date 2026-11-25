import { useEffect, useState } from 'react';
import type { BriefObject } from '../api';
import { useEditor } from '../context';
import { makeKey } from '../graph';

export const DRAG_MIME = 'application/x-nsc-object-key';

const TYPES: Array<{ label: string; title: string; icon: string }> = [
  { label: 'dcim.device', title: 'Devices', icon: 'mdi-server' },
  { label: 'virtualization.virtualmachine', title: 'VMs', icon: 'mdi-monitor' },
  { label: 'ipam.service', title: 'Services', icon: 'mdi-cog-outline' },
];

interface Props {
  placed: Set<string>;
  onAdd: (key: string) => void;
  onNewService: () => void;
  canEdit: boolean;
}

type Result = BriefObject & { parent?: { display?: string } | null; protocol?: { label?: string }; ports?: number[] };

export function Sidebar({ placed, onAdd, onNewService, canEdit }: Props) {
  const { api, perms } = useEditor();
  const [type, setType] = useState(TYPES[0].label);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      // Services are loaded in full representation to show their parent
      api.search(type, q, 30, type === 'ipam.service' ? { brief: undefined } : {})
        .then((data) => {
          if (cancelled) return;
          setResults(data.results as Result[]);
          setCount(data.count);
          setError(null);
        })
        .catch((e: Error) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, type, q]);

  return (
    <aside className="nsc-sidebar">
      <div className="nsc-sidebar-head">
        <div className="btn-group w-100 mb-2" role="group">
          {TYPES.map((t) => (
            <button
              key={t.label}
              type="button"
              className={`btn btn-sm ${type === t.label ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setType(t.label)}
            >
              <i className={`mdi ${t.icon}`} /> {t.title}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="form-control form-control-sm"
          placeholder="Suchen…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {canEdit && <div className="form-text">In den Canvas ziehen oder mit + hinzufügen.</div>}
      </div>
      <div className="nsc-sidebar-list">
        {error && <div className="text-danger small p-2">{error}</div>}
        {!error && !loading && results.length === 0 && <div className="text-muted small p-2">Keine Treffer</div>}
        {results.map((r) => {
          const key = makeKey(type, r.id);
          const isPlaced = placed.has(key);
          const draggable = canEdit && !isPlaced;
          return (
            <div
              key={key}
              className={`nsc-sidebar-item${isPlaced ? ' placed' : ''}`}
              draggable={draggable}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, key);
                e.dataTransfer.effectAllowed = 'move';
              }}
              title={isPlaced ? 'Bereits im Canvas' : r.display}
            >
              <div className="nsc-sidebar-item-text">
                <div className="text-truncate">{r.name ?? r.display}</div>
                {type === 'ipam.service' && (
                  <div className="small text-muted text-truncate">
                    {r.protocol?.label} {r.ports?.join(', ')}
                    {r.parent?.display ? ` · ${r.parent.display}` : ''}
                  </div>
                )}
              </div>
              {isPlaced ? (
                <i className="mdi mdi-check text-success" />
              ) : (
                canEdit && (
                  <button type="button" className="btn btn-sm btn-ghost-primary" onClick={() => onAdd(key)} title="Hinzufügen">
                    <i className="mdi mdi-plus" />
                  </button>
                )
              )}
            </div>
          );
        })}
        {count > results.length && (
          <div className="text-muted small p-2">
            {results.length} von {count} – Suche verfeinern
          </div>
        )}
      </div>
      {canEdit && perms.add_service && (
        <div className="nsc-sidebar-foot">
          <button type="button" className="btn btn-sm btn-outline-primary w-100" onClick={onNewService}>
            <i className="mdi mdi-plus-circle-outline" /> Neuer Service
          </button>
        </div>
      )}
    </aside>
  );
}
