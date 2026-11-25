import { NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react';
import { memo, useEffect, useState } from 'react';
import type { NoteNode as NoteNodeType } from '../graph';
import { useEditor } from '../context';
import { t } from '../i18n';

export const NOTE_COLORS = ['ffe082', 'ffccbc', 'c8e6c9', 'bbdefb', 'e1bee7', 'eeeeee'];

/** Sticky note on the canvas: double-click to edit, resizable, colour and delete via toolbar. */
function NoteNodeComponent({ id, data, selected }: NodeProps<NoteNodeType>) {
  const { readOnly, perms, updateNote, deleteNote, grid } = useEditor();
  const editable = !readOnly && perms.edit_notes;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.text);
  useEffect(() => {
    if (!editing) setText(data.text);
  }, [data.text, editing]);

  const commit = () => {
    setEditing(false);
    if (text !== data.text) updateNote(id, { text });
  };

  return (
    <div
      className={`nsc-note${selected ? ' selected' : ''}`}
      style={{ ['--nsc-note-color' as string]: `#${data.color}` }}
      onDoubleClick={() => editable && setEditing(true)}
      title={editable && !editing ? t('Double-click to edit') : undefined}
    >
      <NodeResizer
        isVisible={editable && selected}
        minWidth={120}
        minHeight={60}
        shouldResize={() => editable}
        onResizeEnd={(_, p) => updateNote(id, {
          width: Math.max(120, Math.round(p.width / grid) * grid),
          height: Math.max(60, Math.round(p.height / grid) * grid),
        })}
      />
      {editable && (
        <NodeToolbar isVisible={selected && !editing} position={Position.Top} align="start" className="nsc-group-toolbar">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`nsc-swatch${c === data.color ? ' active' : ''}`}
              style={{ background: `#${c}` }}
              title={`#${c}`}
              onClick={() => updateNote(id, { color: c })}
            />
          ))}
          <button type="button" className="btn btn-sm btn-ghost-secondary" title={t('Edit text')} onClick={() => setEditing(true)}>
            <i className="mdi mdi-pencil" />
          </button>
          <button type="button" className="btn btn-sm btn-ghost-danger" title={t('Delete note')} onClick={() => deleteNote(id)}>
            <i className="mdi mdi-trash-can-outline" />
          </button>
        </NodeToolbar>
      )}
      {editing ? (
        <textarea
          className="nsc-note-input nodrag nowheel"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setText(data.text);
              setEditing(false);
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit();
            e.stopPropagation();
          }}
        />
      ) : (
        <div className="nsc-note-text">
          {data.text || <span className="nsc-note-placeholder">{editable ? t('Double-click to write…') : ''}</span>}
        </div>
      )}
    </div>
  );
}

export const NoteNode = memo(NoteNodeComponent);
