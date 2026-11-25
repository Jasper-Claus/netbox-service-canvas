import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import type { ObjectNode as ObjectNodeType } from '../graph';
import { useEditor } from '../context';

const ICONS: Record<string, string> = {
  device: 'mdi-server',
  virtualmachine: 'mdi-monitor',
  service: 'mdi-cog-outline',
};

const TYPE_LABELS: Record<string, string> = {
  device: 'Device',
  virtualmachine: 'VM',
  service: 'Service',
};

/** NetBox color names (ColorChoices) used by status choices, mapped to Tabler CSS variables. */
export function statusColorVar(color: string | null | undefined): string {
  if (!color) return 'var(--tblr-secondary, #9aa0ac)';
  if (/^[0-9a-f]{6}$/i.test(color)) return `#${color}`;
  return `var(--tblr-${color}, ${color})`;
}

function ObjectNodeComponent({ data, selected }: NodeProps<ObjectNodeType>) {
  const { readOnly, perms } = useEditor();
  const desc = data.desc;
  const connectable = !readOnly && (perms.add_connection || perms.change_service);

  if (!desc) {
    return (
      <div className={`nsc-node nsc-node-missing${selected ? ' selected' : ''}`} title={data.key}>
        <Handle type="target" position={Position.Left} isConnectable={false} />
        <div className="nsc-node-head">
          <i className="mdi mdi-help-circle-outline" />
          <span className="nsc-node-name">Nicht verfügbar</span>
        </div>
        <div className="nsc-node-sub">{data.key} – gelöscht oder keine Berechtigung</div>
        <Handle type="source" position={Position.Right} isConnectable={false} />
      </div>
    );
  }

  const ports = desc.service?.ports?.length
    ? `${desc.service.protocol_label} ${desc.service.ports.join(', ')}`
    : null;

  return (
    <div
      className={`nsc-node nsc-node-${desc.type}${selected ? ' selected' : ''}${data.focused ? ' focused' : ''}`}
      style={{ ['--nsc-status' as string]: statusColorVar(desc.status?.color) }}
      title={desc.status ? `Status: ${desc.status.label}` : undefined}
    >
      <Handle type="target" position={Position.Left} isConnectable={connectable} />
      <div className="nsc-node-head">
        <i className={`mdi ${ICONS[desc.type] ?? 'mdi-shape-outline'}`} />
        <a className="nsc-node-name nodrag" href={desc.url} target="_blank" rel="noreferrer" title={desc.name}>
          {desc.name}
        </a>
        <span className="nsc-node-type">{TYPE_LABELS[desc.type]}</span>
      </div>
      <div className="nsc-node-sub">
        {ports && <span className="nsc-node-ports">{ports}</span>}
        {desc.primary_ip && <span className="font-monospace">{desc.primary_ip}</span>}
        {desc.subtitle && <span className="text-truncate">{desc.subtitle}</span>}
      </div>
      <Handle type="source" position={Position.Right} isConnectable={connectable} />
    </div>
  );
}

export const ObjectNode = memo(ObjectNodeComponent);
