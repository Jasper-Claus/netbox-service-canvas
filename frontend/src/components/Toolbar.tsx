export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

interface Props {
  readOnly: boolean;
  canEdit: boolean;
  canEditLayout: boolean;
  canEditGroups: boolean;
  onToggleReadOnly: () => void;
  saveState: SaveState;
  autosave: boolean;
  onToggleAutosave: () => void;
  onSave: () => void;
  snap: boolean;
  onToggleSnap: () => void;
  minimap: boolean;
  onToggleMinimap: () => void;
  showRunsOn: boolean;
  onToggleRunsOn: () => void;
  sidebar: boolean;
  onToggleSidebar: () => void;
  onAddGroup: () => void;
  onAutoLayout: () => void;
  onAddMissing: () => void;
  onFitView: () => void;
  onExport: (format: 'png' | 'svg') => void;
  onExportPdf: () => void;
  impactName: string | null;
  onClearImpact: () => void;
  onReload: () => void;
  busy: boolean;
}

const SAVE_LABELS: Record<SaveState, { text: string; cls: string; icon: string }> = {
  saved: { text: 'Gespeichert', cls: 'text-success', icon: 'mdi-check-circle-outline' },
  dirty: { text: 'Ungespeichert', cls: 'text-warning', icon: 'mdi-circle-edit-outline' },
  saving: { text: 'Speichere…', cls: 'text-muted', icon: 'mdi-loading mdi-spin' },
  error: { text: 'Fehler beim Speichern', cls: 'text-danger', icon: 'mdi-alert-circle-outline' },
};

function ToggleButton({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: string; title: string }) {
  return (
    <button
      type="button"
      className={`btn btn-sm ${active ? 'btn-secondary' : 'btn-outline-secondary'}`}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      <i className={`mdi ${icon}`} />
    </button>
  );
}

export function Toolbar(p: Props) {
  const save = SAVE_LABELS[p.saveState];
  const layoutEditable = !p.readOnly && p.canEditLayout;
  return (
    <div className="nsc-toolbar">
      <ToggleButton active={p.sidebar} onClick={p.onToggleSidebar} icon="mdi-dock-left" title="Seitenleiste ein/aus" />
      {p.canEdit && (
        <button
          type="button"
          className={`btn btn-sm ${p.readOnly ? 'btn-outline-secondary' : 'btn-primary'}`}
          onClick={p.onToggleReadOnly}
          title={p.readOnly ? 'Bearbeiten aktivieren' : 'Nur ansehen'}
        >
          <i className={`mdi ${p.readOnly ? 'mdi-lock-outline' : 'mdi-pencil'}`} /> {p.readOnly ? 'Nur Ansicht' : 'Bearbeiten'}
        </button>
      )}
      {!p.canEdit && (
        <span className="badge text-bg-secondary"><i className="mdi mdi-lock-outline" /> Nur Ansicht</span>
      )}

      <div className="btn-group">
        {layoutEditable && p.canEditGroups && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onAddGroup} title="Gruppe hinzufügen (markierte Knoten werden aufgenommen)">
            <i className="mdi mdi-group" /> Gruppe
          </button>
        )}
        {layoutEditable && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onAutoLayout} disabled={p.busy} title="Automatisch anordnen">
            <i className="mdi mdi-auto-fix" /> Auto-Layout
          </button>
        )}
        {layoutEditable && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onAddMissing} disabled={p.busy} title="Zugehörige Services, Hosts und Verbindungspartner ergänzen">
            <i className="mdi mdi-plus-network-outline" /> Fehlende ergänzen
          </button>
        )}
      </div>

      <div className="btn-group">
        <ToggleButton active={p.snap} onClick={p.onToggleSnap} icon="mdi-grid" title="Am Raster ausrichten" />
        <ToggleButton active={p.minimap} onClick={p.onToggleMinimap} icon="mdi-map-outline" title="Minimap" />
        <ToggleButton active={p.showRunsOn} onClick={p.onToggleRunsOn} icon="mdi-link-variant" title="„Läuft auf“-Kanten anzeigen" />
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onFitView} title="Alles anzeigen">
          <i className="mdi mdi-fit-to-screen-outline" />
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onReload} disabled={p.busy} title="Aus NetBox neu laden">
          <i className="mdi mdi-refresh" />
        </button>
      </div>

      <div className="btn-group">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => p.onExport('png')} disabled={p.busy} title="Als PNG exportieren">
          <i className="mdi mdi-file-image-outline" /> PNG
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => p.onExport('svg')} disabled={p.busy} title="Als SVG exportieren">
          SVG
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onExportPdf} disabled={p.busy} title="Als DIN-A4-PDF zum Drucken exportieren">
          <i className="mdi mdi-file-pdf-box" /> PDF (A4)
        </button>
      </div>

      {p.impactName && (
        <span className="nsc-impact-chip">
          <i className="mdi mdi-lightning-bolt" /> Impact: Ausfall von <strong>{p.impactName}</strong>
          <button type="button" className="btn-close btn-close-sm" aria-label="Impact-Analyse beenden" onClick={p.onClearImpact} />
        </span>
      )}

      <div className="ms-auto d-flex align-items-center gap-2">
        {p.canEditLayout && !p.readOnly && (
          <>
            <span className={`small ${save.cls}`}>
              <i className={`mdi ${save.icon}`} /> {save.text}
            </span>
            <div className="form-check form-switch mb-0" title="Layout automatisch speichern">
              <input className="form-check-input" type="checkbox" id="nsc-autosave" checked={p.autosave} onChange={p.onToggleAutosave} />
              <label className="form-check-label small" htmlFor="nsc-autosave">Autosave</label>
            </div>
            {!p.autosave && (
              <button type="button" className="btn btn-sm btn-primary" disabled={p.saveState === 'saved' || p.saveState === 'saving'} onClick={p.onSave}>
                <i className="mdi mdi-content-save-outline" /> Speichern
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
