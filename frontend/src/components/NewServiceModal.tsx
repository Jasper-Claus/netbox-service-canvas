import { useState } from 'react';
import { ApiError } from '../api';
import { useEditor } from '../context';
import { APPLICATION_LABEL, makeKey } from '../graph';
import { parsePorts } from '../util';
import { Modal, Section } from './Modal';
import { ObjectPicker, type Picked } from './ObjectPicker';
import { t } from '../i18n';

const PARENT_TYPES = [
  { label: 'dcim.device', title: 'Device', icon: 'mdi-server' },
  { label: 'virtualization.virtualmachine', title: 'Virtual machine', icon: 'mdi-monitor' },
];

const TRANSPORTS: Array<[string, string]> = [['tcp', 'TCP'], ['udp', 'UDP'], ['sctp', 'SCTP']];

/** Frequently used ports, offered as one-click suggestions. */
const COMMON_PORTS: Array<[number, string]> = [
  [80, 'HTTP'], [443, 'HTTPS'], [22, 'SSH'], [3000, 'Grafana'], [8080, 'Web'], [9090, 'Prometheus'], [5432, 'PostgreSQL'],
];

const APP_TYPES = [{ label: APPLICATION_LABEL, title: 'Application', icon: 'mdi-apps' }];

type AppMode = 'none' | 'new' | 'existing';

interface Props {
  initialParent: { label: string; id: number; name?: string } | null;
  onClose: () => void;
  onCreated: (serviceKey: string, parentKey: string, applicationKey: string | null) => void;
}

export function NewServiceModal({ initialParent, onClose, onCreated }: Props) {
  const { api, perms, notify } = useEditor();
  const canApp = perms.add_application || perms.change_application;
  const [appMode, setAppMode] = useState<AppMode>('none');
  const [appName, setAppName] = useState('');
  const [appNameTouched, setAppNameTouched] = useState(false);
  const [existingApp, setExistingApp] = useState<Picked>({ label: APPLICATION_LABEL, id: null });
  const [parent, setParent] = useState<Picked>(
    initialParent
      ? { label: initialParent.label, id: initialParent.id, display: initialParent.name }
      : { label: 'dcim.device', id: null },
  );
  const [choosingParent, setChoosingParent] = useState(!initialParent);
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState('tcp');
  const [ports, setPorts] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedPorts = parsePorts(ports);
  const effectiveAppName = appNameTouched ? appName : name;
  const appValid = appMode === 'none'
    || (appMode === 'new' && effectiveAppName.trim() !== '')
    || (appMode === 'existing' && existingApp.id !== null);
  const valid = parent.id !== null && name.trim() !== '' && parsedPorts !== null && appValid;
  const parentType = PARENT_TYPES.find((ty) => ty.label === parent.label);

  const addPort = (port: number) => {
    const current = parsePorts(ports) ?? [];
    if (!current.includes(port)) setPorts([...current, port].sort((a, b) => a - b).join(', '));
  };

  const submit = async () => {
    if (!valid || parent.id === null || !parsedPorts) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createService({
        parent_object_type: parent.label,
        parent_object_id: parent.id,
        name: name.trim(),
        protocol,
        ports: parsedPorts,
        description: description.trim(),
      });
      let appKey: string | null = null;
      try {
        if (appMode === 'new') {
          const app = await api.createApplication({
            name: effectiveAppName.trim(), status: 'active', version: '', web_url: '', description: '', services: [created.id],
          });
          appKey = makeKey(APPLICATION_LABEL, app.id);
        } else if (appMode === 'existing' && existingApp.id !== null) {
          const app = await api.getApplication(existingApp.id);
          await api.updateApplication(existingApp.id, { services: [...app.services.map((s) => s.id), created.id] });
          appKey = makeKey(APPLICATION_LABEL, existingApp.id);
        }
      } catch (e) {
        // The service exists already; report the application problem but do not lose the service
        notify(t('Service created, but the application failed: {error}', { error: e instanceof ApiError ? e.message : String(e) }), 'danger');
        onCreated(makeKey('ipam.service', created.id), makeKey(parent.label, parent.id), null);
        return;
      }
      onCreated(makeKey('ipam.service', created.id), makeKey(parent.label, parent.id), appKey);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('New service')}
      icon="mdi-cog-outline"
      subtitle={t('A service is a port on a host, e.g. grafana on nas, TCP 3000. It is created in NetBox and placed on the canvas.')}
      size="lg"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('Cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={submit}>
            <i className="mdi mdi-check" /> {busy ? t('Saving…') : t('Create service')}
          </button>
        </>
      )}
    >
      <div className="nsc-form-grid">
        <Section title={t('Runs on')} hint={t('Device or virtual machine the service runs on.')}>
          {!choosingParent && parent.id !== null ? (
            <div className="nsc-selected-host">
              <i className={`mdi ${parentType?.icon ?? 'mdi-server'}`} />
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold text-truncate">{parent.display ?? `#${parent.id}`}</div>
                <div className="small text-muted">{parentType ? t(parentType.title) : ''}</div>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setChoosingParent(true)}>
                {t('Change')}
              </button>
            </div>
          ) : (
            <ObjectPicker types={PARENT_TYPES} value={parent} onChange={setParent} idPrefix="nsc-svc-parent" />
          )}
        </Section>

        <Section title="Service">
          <div className="mb-3">
            <label className="form-label" htmlFor="nsc-svc-name">Name</label>
            <input
              id="nsc-svc-name"
              className="form-control"
              placeholder={t('e.g. grafana')}
              value={name}
              maxLength={100}
              autoFocus={!!initialParent}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <span className="form-label d-block">{t('Protocol')}</span>
            <div className="nsc-segmented" role="radiogroup" aria-label={t('Protocol')}>
              {TRANSPORTS.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={protocol === v}
                  className={protocol === v ? 'active' : ''}
                  onClick={() => setProtocol(v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="nsc-svc-ports">Ports</label>
            <input
              id="nsc-svc-ports"
              className={`form-control${ports && !parsedPorts ? ' is-invalid' : ''}`}
              placeholder={t('e.g. 80, 443 or 8000-8010')}
              value={ports}
              onChange={(e) => setPorts(e.target.value)}
            />
            {ports && !parsedPorts && <div className="invalid-feedback">{t('Ports 1–65535, separated by commas; ranges with "-".')}</div>}
            <div className="nsc-port-suggestions">
              {COMMON_PORTS.map(([port, label]) => (
                <button key={port} type="button" className="btn btn-sm btn-ghost-secondary" onClick={() => addPort(port)}>
                  {port} <span className="text-muted">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label" htmlFor="nsc-svc-description">{t('Description')} <span className="text-muted">({t('optional')})</span></label>
            <input
              id="nsc-svc-description"
              className="form-control"
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </Section>
      </div>
      {canApp && (
        <div className="mt-3">
          <Section
            title={t('Application (optional)')}
            hint={t('An application groups services into one piece of software, e.g. Grafana = web UI + database. You don\'t need one for a single port.')}
          >
            <div className="nsc-segmented mb-2" role="radiogroup" aria-label="Application">
              <button type="button" role="radio" aria-checked={appMode === 'none'} className={appMode === 'none' ? 'active' : ''} onClick={() => setAppMode('none')}>
                {t('None')}
              </button>
              {perms.add_application && (
                <button type="button" role="radio" aria-checked={appMode === 'new'} className={appMode === 'new' ? 'active' : ''} onClick={() => setAppMode('new')}>
                  <i className="mdi mdi-plus" /> {t('New application')}
                </button>
              )}
              {perms.change_application && (
                <button type="button" role="radio" aria-checked={appMode === 'existing'} className={appMode === 'existing' ? 'active' : ''} onClick={() => setAppMode('existing')}>
                  <i className="mdi mdi-link-variant" /> {t('Add to existing')}
                </button>
              )}
            </div>
            {appMode === 'new' && (
              <div>
                <label className="form-label" htmlFor="nsc-svc-app-name">{t('Application name')}</label>
                <input
                  id="nsc-svc-app-name"
                  className="form-control"
                  placeholder={t('e.g. Grafana')}
                  value={effectiveAppName}
                  maxLength={100}
                  onChange={(e) => {
                    setAppNameTouched(true);
                    setAppName(e.target.value);
                  }}
                />
                <div className="form-text">{t('You can add version, URL etc. later in the node panel.')}</div>
              </div>
            )}
            {appMode === 'existing' && (
              <ObjectPicker types={APP_TYPES} value={existingApp} onChange={setExistingApp} idPrefix="nsc-svc-app" compact />
            )}
          </Section>
        </div>
      )}
      {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
    </Modal>
  );
}
