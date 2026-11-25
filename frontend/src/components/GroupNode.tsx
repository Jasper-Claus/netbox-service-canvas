import { NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react';
import { memo, useState } from 'react';
import type { GroupNode as GroupNodeType } from '../graph';
import { useEditor } from '../context';
import { t } from '../i18n';

export const GROUP_COLORS = ['607d8b', '2196f3', '4caf50', 'ff9800', 'f44336', '9c27b0', '00bcd4', '795548'];

function GroupNodeComponent({ id, data, selected }: NodeProps<GroupNodeType>) {
  const { readOnly, perms, updateGroup, deleteGroup, grid } = useEditor();
  const editable = !readOnly && perms.edit_groups;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(data.name);
  const color = `#${data.color}`;

  const commit = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== data.name) updateGroup(id, { name: trimmed });
    else setName(data.name);
  };

  return (
    <div className="nsc-group" style={{ ['--nsc-group-color' as string]: color }}>
      <NodeResizer
        isVisible={editable && selected}
        minWidth={120}
        minHeight={80}
        color={color}
        keepAspectRatio={false}
        shouldResize={() => editable}
        // snap resized groups to the grid as well
        onResizeEnd={(_, p) => updateGroup(id, {
          width: Math.max(120, Math.round(p.width / grid) * grid),
          height: Math.max(80, Math.round(p.height / grid) * grid),
        })}
      />
      {editable && (
        <NodeToolbar isVisible={selected} position={Position.Top} align="start" className="nsc-group-toolbar">
          {GROUP_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`nsc-swatch${c === data.color ? ' active' : ''}`}
              style={{ background: `#${c}` }}
              title={`#${c}`}
              onClick={() => updateGroup(id, { color: c })}
            />
          ))}
          <button type="button" className="btn btn-sm btn-ghost-danger" title={t('Remove group')} onClick={() => deleteGroup(id)}>
            <i className="mdi mdi-trash-can-outline" />
          </button>
        </NodeToolbar>
      )}
      <div className="nsc-group-label">
        {editing ? (
          <input
            className="form-control form-control-sm nodrag"
            autoFocus
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setName(data.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span
            onDoubleClick={() => editable && setEditing(true)}
            title={editable ? t('Double-click to rename') : undefined}
          >
            {data.name}
          </span>
        )}
      </div>
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
