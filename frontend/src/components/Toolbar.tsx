import { t } from '../i18n';
import type { ObjectDescriptor } from '../types';
import { CanvasSearch } from './CanvasSearch';
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
  showCables: boolean;
  onToggleCables: () => void;
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
  searchObjects: ObjectDescriptor[];
  onSearchPick: (key: string) => void;
}

const SAVE_LABELS: Record<SaveState, { text: string; cls: string; icon: string }> = {
  saved: { text: 'Saved', cls: 'text-success', icon: 'mdi-check-circle-outline' },
  dirty: { text: 'Unsaved', cls: 'text-warning', icon: 'mdi-circle-edit-outline' },
  saving: { text: 'Saving…', cls: 'text-muted', icon: 'mdi-loading mdi-spin' },
  error: { text: 'Saving failed', cls: 'text-danger', icon: 'mdi-alert-circle-outline' },
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
      <ToggleButton active={p.sidebar} onClick={p.onToggleSidebar} icon="mdi-dock-left" title={t('Show/hide sidebar')} />
      {p.canEdit && (
        <button
          type="button"
          className={`btn btn-sm ${p.readOnly ? 'btn-outline-secondary' : 'btn-primary'}`}
          onClick={p.onToggleReadOnly}
          title={p.readOnly ? t('Enable editing') : t('View only')}
        >
          <i className={`mdi ${p.readOnly ? 'mdi-lock-outline' : 'mdi-pencil'}`} /> {p.readOnly ? t('View only') : t('Edit')}
        </button>
      )}
      {!p.canEdit && (
        <span className="badge text-bg-secondary"><i className="mdi mdi-lock-outline" /> {t('View only')}</span>
      )}

      <div className="btn-group">
        {layoutEditable && p.canEditGroups && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onAddGroup} title={t('Add group (selected nodes are moved into it)')}>
            <i className="mdi mdi-group" /> {t('Group')}
          </button>
        )}
        {layoutEditable && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onAutoLayout} disabled={p.busy} title={t('Arrange automatically')}>
            <i className="mdi mdi-auto-fix" /> {t('Auto layout')}
          </button>
        )}
        {layoutEditable && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onAddMissing} disabled={p.busy} title={t('Add related services, hosts and connection peers')}>
            <i className="mdi mdi-plus-network-outline" /> {t('Add missing')}
          </button>
        )}
      </div>

      <div className="btn-group">
        <ToggleButton active={p.snap} onClick={p.onToggleSnap} icon="mdi-grid" title={t('Snap to grid')} />
        <ToggleButton active={p.minimap} onClick={p.onToggleMinimap} icon="mdi-map-outline" title={t('Minimap')} />
        <ToggleButton active={p.showRunsOn} onClick={p.onToggleRunsOn} icon="mdi-link-variant" title={t('Show "runs on" edges')} />
        <ToggleButton active={p.showCables} onClick={p.onToggleCables} icon="mdi-ethernet-cable" title={t('Show cables (physical layer)')} />
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onFitView} title={t('Fit view')}>
          <i className="mdi mdi-fit-to-screen-outline" />
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onReload} disabled={p.busy} title={t('Reload from NetBox')}>
          <i className="mdi mdi-refresh" />
        </button>
      </div>

      <div className="btn-group">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => p.onExport('png')} disabled={p.busy} title={t('Export as PNG')}>
          <i className="mdi mdi-file-image-outline" /> PNG
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => p.onExport('svg')} disabled={p.busy} title={t('Export as SVG')}>
          SVG
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={p.onExportPdf} disabled={p.busy} title={t('Export as printable A4 PDF')}>
          <i className="mdi mdi-file-pdf-box" /> PDF (A4)
        </button>
      </div>

      <CanvasSearch objects={p.searchObjects} onPick={p.onSearchPick} />

      {p.impactName && (
        <span className="nsc-impact-chip">
          <i className="mdi mdi-lightning-bolt" /> {t('Impact: failure of')} <strong>{p.impactName}</strong>
          <button type="button" className="btn-close btn-close-sm" aria-label={t('End impact analysis')} onClick={p.onClearImpact} />
        </span>
      )}

      <div className="ms-auto d-flex align-items-center gap-2">
        {p.canEditLayout && !p.readOnly && (
          <>
            <span className={`small ${save.cls}`}>
              <i className={`mdi ${save.icon}`} /> {t(save.text)}
            </span>
            <div className="form-check form-switch mb-0" title={t('Save layout automatically')}>
              <input className="form-check-input" type="checkbox" id="nsc-autosave" checked={p.autosave} onChange={p.onToggleAutosave} />
              <label className="form-check-label small" htmlFor="nsc-autosave">Autosave</label>
            </div>
            {!p.autosave && (
              <button type="button" className="btn btn-sm btn-primary" disabled={p.saveState === 'saved' || p.saveState === 'saving'} onClick={p.onSave}>
                <i className="mdi mdi-content-save-outline" /> {t('Save')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
