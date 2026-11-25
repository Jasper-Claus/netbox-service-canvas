import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api';
import { DIRECTIONS, HOP_TYPES, PROTOCOLS, STATUSES } from '../choices';
import { useEditor } from '../context';
import type { Flow, Hop, ObjectDescriptor } from '../types';
import { ObjectPicker } from './ObjectPicker';
import { t } from '../i18n';

interface Props {
  flow: Flow;
  source: ObjectDescriptor | null;
  target: ObjectDescriptor | null;
  onClose: () => void;
  /** Reload the graph after the connection was changed or deleted. */
  onChanged: () => void;
}

const HOP_TYPE_TITLE: Record<string, string> = Object.fromEntries(HOP_TYPES.map((ty) => [ty.label, ty.title]));

function SortableHop({ hop, canMove, canDelete, onDelete }: {
  hop: Hop;
  canMove: boolean;
  canDelete: boolean;
  onDelete: (hop: Hop) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: hop.id,
    disabled: !canMove,
  });
  return (
    <li
      ref={setNodeRef}
      className={`list-group-item nsc-hop${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {canMove && (
        <span className="nsc-hop-handle" {...attributes} {...listeners} title={t('Drag to reorder')}>
          <i className="mdi mdi-drag-vertical" />
        </span>
      )}
      <div className="flex-grow-1 text-truncate">
        <span className="badge text-bg-secondary me-1">{HOP_TYPE_TITLE[hop.object_type] ? t(HOP_TYPE_TITLE[hop.object_type]) : hop.object_type}</span>
        {hop.object?.display_url || hop.object?.url ? (
          <a href={hop.object.display_url ?? hop.object.url} target="_blank" rel="noreferrer">{hop.object.display}</a>
        ) : (
          <span>{hop.object?.display ?? `#${hop.object_id}`}</span>
        )}
        {hop.note && <div className="small text-muted text-truncate">{hop.note}</div>}
      </div>
      {canDelete && (
        <button type="button" className="btn btn-sm btn-ghost-danger" title={t('Remove hop')} onClick={() => onDelete(hop)}>
          <i className="mdi mdi-close" />
        </button>
      )}
    </li>
  );
}

export function EdgePanel({ flow, source, target, onClose, onChanged }: Props) {
  const { api, perms, readOnly, notify } = useEditor();
  const canChange = !readOnly && perms.change_connection;
  const canDelete = !readOnly && perms.delete_connection;
  const canAddHop = !readOnly && perms.add_hop;
  const canMoveHop = !readOnly && perms.change_hop;
  const canDeleteHop = !readOnly && perms.delete_hop;

  const [form, setForm] = useState({
    protocol: flow.protocol,
    port: flow.port ? String(flow.port) : '',
    direction: flow.direction as string,
    status: flow.status as string,
    data_description: flow.data_description,
    description: flow.description,
  });
  const [hops, setHops] = useState<Hop[]>([]);
  const [hopError, setHopError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newHop, setNewHop] = useState<{ label: string; id: number | null }>({ label: 'ipam.vrf', id: null });
  const [newHopNote, setNewHopNote] = useState('');
  const [addingHop, setAddingHop] = useState(false);

  useEffect(() => {
    setForm({
      protocol: flow.protocol,
      port: flow.port ? String(flow.port) : '',
      direction: flow.direction,
      status: flow.status,
      data_description: flow.data_description,
      description: flow.description,
    });
    setError(null);
  }, [flow]);

  const loadHops = useCallback(() => {
    api.hops(flow.id)
      .then((data) => {
        setHops([...data.results].sort((a, b) => a.order - b.order));
        setHopError(null);
      })
      .catch((e: Error) => setHopError(e.message));
  }, [api, flow.id]);

  useEffect(loadHops, [loadHops]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const portNumber = form.port ? Number(form.port) : null;
  const portValid = portNumber === null || (Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535);
  const dirty = form.protocol !== flow.protocol || (portNumber ?? null) !== (flow.port ?? null)
    || form.direction !== flow.direction || form.status !== flow.status
    || form.data_description !== flow.data_description || form.description !== flow.description;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.updateConnection(flow.id, { ...form, port: portNumber });
      notify(t('Connection saved.'), 'success');
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('Delete this connection in NetBox? This affects all canvases.'))) return;
    setBusy(true);
    try {
      await api.deleteConnection(flow.id);
      notify(t('Connection deleted.'), 'success');
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setBusy(false);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = hops.findIndex((h) => h.id === active.id);
    const newIndex = hops.findIndex((h) => h.id === over.id);
    const previous = hops;
    const reordered = arrayMove(hops, oldIndex, newIndex);
    setHops(reordered);
    try {
      const saved = await api.reorderHops(flow.id, reordered.map((h) => h.id));
      setHops(saved);
      setHopError(null);
    } catch (e) {
      setHops(previous);
      setHopError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const addHop = async () => {
    if (newHop.id === null) return;
    setAddingHop(true);
    try {
      await api.addHop(flow.id, newHop.label, newHop.id, newHopNote.trim());
      setNewHop({ label: newHop.label, id: null });
      setNewHopNote('');
      loadHops();
      onChanged();
    } catch (e) {
      setHopError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setAddingHop(false);
    }
  };

  const deleteHop = async (hop: Hop) => {
    try {
      await api.deleteHop(hop.id);
      loadHops();
      onChanged();
    } catch (e) {
      setHopError(e instanceof ApiError ? e.message : String(e));
    }
  };

  return (
    <aside className="nsc-panel">
      <div className="nsc-panel-head">
        <h6 className="mb-0">
          <a href={flow.url} target="_blank" rel="noreferrer">{t('Connection #{id}', { id: flow.id })}</a>
        </h6>
        <button type="button" className="btn-close" aria-label={t('Close')} onClick={onClose} />
      </div>
      <div className="nsc-panel-body">
        <p className="small mb-2">
          <strong>{source?.name ?? flow.source}</strong>{' '}
          <i className={`mdi ${form.direction === 'bi' ? 'mdi-arrow-left-right' : 'mdi-arrow-right'}`} />{' '}
          <strong>{target?.name ?? flow.target}</strong>
        </p>

        <fieldset disabled={!canChange || busy}>
          <div className="row g-2 mb-2">
            <div className="col-7">
              <label className="form-label small" htmlFor="nsc-edge-protocol">{t('Protocol')}</label>
              <select id="nsc-edge-protocol" className="form-select form-select-sm" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
                {PROTOCOLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-5">
              <label className="form-label small" htmlFor="nsc-edge-port">Port</label>
              <input
                id="nsc-edge-port"
                type="number"
                className={`form-control form-control-sm${portValid ? '' : ' is-invalid'}`}
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
              />
            </div>
          </div>
          <div className="row g-2 mb-2">
            <div className="col-7">
              <label className="form-label small" htmlFor="nsc-edge-direction">{t('Direction')}</label>
              <select id="nsc-edge-direction" className="form-select form-select-sm" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                {DIRECTIONS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
              </select>
            </div>
            <div className="col-5">
              <label className="form-label small" htmlFor="nsc-edge-status">Status</label>
              <select id="nsc-edge-status" className="form-select form-select-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-2">
            <label className="form-label small" htmlFor="nsc-edge-data">{t('Data')}</label>
            <input id="nsc-edge-data" className="form-control form-control-sm" maxLength={200} value={form.data_description} onChange={(e) => setForm({ ...form, data_description: e.target.value })} />
          </div>
          <div className="mb-2">
            <label className="form-label small" htmlFor="nsc-edge-description">{t('Description')}</label>
            <input id="nsc-edge-description" className="form-control form-control-sm" maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </fieldset>
        {error && <div className="alert alert-danger py-1 small">{error}</div>}
        {(canChange || canDelete) && (
          <div className="d-flex gap-2 mb-3">
            {canChange && (
              <button type="button" className="btn btn-sm btn-primary" disabled={!dirty || !portValid || busy} onClick={save}>
                {t('Save')}
              </button>
            )}
            {canDelete && (
              <button type="button" className="btn btn-sm btn-outline-danger ms-auto" disabled={busy} onClick={remove}>
                <i className="mdi mdi-trash-can-outline" /> {t('Delete')}
              </button>
            )}
          </div>
        )}

        <h6 className="small text-uppercase text-muted">{t('Intermediate stations (hops)')}</h6>
        {hopError && <div className="alert alert-danger py-1 small">{hopError}</div>}
        {hops.length === 0 && <div className="text-muted small mb-2">{t('None, direct connection.')}</div>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={hops.map((h) => h.id)} strategy={verticalListSortingStrategy}>
            <ol className="list-group list-group-numbered mb-2">
              {hops.map((hop) => (
                <SortableHop key={hop.id} hop={hop} canMove={canMoveHop} canDelete={canDeleteHop} onDelete={deleteHop} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        {canAddHop && (
          <div className="nsc-hop-add">
            <ObjectPicker types={HOP_TYPES} value={newHop} onChange={setNewHop} idPrefix="nsc-hop" compact />
            <input
              className="form-control form-control-sm mt-1"
              placeholder={t('Note (optional)')}
              maxLength={200}
              value={newHopNote}
              onChange={(e) => setNewHopNote(e.target.value)}
            />
            <button type="button" className="btn btn-sm btn-outline-primary mt-1 w-100" disabled={newHop.id === null || addingHop} onClick={addHop}>
              <i className="mdi mdi-plus" /> {t('Add hop')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
