import { useState } from 'react';
import { ApiError } from '../api';
import { useEditor } from '../context';
import { makeKey } from '../graph';
import { parsePorts } from '../util';
import { Modal, Section } from './Modal';
import { ObjectPicker, type Picked } from './ObjectPicker';

const PARENT_TYPES = [
  { label: 'dcim.device', title: 'Device', icon: 'mdi-server' },
  { label: 'virtualization.virtualmachine', title: 'Virtuelle Maschine', icon: 'mdi-monitor' },
];

const TRANSPORTS: Array<[string, string]> = [['tcp', 'TCP'], ['udp', 'UDP'], ['sctp', 'SCTP']];

/** Frequently used ports, offered as one-click suggestions. */
const COMMON_PORTS: Array<[number, string]> = [
  [80, 'HTTP'], [443, 'HTTPS'], [22, 'SSH'], [3000, 'Grafana'], [8080, 'Web'], [9090, 'Prometheus'], [5432, 'PostgreSQL'],
];

interface Props {
  initialParent: { label: string; id: number; name?: string } | null;
  onClose: () => void;
  onCreated: (serviceKey: string, parentKey: string) => void;
}

export function NewServiceModal({ initialParent, onClose, onCreated }: Props) {
  const { api } = useEditor();
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
  const valid = parent.id !== null && name.trim() !== '' && parsedPorts !== null;
  const parentType = PARENT_TYPES.find((t) => t.label === parent.label);

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
      onCreated(makeKey('ipam.service', created.id), makeKey(parent.label, parent.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Neuer Service"
      icon="mdi-cog-outline"
      subtitle="Legt einen NetBox-Service an und platziert ihn auf der Canvas."
      size="lg"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Abbrechen</button>
          <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={submit}>
            <i className="mdi mdi-check" /> {busy ? 'Speichere…' : 'Service anlegen'}
          </button>
        </>
      )}
    >
      <div className="nsc-form-grid">
        <Section title="Läuft auf" hint="Device oder virtuelle Maschine, auf dem der Service läuft.">
          {!choosingParent && parent.id !== null ? (
            <div className="nsc-selected-host">
              <i className={`mdi ${parentType?.icon ?? 'mdi-server'}`} />
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold text-truncate">{parent.display ?? `#${parent.id}`}</div>
                <div className="small text-muted">{parentType?.title}</div>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setChoosingParent(true)}>
                Ändern
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
              placeholder="z. B. grafana"
              value={name}
              maxLength={100}
              autoFocus={!!initialParent}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <span className="form-label d-block">Protokoll</span>
            <div className="nsc-segmented" role="radiogroup" aria-label="Protokoll">
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
              placeholder="z. B. 80, 443 oder 8000-8010"
              value={ports}
              onChange={(e) => setPorts(e.target.value)}
            />
            {ports && !parsedPorts && <div className="invalid-feedback">Ports 1–65535, getrennt durch Komma; Bereiche mit „-“.</div>}
            <div className="nsc-port-suggestions">
              {COMMON_PORTS.map(([port, label]) => (
                <button key={port} type="button" className="btn btn-sm btn-ghost-secondary" onClick={() => addPort(port)}>
                  {port} <span className="text-muted">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label" htmlFor="nsc-svc-description">Beschreibung <span className="text-muted">(optional)</span></label>
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
      {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
    </Modal>
  );
}
