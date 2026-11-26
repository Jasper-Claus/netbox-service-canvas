import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import type { ObjectNode as ObjectNodeType } from '../graph';
import { useEditor } from '../context';
import { t } from '../i18n';

export const NODE_ICONS: Record<string, string> = {
  device: 'mdi-server',
  virtualmachine: 'mdi-monitor',
  service: 'mdi-cog-outline',
  application: 'mdi-apps',
};

export const NODE_TYPE_LABELS: Record<string, string> = {
  device: 'Device',
  virtualmachine: 'VM',
  service: 'Service',
  application: 'App',
};

/** NetBox color names (ColorChoices) used by status choices, mapped to Tabler CSS variables. */
export function statusColorVar(color: string | null | undefined): string {
  if (!color) return 'var(--tblr-secondary, #9aa0ac)';
  if (/^[0-9a-f]{6}$/i.test(color)) return `#${color}`;
  return `var(--tblr-${color}, ${color})`;
}

function ObjectNodeComponent({ data, selected }: NodeProps<ObjectNodeType>) {
  const { readOnly, perms, removeNode } = useEditor();
  const desc = data.desc;
  const removable = !readOnly && perms.edit_layout;
  const toolbar = removable && (
    <NodeToolbar isVisible={selected} position={Position.Top} align="end" className="nsc-group-toolbar nsc-node-toolbar">
      <button type="button" className="btn btn-sm btn-ghost-danger" title={t('Remove from this canvas (Del). The object stays in NetBox.')} onClick={() => removeNode(data.key)}>
        <i className="mdi mdi-close-circle-outline" /> {t('Remove')}
      </button>
    </NodeToolbar>
  );
  const connectable = !readOnly && (perms.add_connection || perms.change_service);
  const impactClass = data.impact ? ` nsc-impact-${data.impact}` : '';

  if (!desc) {
    return (
      <div className={`nsc-node nsc-node-missing${selected ? ' selected' : ''}${impactClass}`} title={data.key}>
        {toolbar}
        <Handle type="target" position={Position.Left} isConnectable={false} />
        <div className="nsc-node-head">
          <i className="mdi mdi-help-circle-outline" />
          <span className="nsc-node-name">{t('Not available')}</span>
        </div>
        <div className="nsc-node-sub">{data.key}: {t('deleted or no permission')}</div>
        <Handle type="source" position={Position.Right} isConnectable={false} />
      </div>
    );
  }

  const ports = desc.service?.ports?.length
    ? `${desc.service.protocol_label} ${desc.service.ports.join(', ')}`
    : null;
  const app = desc.application;

  return (
    <div
      className={`nsc-node nsc-node-${desc.type}${selected ? ' selected' : ''}${data.focused ? ' focused' : ''}${impactClass}`}
      style={{ ['--nsc-status' as string]: statusColorVar(desc.status?.color) }}
      title={desc.status ? t('Status: {status}. Click for details', { status: desc.status.label }) : t('Click for details')}
    >
      {toolbar}
      <Handle type="target" position={Position.Left} isConnectable={connectable} />
      <div className="nsc-node-head">
        <i className={`mdi ${desc.application?.icon || NODE_ICONS[desc.type] || 'mdi-shape-outline'}`} />
        <span className="nsc-node-name" title={desc.name}>{desc.name}</span>
        <span className="nsc-node-type">{NODE_TYPE_LABELS[desc.type]}</span>
      </div>
      <div className="nsc-node-sub">
        {ports && <span className="nsc-node-ports">{ports}</span>}
        {app?.version && <span>v{app.version}</span>}
        {app?.web_url && (
          <a className="nodrag text-truncate" href={app.web_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            <i className="mdi mdi-open-in-new" /> {app.web_url.replace(/^https?:\/\//i, '')}
          </a>
        )}
        {desc.primary_ip && <span className="font-monospace">{desc.primary_ip}</span>}
        {desc.subtitle && !app && <span className="text-truncate">{desc.subtitle}</span>}
      </div>
      {data.impact === 'root' && <span className="nsc-impact-badge"><i className="mdi mdi-lightning-bolt" /> {t('Failure')}</span>}
      <Handle type="source" position={Position.Right} isConnectable={connectable} />
    </div>
  );
}

export const ObjectNode = memo(ObjectNodeComponent);
