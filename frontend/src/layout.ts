import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import { type CanvasEdge, type CanvasNode, isGroupNode, isNoteNode, nodeSize, snap } from './graph';

const GROUP_PADDING = '[top=50,left=30,bottom=30,right=30]';

/**
 * Automatic layout with ELK (layered, left to right). Groups are laid out as compound nodes, so their members stay
 * inside. Notes keep their position. elkjs is loaded lazily (separate chunk) because it is large and only needed on demand.
 */
export async function autoLayout(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  grid: number,
  direction: 'RIGHT' | 'DOWN' = 'RIGHT',
): Promise<CanvasNode[]> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();

  const children = new Map<string, ElkNode[]>();
  const top: ElkNode[] = [];
  for (const n of nodes) {
    if (isNoteNode(n)) continue;
    const size = nodeSize(n);
    const elkNode: ElkNode = isGroupNode(n)
      ? { id: n.id, layoutOptions: { 'elk.padding': GROUP_PADDING }, children: [] }
      : { id: n.id, width: size.width, height: size.height };
    if (n.parentId) {
      if (!children.has(n.parentId)) children.set(n.parentId, []);
      children.get(n.parentId)!.push(elkNode);
    } else {
      top.push(elkNode);
    }
  }
  for (const node of top) {
    if (children.has(node.id)) node.children = children.get(node.id);
    else if (node.children && !node.children.length) {
      // empty group: keep its size
      const n = nodes.find((x) => x.id === node.id)!;
      const size = nodeSize(n);
      node.width = size.width;
      node.height = size.height;
      delete node.children;
    }
  }

  const ids = new Set(nodes.filter((n) => !isNoteNode(n)).map((n) => n.id));
  const elkEdges: ElkExtendedEdge[] = edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    // "runs on" edges point from the service to its host; reversed, hosts end up left of their services
    .map((e) => ({
      id: e.id,
      sources: [e.data?.kind === 'runs_on' ? e.target : e.source],
      targets: [e.data?.kind === 'runs_on' ? e.source : e.target],
    }));

  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '40',
      'elk.spacing.componentComponent': '60',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    },
    children: top,
    edges: elkEdges,
  });

  const positions = new Map<string, { x: number; y: number; width?: number; height?: number }>();
  const walk = (list: ElkNode[] | undefined) => {
    for (const c of list ?? []) {
      positions.set(c.id, { x: c.x ?? 0, y: c.y ?? 0, width: c.width, height: c.height });
      walk(c.children);
    }
  };
  walk(result.children);

  return nodes.map((n) => {
    const p = positions.get(n.id);
    if (!p) return n;
    const position = { x: snap(p.x, grid), y: snap(p.y, grid) };
    if (isGroupNode(n) && p.width && p.height) {
      const width = snap(p.width, grid);
      const height = snap(p.height, grid);
      return { ...n, position, width, height, style: { ...n.style, width, height } };
    }
    return { ...n, position };
  });
}
