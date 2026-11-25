import { useEffect, useState } from 'react';
import type { BriefObject } from '../api';
import { useEditor } from '../context';
import { APPLICATION_LABEL, makeKey } from '../graph';

export const DRAG_MIME = 'application/x-nsc-object-key';

const TYPES: Array<{ label: string; title: string; icon: string }> = [
  { label: 'dcim.device', title: 'Devices', icon: 'mdi-server' },
  { label: 'virtualization.virtualmachine', title: 'VMs', icon: 'mdi-monitor' },
  { label: 'ipam.service', title: 'Services', icon: 'mdi-cog-outline' },
  { label: APPLICATION_LABEL, title: 'Apps', icon: 'mdi-apps' },
];

interface Props {
  placed: Set<string>;
  onAdd: (key: string) => void;
  onNewService: () => void;
  onNewApplication: () => void;
  onAddNote: () => void;
  canEdit: boolean;
}

type Result = BriefObject & {
  parent?: { display?: string } | null;
  protocol?: { label?: string };
  ports?: number[];
  status?: { label?: string } | string;
  version?: string;
  description?: string;
};

function secondLine(type: string, r: Result): string {
  if (type === 'ipam.service') {
    return `${r.protocol?.label ?? ''} ${r.ports?.join(', ') ?? ''}${r.parent?.display ? ` · ${r.parent.display}` : ''}`.trim();
  }
  if (type === APPLICATION_LABEL) {
    const status = typeof r.status === 'object' ? r.status?.label : r.status;
    return [r.version ? `v${r.version}` : '', status ?? ''].filter(Boolean).join(' · ');
  }
  return r.description ?? '';
}

export function Sidebar({ placed, onAdd, onNewService, onNewApplication, onAddNote, canEdit }: Props) {
  const { api, perms, readOnly } = useEditor();
  const [type, setType] = useState(TYPES[0].label);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const icon = TYPES.find((t) => t.label === type)?.icon ?? 'mdi-shape-outline';

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

  const showServiceButton = !readOnly && perms.add_service;
  const showAppButton = !readOnly && perms.add_application;
  const showNoteButton = !readOnly && perms.edit_notes;

  return (
    <aside className="nsc-sidebar">
      <div className="nsc-sidebar-head">
        <div className="nsc-type-grid" role="tablist" aria-label="Objekttyp">
          {TYPES.map((t) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={type === t.label}
              className={type === t.label ? 'active' : ''}
              onClick={() => setType(t.label)}
            >
              <i className={`mdi ${t.icon}`} />
              <span>{t.title}</span>
            </button>
          ))}
        </div>
        <div className="nsc-search">
          <i className="mdi mdi-magnify" />
          <input
            type="search"
            className="form-control"
            placeholder="Suchen…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {canEdit && <div className="nsc-sidebar-hint">Auf die Fläche ziehen oder mit <i className="mdi mdi-plus" /> hinzufügen.</div>}
      </div>
      <div className="nsc-sidebar-list">
        {error && <div className="text-danger small p-2">{error}</div>}
        {!error && !loading && results.length === 0 && <div className="text-muted small p-3 text-center">Keine Treffer</div>}
        {results.map((r) => {
          const key = makeKey(type, r.id);
          const isPlaced = placed.has(key);
          const draggable = canEdit && !isPlaced;
          const sub = secondLine(type, r);
          return (
            <div
              key={key}
              className={`nsc-sidebar-item${isPlaced ? ' placed' : ''}${draggable ? ' draggable' : ''}`}
              draggable={draggable}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, key);
                e.dataTransfer.effectAllowed = 'move';
              }}
              title={isPlaced ? 'Bereits auf der Canvas' : r.display}
            >
              <span className="nsc-sidebar-item-icon"><i className={`mdi ${icon}`} /></span>
              <div className="nsc-sidebar-item-text">
                <div className="text-truncate fw-medium">{r.name ?? r.display}</div>
                {sub && <div className="small text-muted text-truncate">{sub}</div>}
              </div>
              {isPlaced ? (
                <i className="mdi mdi-check-circle text-success" title="Bereits auf der Canvas" />
              ) : (
                canEdit && (
                  <button type="button" className="btn btn-sm btn-ghost-primary nsc-sidebar-add" onClick={() => onAdd(key)} title="Zur Canvas hinzufügen">
                    <i className="mdi mdi-plus" />
                  </button>
                )
              )}
            </div>
          );
        })}
        {count > results.length && (
          <div className="text-muted small p-2 text-center">
            {results.length} von {count} – Suche verfeinern
          </div>
        )}
      </div>
      {(showServiceButton || showAppButton || showNoteButton) && (
        <div className="nsc-sidebar-foot">
          <div className="nsc-sidebar-foot-title">Neu anlegen</div>
          <div className="nsc-create-grid">
            {showServiceButton && (
              <button type="button" className="btn btn-outline-primary" onClick={onNewService}>
                <i className="mdi mdi-cog-outline" /> Service
              </button>
            )}
            {showAppButton && (
              <button type="button" className="btn btn-outline-primary" onClick={onNewApplication}>
                <i className="mdi mdi-apps" /> Application
              </button>
            )}
            {showNoteButton && (
              <button type="button" className="btn btn-outline-secondary" onClick={onAddNote}>
                <i className="mdi mdi-note-outline" /> Notiz
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
