import { useState } from 'react';
import { ApiError } from '../api';
import { DIRECTIONS, KINDS, PROTOCOLS, STATUSES, guessProtocol } from '../choices';
import { useEditor } from '../context';
import { parseKey } from '../graph';
import type { ObjectDescriptor } from '../types';
import { Modal } from './Modal';
import { t } from '../i18n';

interface Props {
  source: ObjectDescriptor;
  target: ObjectDescriptor;
  onClose: () => void;
  /** Called after the change was written to NetBox; `connectionId` is set for new data flows. */
  onDone: (result: { connectionId?: number; message: string }) => void;
}

type Mode = 'runs_on' | 'flow';

/** Which of the two objects is the service and which the host, if a "runs on" relation is possible. */
export function runsOnPair(a: ObjectDescriptor, b: ObjectDescriptor): { service: ObjectDescriptor; host: ObjectDescriptor } | null {
  if (a.type === 'service' && b.type !== 'service') return { service: a, host: b };
  if (b.type === 'service' && a.type !== 'service') return { service: b, host: a };
  return null;
}

export function ConnectDialog({ source, target, onClose, onDone }: Props) {
  const { api, perms } = useEditor();
  const pair = runsOnPair(source, target);
  const canRunsOn = !!pair && perms.change_service;
  const canFlow = perms.add_connection;
  const [mode, setMode] = useState<Mode>(canFlow ? 'flow' : 'runs_on');

  const targetPort = target.service?.ports?.[0];
  const [protocol, setProtocol] = useState(guessProtocol(targetPort, target.service?.protocol));
  const [port, setPort] = useState(targetPort ? String(targetPort) : '');
  const [direction, setDirection] = useState('uni');
  const [status, setStatus] = useState('active');
  const [kind, setKind] = useState('uses');
  const [dataDescription, setDataDescription] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portNumber = port ? Number(port) : null;
  const portValid = portNumber === null || (Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'runs_on' && pair) {
        const host = parseKey(pair.host.key)!;
        await api.setServiceParent(pair.service.id, host.label, host.id);
        onDone({ message: t('{service} now runs on {host}.', { service: pair.service.name, host: pair.host.name }) });
      } else {
        const s = parseKey(source.key)!;
        const tg = parseKey(target.key)!;
        const created = await api.createConnection({
          source_type: s.label,
          source_id: s.id,
          target_type: tg.label,
          target_id: tg.id,
          protocol,
          port: portNumber,
          direction,
          status,
          kind,
          data_description: dataDescription.trim(),
          description: description.trim(),
        });
        onDone({ connectionId: created.id, message: t('Connection created.') });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setBusy(false);
    }
  };

  const parentChanges = pair && pair.service.service?.parent_key && pair.service.service.parent_key !== pair.host.key;

  return (
    <Modal
      title={t('Create connection')}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{t('Cancel')}</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || (mode === 'flow' ? !canFlow || !portValid : !canRunsOn)}
            onClick={submit}
          >
            {busy ? t('Saving…') : t('Create')}
          </button>
        </>
      )}
    >
      <p className="mb-3">
        <strong>{source.name}</strong> <i className="mdi mdi-arrow-right" /> <strong>{target.name}</strong>
      </p>
      <div className="mb-3">
        <div className="form-check">
          <input
            className="form-check-input"
            type="radio"
            id="nsc-mode-flow"
            checked={mode === 'flow'}
            disabled={!canFlow}
            onChange={() => setMode('flow')}
          />
          <label className="form-check-label" htmlFor="nsc-mode-flow">
            {t('Data flow')} <span className="text-muted">{t('creates a service connection')}</span>
          </label>
        </div>
        <div className="form-check">
          <input
            className="form-check-input"
            type="radio"
            id="nsc-mode-runs-on"
            checked={mode === 'runs_on'}
            disabled={!canRunsOn}
            onChange={() => setMode('runs_on')}
          />
          <label className="form-check-label" htmlFor="nsc-mode-runs-on">
            {t('Runs on')} <span className="text-muted">{t('sets the parent of the service')}</span>
          </label>
          {!pair && <div className="form-text">{t('Only possible between a service and a device or VM.')}</div>}
        </div>
      </div>

      {mode === 'runs_on' && pair && (
        <div className={`alert ${parentChanges ? 'alert-warning' : 'alert-info'}`}>
          {parentChanges
            ? t('The service "{service}" currently runs on "{old}" and will be moved to "{host}".', { service: pair.service.name, old: pair.service.service?.parent_name ?? '', host: pair.host.name })
            : t('The service "{service}" will be assigned to "{host}".', { service: pair.service.name, host: pair.host.name })}
        </div>
      )}

      {mode === 'flow' && (
        <>
          <div className="row mb-3">
            <div className="col-6">
              <label className="form-label" htmlFor="nsc-flow-protocol">{t('Protocol')}</label>
              <select id="nsc-flow-protocol" className="form-select" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
                {PROTOCOLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label" htmlFor="nsc-flow-port">Port</label>
              <input
                id="nsc-flow-port"
                type="number"
                min={1}
                max={65535}
                className={`form-control${portValid ? '' : ' is-invalid'}`}
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>
          </div>
          <div className="row mb-3">
            <div className="col-6">
              <label className="form-label" htmlFor="nsc-flow-direction">{t('Direction')}</label>
              <select id="nsc-flow-direction" className="form-select" value={direction} onChange={(e) => setDirection(e.target.value)}>
                {DIRECTIONS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label" htmlFor="nsc-flow-status">Status</label>
              <select id="nsc-flow-status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="nsc-flow-kind">{t('Impact analysis')}</label>
            <select id="nsc-flow-kind" className="form-select" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
            </select>
            <div className="form-text">
              {kind === 'proxy'
                ? t('If {source} fails, {target} counts as unreachable.', { source: source.name, target: target.name })
                : t('If {target} fails, {source} is affected.', { source: source.name, target: target.name })}
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="nsc-flow-data">{t('Data')}</label>
            <input
              id="nsc-flow-data"
              className="form-control"
              placeholder={t('e.g. metrics, backups, logins')}
              maxLength={200}
              value={dataDescription}
              onChange={(e) => setDataDescription(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="nsc-flow-description">{t('Description')}</label>
            <input id="nsc-flow-description" className="form-control" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-text">{t('You can add intermediate stations (hops) afterwards in the edge panel.')}</div>
        </>
      )}
      {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
    </Modal>
  );
}
