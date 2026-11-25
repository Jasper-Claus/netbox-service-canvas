import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api';
import { APPLICATION_STATUSES, SERVICE_TRANSPORTS } from '../choices';
import { useEditor } from '../context';
import { flowLabel } from '../graph';
import type { Flow, ObjectDescriptor } from '../types';
import { parsePorts } from '../util';
import { MultiObjectPicker } from './ObjectPicker';
import { NODE_ICONS, NODE_TYPE_LABELS, statusColorVar } from './ObjectNode';

interface Props {
  desc: ObjectDescriptor;
  flows: Flow[];
  describe: (key: string) => ObjectDescriptor | null;
  layoutEditable: boolean;
  impactActive: boolean;
  onClose: () => void;
  /** Reload descriptors and edges after the object was changed in NetBox. */
  onChanged: () => void;
  onRemove: () => void;
  onSelectFlow: (id: number) => void;
  onToggleImpact: () => void;
  onNewService: () => void;
}

function editUrl(desc: ObjectDescriptor): string {
  const back = `${window.location.pathname}${window.location.search}`;
  return `${desc.url}edit/?return_url=${encodeURIComponent(back)}`;
}

function ServiceEditor({ desc, onChanged }: { desc: ObjectDescriptor; onChanged: () => void }) {
  const { api, notify } = useEditor();
  const service = desc.service!;
  const initial = { name: desc.name, protocol: service.protocol, ports: service.ports.join(', ') };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm({ name: desc.name, protocol: service.protocol, ports: service.ports.join(', ') }), [desc, service]);

  const ports = parsePorts(form.ports);
  const dirty = form.name !== initial.name || form.protocol !== initial.protocol || form.ports !== initial.ports;
  const valid = form.name.trim() !== '' && ports !== null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.updateService(desc.id, { name: form.name.trim(), protocol: form.protocol, ports });
      notify('Service gespeichert.', 'success');
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset disabled={busy}>
      <div className="mb-2">
        <label className="form-label small" htmlFor="nsc-node-svc-name">Name</label>
        <input id="nsc-node-svc-name" className="form-control form-control-sm" value={form.name} maxLength={100}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="mb-2">
        <span className="form-label small d-block">Protokoll</span>
        <div className="nsc-segmented nsc-segmented-sm">
          {SERVICE_TRANSPORTS.map(([v, l]) => (
            <button key={v} type="button" className={form.protocol === v ? 'active' : ''} onClick={() => setForm({ ...form, protocol: v })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-2">
        <label className="form-label small" htmlFor="nsc-node-svc-ports">Ports</label>
        <input id="nsc-node-svc-ports" className={`form-control form-control-sm${ports ? '' : ' is-invalid'}`} value={form.ports}
          onChange={(e) => setForm({ ...form, ports: e.target.value })} />
      </div>
      {error && <div className="alert alert-danger py-1 small">{error}</div>}
      <button type="button" className="btn btn-sm btn-primary" disabled={!dirty || !valid} onClick={save}>
        <i className="mdi mdi-content-save-outline" /> Speichern
      </button>
    </fieldset>
  );
}

function ApplicationEditor({ desc, onChanged }: { desc: ObjectDescriptor; onChanged: () => void }) {
  const { api, notify } = useEditor();
  const [form, setForm] = useState<{
    name: string; status: string; version: string; web_url: string; description: string;
    services: Array<{ id: number; display: string }>;
  } | null>(null);
  const [initial, setInitial] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getApplication(desc.id)
      .then((app) => {
        if (cancelled) return;
        const loaded = {
          name: app.name ?? '',
          status: typeof app.status === 'object' && app.status !== null
            ? (app.status as { value: string }).value : String(app.status ?? 'active'),
          version: app.version ?? '',
          web_url: app.web_url ?? '',
          description: app.description ?? '',
          services: app.services.map((s) => ({ id: s.id, display: s.display })),
        };
        setForm(loaded);
        setInitial(JSON.stringify(loaded));
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api, desc]);

  if (!form) return error ? <div className="alert alert-danger py-1 small">{error}</div> : <div className="text-muted small">Lade…</div>;

  const urlValid = !form.web_url || /^https?:\/\/\S+$/i.test(form.web_url.trim());
  const dirty = JSON.stringify(form) !== initial;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.updateApplication(desc.id, {
        name: form.name.trim(),
        status: form.status,
        version: form.version.trim(),
        web_url: form.web_url.trim(),
        description: form.description.trim(),
        services: form.services.map((s) => s.id),
      });
      setInitial(JSON.stringify(form));
      notify('Application gespeichert.', 'success');
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset disabled={busy}>
      <div className="mb-2">
        <label className="form-label small" htmlFor="nsc-node-app-name">Name</label>
        <input id="nsc-node-app-name" className="form-control form-control-sm" value={form.name} maxLength={100}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="row g-2 mb-2">
        <div className="col-7">
          <label className="form-label small" htmlFor="nsc-node-app-status">Status</label>
          <select id="nsc-node-app-status" className="form-select form-select-sm" value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {APPLICATION_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="col-5">
          <label className="form-label small" htmlFor="nsc-node-app-version">Version</label>
          <input id="nsc-node-app-version" className="form-control form-control-sm" value={form.version} maxLength={50}
            onChange={(e) => setForm({ ...form, version: e.target.value })} />
        </div>
      </div>
      <div className="mb-2">
        <label className="form-label small" htmlFor="nsc-node-app-url">URL</label>
        <input id="nsc-node-app-url" className={`form-control form-control-sm${urlValid ? '' : ' is-invalid'}`}
          value={form.web_url} maxLength={200} placeholder="https://…"
          onChange={(e) => setForm({ ...form, web_url: e.target.value })} />
      </div>
      <div className="mb-2">
        <label className="form-label small" htmlFor="nsc-node-app-description">Beschreibung</label>
        <input id="nsc-node-app-description" className="form-control form-control-sm" value={form.description} maxLength={200}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="mb-2">
        <span className="form-label small d-block">Services</span>
        <MultiObjectPicker label="ipam.service" value={form.services} idPrefix="nsc-node-app-services"
          onChange={(services) => setForm({ ...form, services })} />
      </div>
      {error && <div className="alert alert-danger py-1 small">{error}</div>}
      <button type="button" className="btn btn-sm btn-primary" disabled={!dirty || !urlValid || !form.name.trim()} onClick={save}>
        <i className="mdi mdi-content-save-outline" /> Speichern
      </button>
    </fieldset>
  );
}

export function NodePanel({
  desc, flows, describe, layoutEditable, impactActive, onClose, onChanged, onRemove, onSelectFlow, onToggleImpact,
  onNewService,
}: Props) {
  const { perms, readOnly } = useEditor();
  const [tab, setTab] = useState<'info' | 'edit'>('info');

  const canEditObject = !readOnly && (
    (desc.type === 'service' && perms.change_service)
    || (desc.type === 'application' && perms.change_application)
  );
  const isHost = desc.type === 'device' || desc.type === 'virtualmachine';

  const connections = useMemo(() => flows
    .filter((f) => f.source === desc.key || f.target === desc.key)
    .map((f) => {
      const outgoing = f.source === desc.key;
      const other = describe(outgoing ? f.target : f.source);
      return { flow: f, outgoing, otherName: other?.name ?? (outgoing ? f.target : f.source) };
    }), [flows, desc.key, describe]);

  return (
    <aside className="nsc-panel" aria-label={`Details zu ${desc.name}`}>
      <div className="nsc-panel-head nsc-node-panel-head" style={{ ['--nsc-status' as string]: statusColorVar(desc.status?.color) }}>
        <span className="nsc-panel-icon"><i className={`mdi ${NODE_ICONS[desc.type]}`} /></span>
        <div className="flex-grow-1 min-w-0">
          <div className="small text-muted text-uppercase">{NODE_TYPE_LABELS[desc.type]}</div>
          <h6 className="mb-0 text-truncate" title={desc.name}>{desc.name}</h6>
        </div>
        <button type="button" className="btn-close" aria-label="Schließen" onClick={onClose} />
      </div>

      {canEditObject && (
        <div className="nsc-panel-tabs">
          <button type="button" className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>Übersicht</button>
          <button type="button" className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}>
            <i className="mdi mdi-pencil" /> Bearbeiten
          </button>
        </div>
      )}

      <div className="nsc-panel-body">
        {tab === 'edit' && canEditObject ? (
          desc.type === 'service'
            ? <ServiceEditor desc={desc} onChanged={onChanged} />
            : <ApplicationEditor desc={desc} onChanged={onChanged} />
        ) : (
          <>
            <dl className="nsc-facts">
              {desc.status && (
                <>
                  <dt>Status</dt>
                  <dd><span className="nsc-status-dot" style={{ background: statusColorVar(desc.status.color) }} /> {desc.status.label}</dd>
                </>
              )}
              {desc.service && (
                <>
                  <dt>Ports</dt>
                  <dd>{desc.service.protocol_label} {desc.service.ports.join(', ')}</dd>
                  <dt>Läuft auf</dt>
                  <dd>{desc.service.parent_name || '–'}</dd>
                </>
              )}
              {desc.application && (
                <>
                  {desc.application.version && (<><dt>Version</dt><dd>{desc.application.version}</dd></>)}
                  {desc.application.web_url && (
                    <>
                      <dt>URL</dt>
                      <dd className="text-truncate">
                        <a href={desc.application.web_url} target="_blank" rel="noreferrer">{desc.application.web_url}</a>
                      </dd>
                    </>
                  )}
                  <dt>Services</dt>
                  <dd>{desc.application.service_keys.length}</dd>
                </>
              )}
              {desc.primary_ip && (<><dt>IP</dt><dd className="font-monospace">{desc.primary_ip}</dd></>)}
              {desc.subtitle && !desc.service && !desc.application && (<><dt>Info</dt><dd>{desc.subtitle}</dd></>)}
            </dl>

            <div className="nsc-panel-actions">
              <a className="btn btn-sm btn-outline-primary" href={desc.url} target="_blank" rel="noreferrer">
                <i className="mdi mdi-open-in-new" /> In NetBox öffnen
              </a>
              {!readOnly && (
                <a className="btn btn-sm btn-outline-secondary" href={editUrl(desc)} title="Öffnet das NetBox-Formular und kehrt danach hierher zurück">
                  <i className="mdi mdi-pencil-outline" /> Alle Felder bearbeiten
                </a>
              )}
              {canEditObject && (
                <button type="button" className="btn btn-sm btn-primary" onClick={() => setTab('edit')}>
                  <i className="mdi mdi-pencil" /> Schnell bearbeiten
                </button>
              )}
              <button
                type="button"
                className={`btn btn-sm ${impactActive ? 'btn-danger' : 'btn-outline-danger'}`}
                onClick={onToggleImpact}
                title="Zeigt, was betroffen ist, wenn dieses Objekt ausfällt"
              >
                <i className="mdi mdi-lightning-bolt-outline" /> {impactActive ? 'Impact ausblenden' : 'Impact-Analyse'}
              </button>
              {isHost && !readOnly && perms.add_service && (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onNewService}>
                  <i className="mdi mdi-plus" /> Service auf diesem Host
                </button>
              )}
            </div>

            <h6 className="nsc-panel-subtitle">Verbindungen auf dieser Canvas</h6>
            {connections.length === 0 ? (
              <div className="text-muted small mb-2">Keine.</div>
            ) : (
              <div className="list-group list-group-flush mb-2">
                {connections.map(({ flow, outgoing, otherName }) => (
                  <button key={flow.id} type="button" className="list-group-item list-group-item-action nsc-conn-item" onClick={() => onSelectFlow(flow.id)}>
                    <i className={`mdi ${flow.direction === 'bi' ? 'mdi-arrow-left-right' : outgoing ? 'mdi-arrow-right' : 'mdi-arrow-left'}`} />
                    <span className="flex-grow-1 min-w-0">
                      <span className="d-block text-truncate">{otherName}</span>
                      <span className="small text-muted">{flowLabel(flow)}</span>
                    </span>
                    <i className="mdi mdi-chevron-right text-muted" />
                  </button>
                ))}
              </div>
            )}
            {!readOnly && (perms.add_connection || perms.change_service) && (
              <div className="nsc-hint">
                <i className="mdi mdi-gesture-tap-hold" /> Neue Verbindung: am Punkt rechts des Knotens ziehen und auf einem anderen Knoten loslassen.
              </div>
            )}

            {layoutEditable && (
              <button type="button" className="btn btn-sm btn-ghost-danger w-100 mt-3" onClick={onRemove}>
                <i className="mdi mdi-eye-off-outline" /> Von dieser Canvas entfernen
                <div className="small text-muted">Das Objekt bleibt in NetBox erhalten.</div>
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
