import { useState } from 'react';
import { ApiError } from '../api';
import { useEditor } from '../context';
import { makeKey } from '../graph';
import { parsePorts } from '../util';
import { Modal } from './Modal';
import { ObjectPicker } from './ObjectPicker';

const PARENT_TYPES = [
  { label: 'dcim.device', title: 'Device' },
  { label: 'virtualization.virtualmachine', title: 'Virtuelle Maschine' },
];

interface Props {
  initialParent: { label: string; id: number } | null;
  onClose: () => void;
  onCreated: (serviceKey: string, parentKey: string) => void;
}

export function NewServiceModal({ initialParent, onClose, onCreated }: Props) {
  const { api } = useEditor();
  const [parent, setParent] = useState<{ label: string; id: number | null }>(
    initialParent ?? { label: 'dcim.device', id: null },
  );
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState('tcp');
  const [ports, setPorts] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedPorts = parsePorts(ports);
  const valid = parent.id !== null && name.trim() !== '' && parsedPorts !== null;

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
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Abbrechen</button>
          <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Speichere…' : 'Anlegen'}
          </button>
        </>
      )}
    >
      <div className="mb-3">
        <label className="form-label" htmlFor="nsc-svc-parent-object">Läuft auf</label>
        {initialParent ? (
          <div className="form-control-plaintext">Ausgewählter Host ({initialParent.label} #{initialParent.id})</div>
        ) : (
          <ObjectPicker types={PARENT_TYPES} value={parent} onChange={setParent} idPrefix="nsc-svc-parent" />
        )}
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="nsc-svc-name">Name</label>
        <input id="nsc-svc-name" className="form-control" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="row mb-3">
        <div className="col-4">
          <label className="form-label" htmlFor="nsc-svc-protocol">Protokoll</label>
          <select id="nsc-svc-protocol" className="form-select" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="sctp">SCTP</option>
          </select>
        </div>
        <div className="col-8">
          <label className="form-label" htmlFor="nsc-svc-ports">Ports</label>
          <input
            id="nsc-svc-ports"
            className={`form-control${ports && !parsedPorts ? ' is-invalid' : ''}`}
            placeholder="z. B. 80, 443 oder 8000-8010"
            value={ports}
            onChange={(e) => setPorts(e.target.value)}
          />
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="nsc-svc-description">Beschreibung</label>
        <input id="nsc-svc-description" className="form-control" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && <div className="alert alert-danger mb-0">{error}</div>}
    </Modal>
  );
}
