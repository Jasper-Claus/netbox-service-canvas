/**
 * Pure helpers (no React) for converting between the backend layout, React Flow nodes/edges and the
 * diff-only layout payload. Covered by graph.test.ts.
 */
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type {
  Flow,
  GraphEdges,
  GraphResponse,
  LayoutPayload,
  ObjectDescriptor,
  PartOf,
  RunsOn,
  SnapGroup,
  SnapNode,
  SnapNote,
  Snapshot,
} from './types';

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 64;
export const GROUP_PREFIX = 'group:';
export const NOTE_PREFIX = 'note:';
export const NOTE_WIDTH = 220;
export const NOTE_HEIGHT = 140;

export type ObjectNodeData = {
  kind: 'object';
  key: string;
  dbId: number | null;
  desc: ObjectDescriptor | null;
  focused?: boolean;
};

export type GroupNodeData = {
  kind: 'group';
  clientKey: string;
  dbId: number | null;
  name: string;
  color: string;
};

export type NoteNodeData = {
  kind: 'note';
  clientKey: string;
  dbId: number | null;
  text: string;
  color: string;
};

/** Impact analysis highlight of a node: the analysed object, directly or indirectly affected, or unaffected. */
export type ImpactRole = 'root' | 'direct' | 'indirect' | 'none';

export type ObjectNode = Node<ObjectNodeData & { impact?: ImpactRole }, 'object'>;
export type GroupNode = Node<GroupNodeData, 'group'>;
export type NoteNode = Node<NoteNodeData, 'note'>;
export type CanvasNode = ObjectNode | GroupNode | NoteNode;

export type FlowEdgeData =
  | { kind: 'flow'; flow: Flow }
  | { kind: 'runs_on'; runsOn: RunsOn }
  | { kind: 'part_of'; partOf: PartOf };
export type CanvasEdge = Edge<FlowEdgeData>;

// ---------------------------------------------------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------------------------------------------------

export function makeKey(label: string, id: number): string {
  return `${label}:${id}`;
}

export function parseKey(key: string): { label: string; id: number } | null {
  const i = key.lastIndexOf(':');
  if (i <= 0) return null;
  const id = Number(key.slice(i + 1));
  if (!Number.isInteger(id) || id <= 0) return null;
  return { label: key.slice(0, i), id };
}

export function groupNodeId(clientKey: string): string {
  return GROUP_PREFIX + clientKey;
}

export function isGroupNode(node: CanvasNode): node is GroupNode {
  return node.type === 'group';
}

export function isObjectNode(node: CanvasNode): node is ObjectNode {
  return node.type === 'object';
}

export function isNoteNode(node: CanvasNode): node is NoteNode {
  return node.type === 'note';
}

export function noteNodeId(clientKey: string): string {
  return NOTE_PREFIX + clientKey;
}

export const APPLICATION_LABEL = 'netbox_service_canvas.application';

export const LABEL_TO_TYPE: Record<string, ObjectDescriptor['type']> = {
  'dcim.device': 'device',
  'virtualization.virtualmachine': 'virtualmachine',
  'ipam.service': 'service',
  [APPLICATION_LABEL]: 'application',
};

// ---------------------------------------------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------------------------------------------

export function snap(value: number, grid: number): number {
  if (!grid) return Math.round(value * 100) / 100;
  return Math.round(value / grid) * grid;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function nodeSize(node: CanvasNode): { width: number; height: number } {
  // Explicit sizes (groups) win over measured ones, which lag one render behind after a resize or auto-layout
  const width = node.width ?? (node.style?.width as number | undefined) ?? node.measured?.width ?? NODE_WIDTH;
  const height = node.height ?? (node.style?.height as number | undefined) ?? node.measured?.height ?? NODE_HEIGHT;
  return { width, height };
}

/** Absolute position of a node, following its parent chain. */
export function absolutePosition(node: CanvasNode, byId: Map<string, CanvasNode>): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent) {
    x += parent.position.x;
    y += parent.position.y;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return { x, y };
}

export function containsCenter(group: Rect, node: Rect): boolean {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  return cx >= group.x && cx <= group.x + group.width && cy >= group.y && cy <= group.y + group.height;
}

/**
 * React Flow requires parents to precede their children in the node array.
 */
export function sortParentsFirst<T extends CanvasNode>(nodes: T[]): T[] {
  return [...nodes].sort((a, b) => Number(isObjectNode(a)) - Number(isObjectNode(b)));
}

/**
 * Re-parent a node into (or out of) a group, keeping its absolute position.
 */
export function reparent(nodes: CanvasNode[], nodeId: string, groupId: string | null): CanvasNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const node = byId.get(nodeId);
  if (!node || (node.parentId ?? null) === groupId) return nodes;
  const abs = absolutePosition(node, byId);
  let position = abs;
  if (groupId) {
    const group = byId.get(groupId);
    if (!group) return nodes;
    const gAbs = absolutePosition(group, byId);
    position = { x: abs.x - gAbs.x, y: abs.y - gAbs.y };
  }
  return sortParentsFirst(
    nodes.map((n) =>
      n.id === nodeId ? ({ ...n, position, parentId: groupId ?? undefined, extent: undefined } as CanvasNode) : n,
    ),
  );
}

/** Find the group whose area contains the centre of the given (absolute) node rect. Smallest group wins. */
export function findGroupAt(nodes: CanvasNode[], rect: Rect): GroupNode | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let best: GroupNode | null = null;
  let bestArea = Infinity;
  for (const n of nodes) {
    if (!isGroupNode(n)) continue;
    const pos = absolutePosition(n, byId);
    const size = nodeSize(n);
    const area = size.width * size.height;
    if (containsCenter({ ...pos, ...size }, rect) && area < bestArea) {
      best = n;
      bestArea = area;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------------
// Backend -> React Flow
// ---------------------------------------------------------------------------------------------------------------------

let groupCounter = 0;
export function newGroupKey(): string {
  groupCounter += 1;
  return `new-${Date.now().toString(36)}-${groupCounter}`;
}

export function groupKeyForDb(id: number): string {
  return `db-${id}`;
}

/** Client keys of notes share the generator of groups; both only need to be unique within the page. */
export const newNoteKey = newGroupKey;
export const noteKeyForDb = groupKeyForDb;

export function buildNodes(graph: GraphResponse, grid: number): CanvasNode[] {
  const groups: GroupNode[] = graph.groups.map((g) => ({
    id: groupNodeId(groupKeyForDb(g.id)),
    type: 'group',
    position: { x: g.x, y: g.y },
    style: { width: g.width, height: g.height },
    width: g.width,
    height: g.height,
    zIndex: -1,
    data: { kind: 'group', clientKey: groupKeyForDb(g.id), dbId: g.id, name: g.name, color: g.color },
  }));
  const objects: ObjectNode[] = graph.nodes.map((n) => {
    const key = makeKey(n.object_type, n.object_id);
    return {
      id: key,
      type: 'object',
      position: { x: snap(n.x, grid), y: snap(n.y, grid) },
      parentId: n.group ? groupNodeId(groupKeyForDb(n.group)) : undefined,
      data: { kind: 'object', key, dbId: n.id, desc: graph.objects[key] ?? null },
    };
  });
  const notes: NoteNode[] = (graph.notes ?? []).map((n) => ({
    id: noteNodeId(noteKeyForDb(n.id)),
    type: 'note',
    position: { x: n.x, y: n.y },
    style: { width: n.width, height: n.height },
    width: n.width,
    height: n.height,
    data: { kind: 'note', clientKey: noteKeyForDb(n.id), dbId: n.id, text: n.text, color: n.color },
  }));
  return [...groups, ...notes, ...objects];
}

const STATUS_COLORS: Record<string, string> = {
  active: '#2fb344',
  planned: '#17a2b8',
  disabled: '#9aa0ac',
};

export function flowLabel(flow: Flow): string {
  const parts = [flow.protocol_label || flow.protocol.toUpperCase()];
  if (flow.port) parts.push(String(flow.port));
  let label = parts.join(' ');
  if (flow.data_description) label += ` · ${flow.data_description}`;
  return label;
}

export function flowEdge(flow: Flow): CanvasEdge {
  const color = STATUS_COLORS[flow.status] ?? STATUS_COLORS.active;
  const marker = { type: MarkerType.ArrowClosed, color, width: 18, height: 18 };
  return {
    id: `flow:${flow.id}`,
    source: flow.source,
    target: flow.target,
    type: 'default',
    label: flowLabel(flow),
    className: `nsc-edge-flow nsc-edge-${flow.status}`,
    style: {
      stroke: color,
      strokeWidth: 2,
      strokeDasharray: flow.status === 'planned' ? '6 4' : flow.status === 'disabled' ? '2 4' : undefined,
    },
    markerEnd: marker,
    markerStart: flow.direction === 'bi' ? marker : undefined,
    animated: false,
    deletable: false,
    data: { kind: 'flow', flow },
  };
}

export function runsOnEdge(r: RunsOn): CanvasEdge {
  return {
    id: r.id,
    source: r.source,
    target: r.target,
    type: 'straight',
    className: 'nsc-edge-runs-on',
    style: { strokeDasharray: '4 4', strokeWidth: 1.5 },
    selectable: false,
    focusable: false,
    deletable: false,
    data: { kind: 'runs_on', runsOn: r },
  };
}

export function partOfEdge(p: PartOf): CanvasEdge {
  return {
    id: p.id,
    source: p.source,
    target: p.target,
    type: 'straight',
    className: 'nsc-edge-part-of',
    style: { strokeDasharray: '1 5', strokeWidth: 2.5, strokeLinecap: 'round' },
    selectable: false,
    focusable: false,
    deletable: false,
    data: { kind: 'part_of', partOf: p },
  };
}

export function buildEdges(
  edges: GraphEdges,
  present: Set<string>,
  options: { showRunsOn: boolean } = { showRunsOn: true },
): CanvasEdge[] {
  const result: CanvasEdge[] = [];
  if (options.showRunsOn) {
    for (const r of edges.runs_on) {
      if (present.has(r.source) && present.has(r.target)) result.push(runsOnEdge(r));
    }
    for (const p of edges.part_of ?? []) {
      if (present.has(p.source) && present.has(p.target)) result.push(partOfEdge(p));
    }
  }
  for (const f of edges.flows) {
    if (present.has(f.source) && present.has(f.target)) result.push(flowEdge(f));
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------
// Layout snapshot & diff
// ---------------------------------------------------------------------------------------------------------------------

export function snapshotFromNodes(nodes: CanvasNode[], grid: number): Snapshot {
  const snapshot: Snapshot = { nodes: {}, groups: {}, notes: {} };
  for (const n of nodes) {
    if (!isNoteNode(n)) continue;
    const size = nodeSize(n);
    snapshot.notes[n.data.clientKey] = {
      clientKey: n.data.clientKey,
      dbId: n.data.dbId,
      text: n.data.text,
      color: n.data.color,
      x: snap(n.position.x, grid),
      y: snap(n.position.y, grid),
      width: snap(size.width, grid),
      height: snap(size.height, grid),
    };
  }
  const groupKeyById = new Map<string, string>();
  for (const n of nodes) {
    if (!isGroupNode(n)) continue;
    const size = nodeSize(n);
    groupKeyById.set(n.id, n.data.clientKey);
    snapshot.groups[n.data.clientKey] = {
      clientKey: n.data.clientKey,
      dbId: n.data.dbId,
      name: n.data.name,
      color: n.data.color,
      x: snap(n.position.x, grid),
      y: snap(n.position.y, grid),
      width: snap(size.width, grid),
      height: snap(size.height, grid),
    };
  }
  for (const n of nodes) {
    if (!isObjectNode(n)) continue;
    snapshot.nodes[n.data.key] = {
      key: n.data.key,
      dbId: n.data.dbId,
      x: snap(n.position.x, grid),
      y: snap(n.position.y, grid),
      width: null,
      height: null,
      groupKey: n.parentId ? (groupKeyById.get(n.parentId) ?? null) : null,
    };
  }
  return snapshot;
}

function sameGroup(a: SnapGroup, b: SnapGroup): boolean {
  return a.name === b.name && a.color === b.color && a.x === b.x && a.y === b.y && a.width === b.width
    && a.height === b.height;
}

function sameNote(a: SnapNote, b: SnapNote): boolean {
  return a.text === b.text && a.color === b.color && a.x === b.x && a.y === b.y && a.width === b.width
    && a.height === b.height;
}

function sameNode(a: SnapNode, b: SnapNode): boolean {
  return a.x === b.x && a.y === b.y && a.groupKey === b.groupKey && a.width === b.width && a.height === b.height;
}

/**
 * Compute the minimal layout payload that turns `saved` into `current`. Returns null when nothing changed.
 */
export function diffLayout(saved: Snapshot, current: Snapshot): LayoutPayload | null {
  const payload: LayoutPayload = {
    groups: [], nodes: [], notes: [], deleted_nodes: [], deleted_groups: [], deleted_notes: [],
  };

  for (const n of Object.values(current.notes ?? {})) {
    const before = saved.notes?.[n.clientKey];
    if (before && before.dbId !== null && sameNote(before, n)) continue;
    const item: Record<string, unknown> = {
      text: n.text, color: n.color, x: n.x, y: n.y, width: n.width, height: n.height,
    };
    if (n.dbId !== null) item.id = n.dbId;
    else item.key = n.clientKey;
    payload.notes.push(item);
  }
  for (const n of Object.values(saved.notes ?? {})) {
    if (!current.notes?.[n.clientKey] && n.dbId !== null) payload.deleted_notes.push(n.dbId);
  }

  for (const g of Object.values(current.groups)) {
    const before = saved.groups[g.clientKey];
    if (before && before.dbId !== null && sameGroup(before, g)) continue;
    const item: Record<string, unknown> = {
      name: g.name, color: g.color, x: g.x, y: g.y, width: g.width, height: g.height,
    };
    if (g.dbId !== null) item.id = g.dbId;
    else item.key = g.clientKey;
    payload.groups.push(item);
  }
  for (const g of Object.values(saved.groups)) {
    if (!current.groups[g.clientKey] && g.dbId !== null) payload.deleted_groups.push(g.dbId);
  }

  for (const n of Object.values(current.nodes)) {
    const before = saved.nodes[n.key];
    // A node whose group was just deleted must be re-sent even if the numbers look equal
    const groupGone = before?.groupKey && !current.groups[before.groupKey];
    if (before && before.dbId !== null && n.dbId !== null && sameNode(before, n) && !groupGone) continue;
    const item: Record<string, unknown> = { x: n.x, y: n.y };
    if (n.dbId !== null) {
      item.id = n.dbId;
    } else {
      const parsed = parseKey(n.key);
      if (!parsed) continue;
      item.object_type = parsed.label;
      item.object_id = parsed.id;
    }
    if (n.groupKey) {
      const group = current.groups[n.groupKey];
      if (group?.dbId != null) item.group = group.dbId;
      else item.group_key = n.groupKey;
    } else {
      item.group = null;
    }
    payload.nodes.push(item);
  }
  for (const n of Object.values(saved.nodes)) {
    if (!current.nodes[n.key] && n.dbId !== null) payload.deleted_nodes.push(n.dbId);
  }

  const empty = !payload.groups.length && !payload.nodes.length && !payload.deleted_nodes.length
    && !payload.deleted_groups.length && !payload.notes.length && !payload.deleted_notes.length;
  return empty ? null : payload;
}

/** After a successful save: assign the database IDs returned by the backend to the sent snapshot. */
export function applySaveResult(
  sent: Snapshot,
  createdGroups: Record<string, number>,
  createdNodes: Record<string, number>,
  createdNotes: Record<string, number> = {},
): Snapshot {
  const notes: Record<string, SnapNote> = {};
  for (const [k, n] of Object.entries(sent.notes ?? {})) {
    notes[k] = { ...n, dbId: n.dbId ?? createdNotes[k] ?? null };
  }
  const groups: Record<string, SnapGroup> = {};
  for (const [k, g] of Object.entries(sent.groups)) {
    groups[k] = { ...g, dbId: g.dbId ?? createdGroups[k] ?? null };
  }
  const nodes: Record<string, SnapNode> = {};
  for (const [k, n] of Object.entries(sent.nodes)) {
    nodes[k] = { ...n, dbId: n.dbId ?? createdNodes[k] ?? null };
  }
  return { groups, nodes, notes };
}

// ---------------------------------------------------------------------------------------------------------------------
// Placement of new nodes
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Positions for nodes that are added without an explicit drop position ("Add missing"): services go below
 * their parent if it is on the canvas, everything else into a row below the existing content.
 */
export function placeNew(
  existing: CanvasNode[],
  newKeys: string[],
  descriptors: Record<string, ObjectDescriptor>,
  grid: number,
): Record<string, { x: number; y: number }> {
  const byId = new Map(existing.map((n) => [n.id, n]));
  let maxY = 0;
  let minX = Infinity;
  for (const n of existing) {
    if (n.parentId) continue;
    const size = nodeSize(n);
    maxY = Math.max(maxY, n.position.y + size.height);
    minX = Math.min(minX, n.position.x);
  }
  if (!Number.isFinite(minX)) minX = 0;
  const gap = 40;
  const result: Record<string, { x: number; y: number }> = {};
  const childCount = new Map<string, number>();
  let rowX = minX;
  const rowY = existing.length ? maxY + gap * 2 : 0;

  // Hosts first, so services added in the same batch can be placed below them
  const sorted = [...newKeys].sort((a, b) => Number(LABEL_TO_TYPE[parseKey(a)?.label ?? ''] === 'service')
    - Number(LABEL_TO_TYPE[parseKey(b)?.label ?? ''] === 'service'));
  for (const key of sorted) {
    const parentKey = descriptors[key]?.service?.parent_key;
    const parentNode = parentKey ? byId.get(parentKey) : undefined;
    const parentPos = parentNode ? absolutePosition(parentNode, byId) : parentKey ? result[parentKey] : undefined;
    if (parentKey && parentPos) {
      const i = childCount.get(parentKey) ?? 0;
      childCount.set(parentKey, i + 1);
      result[key] = {
        x: snap(parentPos.x + (i % 3) * (NODE_WIDTH + gap / 2) - (NODE_WIDTH + gap / 2), grid),
        y: snap(parentPos.y + (NODE_HEIGHT + gap) * (1 + Math.floor(i / 3)) + gap, grid),
      };
    } else {
      result[key] = { x: snap(rowX, grid), y: snap(rowY, grid) };
      rowX += NODE_WIDTH + gap;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------
// Impact analysis
// ---------------------------------------------------------------------------------------------------------------------

export interface Impact {
  root: string;
  /** Objects that fail together with the root: services on a failed host, applications of failed services. */
  direct: Set<string>;
  /** Objects that depend on a failed object through a data flow (source -> failed target), transitively. */
  indirect: Set<string>;
  /** Data flows whose target (or, for bidirectional flows, either end) has failed. */
  flows: Set<number>;
}

/**
 * "What breaks if <root> fails?" – evaluated on the edges known to the canvas.
 *   1. Structural failure: device -> VMs pinned to it -> services running on them -> applications made of those
 *      services (everything connected by "runs on" / "part of" edges).
 *   2. Dependents: whoever sends data to a failed object loses that dependency (and so on, transitively).
 */
export function computeImpact(root: string, edges: GraphEdges): Impact {
  const direct = new Set<string>([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of edges.runs_on) {
      if (direct.has(r.target) && !direct.has(r.source)) {
        direct.add(r.source);
        changed = true;
      }
    }
    for (const p of edges.part_of ?? []) {
      if (direct.has(p.source) && !direct.has(p.target)) {
        direct.add(p.target);
        changed = true;
      }
    }
  }

  const failed = new Set(direct);
  const indirect = new Set<string>();
  const flows = new Set<number>();
  changed = true;
  while (changed) {
    changed = false;
    for (const f of edges.flows) {
      if (f.status === 'disabled') continue;
      const hits: Array<[string, string]> = [[f.target, f.source]];
      if (f.direction === 'bi') hits.push([f.source, f.target]);
      for (const [failedEnd, dependent] of hits) {
        if (!failed.has(failedEnd)) continue;
        flows.add(f.id);
        if (!failed.has(dependent)) {
          failed.add(dependent);
          indirect.add(dependent);
          changed = true;
        }
      }
    }
  }
  direct.delete(root);
  return { root, direct, indirect, flows };
}

export function impactRole(impact: Impact | null, key: string): ImpactRole | undefined {
  if (!impact) return undefined;
  if (key === impact.root) return 'root';
  if (impact.direct.has(key)) return 'direct';
  if (impact.indirect.has(key)) return 'indirect';
  return 'none';
}
