import { useState } from 'react';
import { ApiError } from '../api';
import { APPLICATION_STATUSES } from '../choices';
import { useEditor } from '../context';
import { APPLICATION_LABEL, makeKey } from '../graph';
import { Modal, Section } from './Modal';
import { MultiObjectPicker } from './ObjectPicker';

interface Props {
  /** Services to pre-select (e.g. the ones currently selected on the canvas). */
  initialServices: Array<{ id: number; display: string }>;
  onClose: () => void;
  onCreated: (applicationKey: string, serviceKeys: string[]) => void;
}

export function NewApplicationModal({ initialServices, onClose, onCreated }: Props) {
  const { api } = useEditor();
  const [name, setName] = useState('');
  const [status, setStatus] = useState('active');
  const [version, setVersion] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [description, setDescription] = useState('');
  const [services, setServices] = useState(initialServices);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const urlValid = !webUrl || /^https?:\/\/\S+$/i.test(webUrl.trim());
  const valid = name.trim() !== '' && urlValid;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createApplication({
        name: name.trim(),
        status,
        version: version.trim(),
        web_url: webUrl.trim(),
        description: description.trim(),
        services: services.map((s) => s.id),
      });
      onCreated(makeKey(APPLICATION_LABEL, created.id), services.map((s) => makeKey('ipam.service', s.id)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Neue Application"
      icon="mdi-apps"
      subtitle="Eine Anwendung wie Grafana oder Paperless, bestehend aus einem oder mehreren Services."
      size="lg"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Abbrechen</button>
          <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={submit}>
            <i className="mdi mdi-check" /> {busy ? 'Speichere…' : 'Application anlegen'}
          </button>
        </>
      )}
    >
      <div className="nsc-form-grid">
        <Section title="Application">
          <div className="mb-3">
            <label className="form-label" htmlFor="nsc-app-name">Name</label>
            <input
              id="nsc-app-name"
              className="form-control"
              placeholder="z. B. Grafana"
              value={name}
              maxLength={100}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="row g-2 mb-3">
            <div className="col-7">
              <label className="form-label" htmlFor="nsc-app-status">Status</label>
              <select id="nsc-app-status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {APPLICATION_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-5">
              <label className="form-label" htmlFor="nsc-app-version">Version</label>
              <input
                id="nsc-app-version"
                className="form-control"
                placeholder="z. B. 11.2"
                value={version}
                maxLength={50}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="nsc-app-url">URL <span className="text-muted">(optional)</span></label>
            <input
              id="nsc-app-url"
              type="url"
              className={`form-control${urlValid ? '' : ' is-invalid'}`}
              placeholder="https://grafana.example.com"
              value={webUrl}
              maxLength={200}
              onChange={(e) => setWebUrl(e.target.value)}
            />
            {!urlValid && <div className="invalid-feedback">Bitte mit http:// oder https:// beginnen.</div>}
          </div>
          <div>
            <label className="form-label" htmlFor="nsc-app-description">Beschreibung <span className="text-muted">(optional)</span></label>
            <input
              id="nsc-app-description"
              className="form-control"
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </Section>

        <Section title="Services" hint="Aus welchen NetBox-Services besteht die Application? Kann später ergänzt werden.">
          <MultiObjectPicker label="ipam.service" value={services} onChange={setServices} idPrefix="nsc-app-services" />
        </Section>
      </div>
      {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
    </Modal>
  );
}
