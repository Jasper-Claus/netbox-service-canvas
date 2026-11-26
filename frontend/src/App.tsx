import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  getViewportForBounds,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type OnBeforeDelete,
  type OnNodeDrag,
} from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Api, ApiError } from './api';
import { NewApplicationModal } from './components/ApplicationModal';
import { ConnectDialog } from './components/ConnectDialog';
import { EdgePanel } from './components/EdgePanel';
import { FlowEdge } from './components/FlowEdge';
import { GroupNode } from './components/GroupNode';
import { NewServiceModal } from './components/NewServiceModal';
import { NodePanel } from './components/NodePanel';
import { NoteNode } from './components/NoteNode';
import { ObjectNode } from './components/ObjectNode';
import { DRAG_MIME, Sidebar } from './components/Sidebar';
import { Toolbar, type SaveState } from './components/Toolbar';
import { EditorContext, type EditorContextValue, type GroupUpdate, type NoteUpdate } from './context';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  NOTE_HEIGHT,
  NOTE_WIDTH,
  absolutePosition,
  applySaveResult,
  buildEdges,
  buildNodes,
  computeImpact,
  diffLayout,
  findGroupAt,
  groupNodeId,
  impactRole,
  isGroupNode,
  isNoteNode,
  isObjectNode,
  newGroupKey,
  newNoteKey,
  noteNodeId,
  nodeSize,
  parseKey,
  placeNew,
  reparent,
  snap,
  snapshotFromNodes,
  sortParentsFirst,
  type CanvasEdge,
  type CanvasNode,
  type GroupNode as GroupNodeType,
  type NoteNode as NoteNodeType,
  type ObjectNode as ObjectNodeType,
} from './graph';
import { autoLayout } from './layout';
import type { EdgeStyle, EdgeStyles, EditorConfig, GraphResponse, LayoutPayload, ObjectDescriptor, Snapshot } from './types';
import { downloadDataUrl, slugify } from './util';
import { locale, t } from './i18n';

const nodeTypes = { object: ObjectNode, group: GroupNode, note: NoteNode };
const edgeTypes = { flow: FlowEdge };
const EMPTY_PAYLOAD: LayoutPayload = {
  groups: [], nodes: [], notes: [], deleted_nodes: [], deleted_groups: [], deleted_notes: [],
};
const AUTOSAVE_DELAY = 800;

interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'danger' | 'info';
}

function useStoredFlag(key: string, initial: boolean): [boolean, () => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : raw === '1';
    } catch {
      return initial;
    }
  });
  const toggle = useCallback(() => {
    setValue((v) => {
      try {
        window.localStorage.setItem(key, v ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !v;
    });
  }, [key]);
  return [value, toggle];
}

function useColorMode(): 'light' | 'dark' {
  const read = () => (document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light');
  const [mode, setMode] = useState<'light' | 'dark'>(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setMode(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
    return () => observer.disconnect();
  }, []);
  return mode;
}

function newObjectNode(key: string, position: { x: number; y: number }, desc: ObjectDescriptor | null): ObjectNodeType {
  return { id: key, type: 'object', position, data: { kind: 'object', key, dbId: null, desc } };
}

function Editor({ config }: { config: EditorConfig }) {
  const api = useMemo(() => new Api(config), [config]);
  const perms = config.perms;
  const grid = config.grid_size || 10;
  const canEditLayout = perms.edit_layout;
  const canEdit = canEditLayout || perms.add_connection || perms.change_connection || perms.change_service
    || perms.add_service || perms.add_application || perms.change_application || perms.edit_notes;
  // Notes are stored together with the layout
  const canSaveLayout = canEditLayout || perms.edit_notes;
  const storagePrefix = `nsc:${config.canvas.id}:`;
  const netboxBase = config.urls.api.replace(/api\/?$/, '') || '/';

  const { screenToFlowPosition, fitView, getNodesBounds } = useReactFlow<CanvasNode, CanvasEdge>();
  const colorMode = useColorMode();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const nodesRef = useRef<CanvasNode[]>(nodes);
  nodesRef.current = nodes;

  const [graphEdges, setGraphEdges] = useState<GraphResponse['edges']>({ runs_on: [], part_of: [], flows: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [readOnlyPref, toggleReadOnly] = useStoredFlag(`${storagePrefix}readonly`, false);
  const readOnly = !canEdit || readOnlyPref;
  const layoutEditable = !readOnly && canEditLayout;
  const notesEditable = !readOnly && perms.edit_notes;
  const [autosave, toggleAutosave] = useStoredFlag('nsc:autosave', true);
  const [snapToGrid, toggleSnap] = useStoredFlag('nsc:snap', true);
  const [minimap, toggleMinimap] = useStoredFlag('nsc:minimap', true);
  const [showRunsOn, toggleRunsOn] = useStoredFlag('nsc:runs-on', true);
  const [sidebar, toggleSidebar] = useStoredFlag('nsc:sidebar', true);

  const savedRef = useRef<Snapshot>({ nodes: {}, groups: {}, notes: {} });
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [edgeStyles, setEdgeStyles] = useState<EdgeStyles>({});
  const edgeStylesRef = useRef<EdgeStyles>({});
  edgeStylesRef.current = edgeStyles;
  const savedStylesRef = useRef('{}');

  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [impactRoot, setImpactRoot] = useState<string | null>(null);
  const [newApplication, setNewApplication] = useState<{ services: Array<{ id: number; display: string }> } | null>(null);
  const [pendingConnect, setPendingConnect] = useState<{ source: ObjectDescriptor; target: ObjectDescriptor } | null>(null);
  const [newService, setNewService] = useState<{ parent: { label: string; id: number; name?: string } | null } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'danger' ? 8000 : 3500);
  }, []);

  // -------------------------------------------------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------------------------------------------------

  const applyDescriptors = useCallback((objects: Record<string, ObjectDescriptor>) => {
    setNodes((ns) => ns.map((n) => {
      if (!isObjectNode(n)) return n;
      const desc = objects[n.data.key];
      return desc && desc !== n.data.desc ? { ...n, data: { ...n.data, desc } } : n;
    }));
  }, [setNodes]);

  /** Reload descriptors and edges for the nodes currently on the canvas (including unsaved ones). */
  const refreshGraph = useCallback(async (extraKeys: string[] = []) => {
    const unsaved = nodesRef.current
      .filter((n): n is ObjectNodeType => isObjectNode(n) && n.data.dbId === null)
      .map((n) => n.data.key);
    try {
      const g = await api.graph([...new Set([...unsaved, ...extraKeys])]);
      setGraphEdges(g.edges);
      applyDescriptors(g.objects);
      return g;
    } catch (e) {
      notify(t('Loading failed: {error}', { error: (e as Error).message }), 'danger');
      return null;
    }
  }, [api, applyDescriptors, notify]);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    try {
      const g = await api.graph();
      const built = sortParentsFirst(buildNodes(g, grid));
      const focus = config.focus && built.some((n) => n.id === config.focus) ? config.focus : null;
      const withFocus = built.map((n) => (n.id === focus && isObjectNode(n)
        ? { ...n, selected: true, data: { ...n.data, focused: true } }
        : n));
      setNodes(withFocus);
      savedRef.current = snapshotFromNodes(withFocus, grid);
      setEdgeStyles(g.edge_styles ?? {});
      savedStylesRef.current = JSON.stringify(g.edge_styles ?? {});
      setGraphEdges(g.edges);
      setSaveState('saved');
      setLoadError(null);
      pendingFitRef.current = { focus };
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, config.focus, grid, setNodes]);

  // Fit the view once React Flow has measured the freshly loaded nodes
  const nodesInitialized = useNodesInitialized();
  const pendingFitRef = useRef<{ focus: string | null } | null>(null);
  useEffect(() => {
    const pending = pendingFitRef.current;
    if (!pending || loading || (nodes.length && !nodesInitialized)) return;
    pendingFitRef.current = null;
    if (pending.focus) void fitView({ nodes: [{ id: pending.focus }], maxZoom: 1.2, duration: 400 });
    else void fitView({ maxZoom: 1.2, padding: 0.15 });
  }, [nodesInitialized, loading, nodes.length, fitView]);

  useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  // -------------------------------------------------------------------------------------------------------------------
  // Saving (diff-only, debounced autosave)
  // -------------------------------------------------------------------------------------------------------------------

  const save = useCallback(async () => {
    if (!canSaveLayout) return;
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    const current = snapshotFromNodes(nodesRef.current, grid);
    const styles = edgeStylesRef.current;
    const stylesJson = JSON.stringify(styles);
    let payload = diffLayout(savedRef.current, current);
    if (stylesJson !== savedStylesRef.current) payload = { ...(payload ?? EMPTY_PAYLOAD), edge_styles: styles };
    if (!payload) {
      setSaveState('saved');
      return;
    }
    savingRef.current = true;
    setSaveState('saving');
    try {
      const result = await api.saveLayout(payload);
      savedRef.current = applySaveResult(current, result.created_groups, result.created_nodes, result.created_notes ?? {});
      if (payload.edge_styles) savedStylesRef.current = stylesJson;
      // Store the new database IDs on the nodes
      setNodes((ns) => ns.map((n) => {
        if (isObjectNode(n) && n.data.dbId === null && result.created_nodes[n.data.key]) {
          return { ...n, data: { ...n.data, dbId: result.created_nodes[n.data.key] } };
        }
        if (isGroupNode(n) && n.data.dbId === null && result.created_groups[n.data.clientKey]) {
          return { ...n, data: { ...n.data, dbId: result.created_groups[n.data.clientKey] } };
        }
        if (isNoteNode(n) && n.data.dbId === null && result.created_notes?.[n.data.clientKey]) {
          return { ...n, data: { ...n.data, dbId: result.created_notes[n.data.clientKey] } };
        }
        return n;
      }));
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      notify(t('Layout not saved: {error}', { error: e instanceof ApiError ? e.message : String(e) }), 'danger');
    } finally {
      savingRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        window.setTimeout(() => void save(), 0);
      }
    }
  }, [api, canSaveLayout, grid, notify, setNodes]);

  // Detect changes and autosave
  useEffect(() => {
    if (loading || !canSaveLayout) return;
    if (nodes.some((n) => n.dragging || n.resizing)) return;
    const payload = diffLayout(savedRef.current, snapshotFromNodes(nodes, grid));
    const stylesChanged = JSON.stringify(edgeStyles) !== savedStylesRef.current;
    if (!payload && !stylesChanged) {
      if (!savingRef.current) setSaveState((s) => (s === 'error' ? s : 'saved'));
      return;
    }
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
    if (!autosave || readOnly) return;
    const timer = window.setTimeout(() => void save(), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [nodes, edgeStyles, autosave, readOnly, loading, canSaveLayout, grid, save]);

  const setEdgeStyle = useCallback((flowId: number, update: Partial<EdgeStyle>) => {
    setEdgeStyles((styles) => {
      const key = String(flowId);
      const next: EdgeStyle = { ...styles[key], ...update, points: update.points ?? styles[key]?.points ?? [] };
      const copy = { ...styles };
      if (next.points.length || next.color) copy[key] = next;
      else delete copy[key];
      return copy;
    });
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving' || saveState === 'error') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveState]);

  // -------------------------------------------------------------------------------------------------------------------
  // Nodes & groups
  // -------------------------------------------------------------------------------------------------------------------

  const placedKeys = useMemo(
    () => new Set(nodes.filter(isObjectNode).map((n) => n.data.key)),
    [nodes],
  );

  const impact = useMemo(
    () => (impactRoot ? computeImpact(impactRoot, graphEdges) : null),
    [impactRoot, graphEdges],
  );

  const edges = useMemo(() => {
    const list = buildEdges(graphEdges, placedKeys, { showRunsOn }, edgeStyles);
    const failed = impact ? new Set([impact.root, ...impact.direct]) : null;
    return list.map((e) => {
      let edge = e;
      if (e.data?.kind === 'flow' && e.data.flow.id === selectedFlowId) {
        edge = { ...edge, selected: true, className: `${edge.className} nsc-edge-selected` };
      }
      if (impact && failed) {
        const hit = e.data?.kind === 'flow'
          ? impact.flows.has(e.data.flow.id)
          : failed.has(e.source) && failed.has(e.target);
        edge = { ...edge, className: `${edge.className ?? ''} ${hit ? 'nsc-edge-impact' : 'nsc-edge-dim'}` };
      }
      return edge;
    });
  }, [graphEdges, placedKeys, showRunsOn, selectedFlowId, impact, edgeStyles]);

  /** Nodes as rendered: impact highlight and per-type draggability are derived, not stored. */
  const displayNodes = useMemo(() => {
    if (!impact && layoutEditable === notesEditable) return nodes;
    return nodes.map((n) => {
      let next = n;
      if (isNoteNode(n)) {
        if (!notesEditable) next = { ...n, draggable: false };
      } else if (!layoutEditable) {
        next = { ...n, draggable: false };
      }
      if (impact && isObjectNode(next)) {
        next = { ...next, data: { ...next.data, impact: impactRole(impact, next.data.key) } };
      }
      return next;
    });
  }, [nodes, impact, layoutEditable, notesEditable]);

  const viewportCenter = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }, [screenToFlowPosition]);

  const addNodes = useCallback((positions: Record<string, { x: number; y: number }>,
    descriptors: Record<string, ObjectDescriptor> = {}) => {
    const keys = Object.keys(positions).filter((k) => !nodesRef.current.some((n) => n.id === k));
    if (!keys.length) return;
    setNodes((ns) => {
      let result: CanvasNode[] = [...ns];
      for (const key of keys) {
        const pos = { x: snap(positions[key].x, grid), y: snap(positions[key].y, grid) };
        result.push(newObjectNode(key, pos, descriptors[key] ?? null));
        const group = findGroupAt(result, { ...pos, width: NODE_WIDTH, height: NODE_HEIGHT });
        if (group) result = reparent(result, key, group.id);
      }
      return sortParentsFirst(result);
    });
    void refreshGraph(keys);
  }, [grid, refreshGraph, setNodes]);

  const addAtCenter = useCallback((key: string) => {
    const c = viewportCenter();
    const offset = (nodesRef.current.length % 5) * grid * 2;
    addNodes({ [key]: { x: c.x - NODE_WIDTH / 2 + offset, y: c.y - NODE_HEIGHT / 2 + offset } });
  }, [addNodes, grid, viewportCenter]);

  const updateGroup = useCallback((nodeId: string, update: GroupUpdate) => {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== nodeId || !isGroupNode(n)) return n;
      const next: GroupNodeType = { ...n, data: { ...n.data } };
      if (update.name !== undefined) next.data.name = update.name;
      if (update.color !== undefined) next.data.color = update.color;
      if (update.width !== undefined || update.height !== undefined) {
        const width = update.width ?? nodeSize(n).width;
        const height = update.height ?? nodeSize(n).height;
        next.width = width;
        next.height = height;
        next.style = { ...n.style, width, height };
      }
      return next;
    }));
  }, [setNodes]);

  const deleteGroup = useCallback((nodeId: string) => {
    setNodes((ns) => {
      let result = ns;
      for (const child of ns.filter((n) => n.parentId === nodeId)) result = reparent(result, child.id, null);
      return result.filter((n) => n.id !== nodeId);
    });
  }, [setNodes]);

  const updateNote = useCallback((nodeId: string, update: NoteUpdate) => {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== nodeId || !isNoteNode(n)) return n;
      const next: NoteNodeType = { ...n, data: { ...n.data } };
      if (update.text !== undefined) next.data.text = update.text;
      if (update.color !== undefined) next.data.color = update.color;
      if (update.width !== undefined || update.height !== undefined) {
        const width = update.width ?? nodeSize(n).width;
        const height = update.height ?? nodeSize(n).height;
        next.width = width;
        next.height = height;
        next.style = { ...n.style, width, height };
      }
      return next;
    }));
  }, [setNodes]);

  const deleteNote = useCallback((nodeId: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== nodeId));
  }, [setNodes]);

  const addNote = useCallback(() => {
    const c = viewportCenter();
    const clientKey = newNoteKey();
    const note: NoteNodeType = {
      id: noteNodeId(clientKey),
      type: 'note',
      position: { x: snap(c.x - NOTE_WIDTH / 2, grid), y: snap(c.y - NOTE_HEIGHT / 2, grid) },
      width: NOTE_WIDTH,
      height: NOTE_HEIGHT,
      style: { width: NOTE_WIDTH, height: NOTE_HEIGHT },
      selected: true,
      data: { kind: 'note', clientKey, dbId: null, text: '', color: 'ffe082' },
    };
    setNodes((ns) => sortParentsFirst([...ns.map((n) => ({ ...n, selected: false })), note]));
  }, [grid, setNodes, viewportCenter]);

  const addGroup = useCallback(() => {
    const selected = nodesRef.current.filter((n) => n.selected && isObjectNode(n));
    const clientKey = newGroupKey();
    const id = groupNodeId(clientKey);
    let rect = { x: 0, y: 0, width: 400, height: 260 };
    if (selected.length) {
      const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
      const xs: number[] = [];
      const ys: number[] = [];
      for (const n of selected) {
        const p = absolutePosition(n, byId);
        const s = nodeSize(n);
        xs.push(p.x, p.x + s.width);
        ys.push(p.y, p.y + s.height);
      }
      rect = {
        x: Math.min(...xs) - 30,
        y: Math.min(...ys) - 50,
        width: Math.max(...xs) - Math.min(...xs) + 60,
        height: Math.max(...ys) - Math.min(...ys) + 80,
      };
    } else {
      const c = viewportCenter();
      rect = { ...rect, x: c.x - 200, y: c.y - 130 };
    }
    const r = {
      x: snap(rect.x, grid), y: snap(rect.y, grid),
      width: snap(rect.width, grid), height: snap(rect.height, grid),
    };
    const group: GroupNodeType = {
      id,
      type: 'group',
      position: { x: r.x, y: r.y },
      width: r.width,
      height: r.height,
      style: { width: r.width, height: r.height },
      zIndex: -1,
      selected: !selected.length,
      data: { kind: 'group', clientKey, dbId: null, name: t('New group'), color: '607d8b' },
    };
    setNodes((ns) => {
      let result: CanvasNode[] = sortParentsFirst([...ns.map((n) => ({ ...n, selected: false })), group]);
      for (const n of selected) result = reparent(result, n.id, id);
      return result;
    });
  }, [grid, setNodes, viewportCenter]);

  const onNodeDragStop: OnNodeDrag<CanvasNode> = useCallback((_event, _node, dragged) => {
    setNodes((ns) => {
      let result = ns;
      for (const d of dragged) {
        if (!isObjectNode(d)) continue;
        const byId = new Map(result.map((n) => [n.id, n]));
        const current = byId.get(d.id);
        if (!current) continue;
        const pos = absolutePosition(current, byId);
        const size = nodeSize(current);
        const group = findGroupAt(result, { ...pos, ...size });
        const target = group?.id ?? null;
        if ((current.parentId ?? null) !== target) result = reparent(result, d.id, target);
      }
      return result;
    });
  }, [setNodes]);

  const onBeforeDelete: OnBeforeDelete<CanvasNode, CanvasEdge> = useCallback(async ({ nodes: toDelete }) => {
    if (!layoutEditable && !notesEditable) return false;
    // Groups: keep their members (React Flow would delete children together with the parent)
    if (layoutEditable && perms.edit_groups) {
      for (const g of toDelete.filter(isGroupNode)) deleteGroup(g.id);
    }
    const objects = layoutEditable ? toDelete.filter((n) => isObjectNode(n)) : [];
    const notes = notesEditable ? toDelete.filter((n) => isNoteNode(n)) : [];
    // Connections are never deleted with the keyboard; use the edge panel for that
    return { nodes: [...objects, ...notes], edges: [] };
  }, [deleteGroup, layoutEditable, notesEditable, perms.edit_groups]);

  // -------------------------------------------------------------------------------------------------------------------
  // Drag & drop from the sidebar
  // -------------------------------------------------------------------------------------------------------------------

  const onDragOver = useCallback((event: DragEvent) => {
    if (!layoutEditable || !event.dataTransfer.types.includes(DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, [layoutEditable]);

  const onDrop = useCallback((event: DragEvent) => {
    const key = event.dataTransfer.getData(DRAG_MIME);
    if (!key || !layoutEditable) return;
    event.preventDefault();
    const p = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNodes({ [key]: { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 } });
  }, [addNodes, layoutEditable, screenToFlowPosition]);

  // -------------------------------------------------------------------------------------------------------------------
  // Edges
  // -------------------------------------------------------------------------------------------------------------------

  const descriptorFor = useCallback((key: string): ObjectDescriptor | null => {
    const node = nodesRef.current.find((n) => n.id === key);
    return node && isObjectNode(node) ? node.data.desc : null;
  }, []);

  const isValidConnection = useCallback((c: Connection | Edge) => (
    c.source !== c.target && !!descriptorFor(c.source) && !!descriptorFor(c.target)
  ), [descriptorFor]);

  const onConnect = useCallback((c: Connection) => {
    const source = descriptorFor(c.source);
    const target = descriptorFor(c.target);
    if (source && target && source.key !== target.key) setPendingConnect({ source, target });
  }, [descriptorFor]);

  const selectedFlow = useMemo(
    () => graphEdges.flows.find((f) => f.id === selectedFlowId) ?? null,
    [graphEdges, selectedFlowId],
  );

  // -------------------------------------------------------------------------------------------------------------------
  // Toolbar actions
  // -------------------------------------------------------------------------------------------------------------------

  const runAutoLayout = useCallback(async () => {
    setBusy(true);
    try {
      const laidOut = await autoLayout(nodesRef.current, edges, grid);
      setNodes(laidOut);
      // Hand-drawn bends no longer fit the new positions; colors are kept
      setEdgeStyles((styles) => Object.fromEntries(Object.entries(styles)
        .filter(([, s]) => s.color)
        .map(([k, s]) => [k, { points: [], color: s.color }])));
      window.setTimeout(() => fitView({ duration: 400, maxZoom: 1.2 }), 50);
    } catch (e) {
      notify(t('Auto layout failed: {error}', { error: (e as Error).message }), 'danger');
    } finally {
      setBusy(false);
    }
  }, [edges, fitView, grid, notify, setNodes]);

  const addMissing = useCallback(async () => {
    setBusy(true);
    try {
      const unsaved = nodesRef.current
        .filter((n): n is ObjectNodeType => isObjectNode(n) && n.data.dbId === null)
        .map((n) => n.data.key);
      const { objects } = await api.missing(unsaved);
      const keys = Object.keys(objects).filter((k) => !nodesRef.current.some((n) => n.id === k));
      if (!keys.length) {
        notify(t('Nothing to add: all related objects are already on the canvas.'), 'info');
        return;
      }
      if (keys.length > 40 && !window.confirm(t('Add {count} objects?', { count: keys.length }))) return;
      addNodes(placeNew(nodesRef.current, keys, objects, grid), objects);
      notify(t('{count} object(s) added.', { count: keys.length }), 'success');
    } catch (e) {
      notify((e as Error).message, 'danger');
    } finally {
      setBusy(false);
    }
  }, [addNodes, api, grid, notify]);

  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    const element = wrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
    if (!element || !nodesRef.current.length) return;
    setBusy(true);
    try {
      const bounds = getNodesBounds(nodesRef.current);
      const padding = 40;
      const width = Math.min(8000, Math.ceil(bounds.width + padding * 2));
      const height = Math.min(8000, Math.ceil(bounds.height + padding * 2));
      // padding as "px": a plain number would be read as a ratio of the image size
      const vp = getViewportForBounds(bounds, width, height, 0.1, 2, `${padding}px`);
      const background = getComputedStyle(wrapperRef.current!).getPropertyValue('--nsc-bg').trim()
        || (colorMode === 'dark' ? '#1a2234' : '#ffffff');
      const options = {
        backgroundColor: background,
        width,
        height,
        style: { width: `${width}px`, height: `${height}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
        filter: (node: HTMLElement) => !node.classList?.contains('react-flow__resize-control'),
      };
      const dataUrl = format === 'png' ? await toPng(element, { ...options, pixelRatio: 2 }) : await toSvg(element, options);
      downloadDataUrl(dataUrl, `${slugify(config.canvas.name)}.${format}`);
    } catch (e) {
      notify(t('Export failed: {error}', { error: (e as Error).message }), 'danger');
    } finally {
      setBusy(false);
    }
  }, [colorMode, config.canvas.name, getNodesBounds, notify]);

  const openNewService = useCallback((hostKey: string | null) => {
    const node = hostKey ? nodesRef.current.find((n) => n.id === hostKey) : undefined;
    const parsed = hostKey ? parseKey(hostKey) : null;
    const name = node && isObjectNode(node) ? node.data.desc?.name : undefined;
    setNewService({ parent: parsed ? { ...parsed, name } : null });
  }, []);

  const onNewService = useCallback(() => {
    const selectedHosts = nodesRef.current.filter(
      (n): n is ObjectNodeType => n.selected === true && isObjectNode(n) && !!n.data.desc
        && (n.data.desc.type === 'device' || n.data.desc.type === 'virtualmachine'),
    );
    openNewService(selectedHosts.length === 1 ? selectedHosts[0].data.key : null);
  }, [openNewService]);

  const onNewApplication = useCallback(() => {
    const services = nodesRef.current
      .filter((n): n is ObjectNodeType => n.selected === true && isObjectNode(n) && n.data.desc?.type === 'service')
      .map((n) => ({ id: n.data.desc!.id, display: n.data.desc!.name }));
    setNewApplication({ services });
  }, []);

  const onApplicationCreated = useCallback((appKey: string, serviceKeys: string[]) => {
    setNewApplication(null);
    notify(t('Application created.'), 'success');
    const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
    const placed = serviceKeys.map((k) => byId.get(k)).filter((n): n is CanvasNode => !!n);
    if (!layoutEditable) {
      void refreshGraph();
      return;
    }
    if (placed.length) {
      const positions = placed.map((n) => absolutePosition(n, byId));
      const x = Math.max(...positions.map((p) => p.x)) + NODE_WIDTH + 80;
      let y = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
      // Do not land on top of an existing node
      const occupied = nodesRef.current
        .filter((n) => !isGroupNode(n))
        .map((n) => ({ ...absolutePosition(n, byId), ...nodeSize(n) }));
      while (occupied.some((r) => x < r.x + r.width && x + NODE_WIDTH > r.x && y < r.y + r.height && y + NODE_HEIGHT > r.y)) {
        y += NODE_HEIGHT + 30;
      }
      addNodes({ [appKey]: { x, y } });
    } else {
      addAtCenter(appKey);
    }
  }, [addAtCenter, addNodes, layoutEditable, notify, refreshGraph]);

  const onServiceCreated = useCallback((serviceKey: string, parentKey: string, appKey: string | null) => {
    setNewService(null);
    notify(appKey ? t('Service and application saved.') : t('Service created.'), 'success');
    const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
    const parent = byId.get(parentKey);
    let pos: { x: number; y: number };
    if (parent) {
      const p = absolutePosition(parent, byId);
      const siblings = nodesRef.current.filter(
        (n) => isObjectNode(n) && n.data.desc?.service?.parent_key === parentKey,
      ).length;
      pos = { x: p.x + siblings * (NODE_WIDTH + 20), y: p.y + NODE_HEIGHT + 60 };
    } else {
      const c = viewportCenter();
      pos = { x: c.x - NODE_WIDTH / 2, y: c.y - NODE_HEIGHT / 2 };
    }
    const positions: Record<string, { x: number; y: number }> = { [serviceKey]: pos };
    // A new or newly linked application goes right below its service (unless it is on the canvas already)
    if (appKey && !byId.has(appKey)) positions[appKey] = { x: pos.x, y: pos.y + NODE_HEIGHT + 60 };
    addNodes(positions);
  }, [addNodes, notify, viewportCenter]);

  const exportPdf = useCallback(async () => {
    const element = wrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
    const editor = wrapperRef.current?.closest<HTMLElement>('.nsc-editor');
    if (!element || !nodesRef.current.length) return;
    setBusy(true);
    // Always print in the light theme
    editor?.classList.add('nsc-print-light');
    try {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
      const { jsPDF } = await import('jspdf');
      const bounds = getNodesBounds(nodesRef.current);
      const padding = 30;
      const imgW = Math.min(6000, Math.ceil(bounds.width + padding * 2));
      const imgH = Math.min(6000, Math.ceil(bounds.height + padding * 2));
      const vp = getViewportForBounds(bounds, imgW, imgH, 0.1, 2, `${padding}px`);
      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        width: imgW,
        height: imgH,
        // small diagrams are scaled up to the page width, so render them sharper
        pixelRatio: Math.max(2, Math.min(4, 3000 / imgW)),
        style: { width: `${imgW}px`, height: `${imgH}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
        filter: (node: HTMLElement) => !node.classList?.contains('react-flow__resize-control'),
      });

      const landscape = imgW >= imgH;
      const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const headerH = 16;
      const legendH = 10;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2 - headerH - legendH;
      const scale = Math.min(availW / imgW, availH / imgH);
      const w = imgW * scale;
      const h = imgH * scale;

      // Header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(29, 39, 59);
      pdf.text(config.canvas.name, margin, margin + 6);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(102, 115, 130);
      pdf.text(t('As of {date}', { date: new Date().toLocaleString(locale()) }), margin, margin + 11.5);
      pdf.text('NetBox Service Canvas', pageW - margin, margin + 6, { align: 'right' });
      pdf.setDrawColor(220, 225, 231);
      pdf.line(margin, margin + headerH - 2, pageW - margin, margin + headerH - 2);

      // Diagram, centred in the available area
      pdf.addImage(dataUrl, 'PNG', margin + (availW - w) / 2, margin + headerH + (availH - h) / 2, w, h);

      // Legend
      const ly = pageH - margin - 3;
      let lx = margin;
      const legend: Array<{ label: string; color: [number, number, number]; dash?: number[] }> = [
        { label: t('active'), color: [47, 179, 68] },
        { label: t('planned'), color: [23, 162, 184], dash: [1.5, 1] },
        { label: t('disabled'), color: [154, 160, 172], dash: [0.5, 1] },
        { label: t('runs on'), color: [102, 115, 130], dash: [1, 1] },
        { label: t('belongs to (application)'), color: [156, 39, 176], dash: [0.3, 1.2] },
      ];
      pdf.setFontSize(8);
      for (const item of legend) {
        pdf.setDrawColor(...item.color);
        pdf.setLineWidth(0.6);
        pdf.setLineDashPattern(item.dash ?? [], 0);
        pdf.line(lx, ly - 1, lx + 7, ly - 1);
        pdf.setLineDashPattern([], 0);
        pdf.setTextColor(102, 115, 130);
        pdf.text(item.label, lx + 9, ly);
        lx += 9 + pdf.getTextWidth(item.label) + 7;
      }
      pdf.save(`${slugify(config.canvas.name)}.pdf`);
    } catch (e) {
      notify(t('PDF export failed: {error}', { error: (e as Error).message }), 'danger');
    } finally {
      editor?.classList.remove('nsc-print-light');
      setBusy(false);
    }
  }, [config.canvas.name, getNodesBounds, notify]);

  const removeFromCanvas = useCallback((key: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== key));
    setSelectedNodeKey(null);
    if (impactRoot === key) setImpactRoot(null);
  }, [impactRoot, setNodes]);

  const selectedNodeDesc = useMemo(() => {
    if (!selectedNodeKey || selectedFlowId !== null) return null;
    const node = nodes.find((n) => n.id === selectedNodeKey);
    return node && isObjectNode(node) ? node.data.desc : null;
  }, [nodes, selectedNodeKey, selectedFlowId]);

  const impactName = impactRoot ? (descriptorFor(impactRoot)?.name ?? impactRoot) : null;

  const contextValue: EditorContextValue = useMemo(() => ({
    api, perms, readOnly, grid, netboxBase, updateGroup, deleteGroup, updateNote, deleteNote, removeNode: removeFromCanvas,
    notify, edgesEditable: layoutEditable && canSaveLayout, setEdgeStyle,
  }), [api, perms, readOnly, grid, netboxBase, updateGroup, deleteGroup, updateNote, deleteNote, removeFromCanvas, notify,
    layoutEditable, canSaveLayout, setEdgeStyle]);

  if (loadError) {
    return (
      <div className="alert alert-danger m-3">
        {t('Could not load the canvas: {error}', { error: loadError })}
        <button type="button" className="btn btn-sm btn-outline-danger ms-3" onClick={() => void initialLoad()}>
          {t('Try again')}
        </button>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={contextValue}>
      <div className={`nsc-editor${readOnly ? ' nsc-readonly' : ''}`} data-color-mode={colorMode}>
        <Toolbar
          readOnly={readOnly}
          canEdit={canEdit}
          canEditLayout={canEditLayout}
          canEditGroups={perms.edit_groups}
          onToggleReadOnly={toggleReadOnly}
          saveState={saveState}
          autosave={autosave}
          onToggleAutosave={toggleAutosave}
          onSave={() => void save()}
          snap={snapToGrid}
          onToggleSnap={toggleSnap}
          minimap={minimap}
          onToggleMinimap={toggleMinimap}
          showRunsOn={showRunsOn}
          onToggleRunsOn={toggleRunsOn}
          sidebar={sidebar}
          onToggleSidebar={toggleSidebar}
          onAddGroup={addGroup}
          onAutoLayout={() => void runAutoLayout()}
          onAddMissing={() => void addMissing()}
          onFitView={() => fitView({ duration: 300, maxZoom: 1.2 })}
          onExport={(f) => void exportImage(f)}
          onExportPdf={() => void exportPdf()}
          impactName={impactName}
          onClearImpact={() => setImpactRoot(null)}
          onReload={() => {
            if (saveState !== 'saved' && !window.confirm(t('Discard unsaved layout changes?'))) return;
            setSelectedFlowId(null);
            setSelectedNodeKey(null);
            setImpactRoot(null);
            void initialLoad();
          }}
          busy={busy || loading}
        />
        <div className="nsc-body">
          {sidebar && (
            <Sidebar
              placed={placedKeys}
              onAdd={addAtCenter}
              onNewService={onNewService}
              onNewApplication={onNewApplication}
              onAddNote={addNote}
              canEdit={layoutEditable}
            />
          )}
          <div className="nsc-flow" ref={wrapperRef} onDragOver={onDragOver} onDrop={onDrop}>
            {loading && <div className="nsc-overlay text-muted">{t('Loading canvas…')}</div>}
            {!loading && nodes.length === 0 && (
              <div className="nsc-overlay nsc-empty text-muted">
                {layoutEditable
                  ? t('The canvas is empty. Drag devices, VMs, services or applications here from the sidebar.')
                  : t('The canvas is empty.')}
              </div>
            )}
            <ReactFlow<CanvasNode, CanvasEdge>
              nodes={displayNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onNodeDragStop={onNodeDragStop}
              onBeforeDelete={onBeforeDelete}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              connectionMode={ConnectionMode.Loose}
              onEdgeClick={(_, edge) => {
                if (edge.data?.kind === 'flow') {
                  setSelectedFlowId(edge.data.flow.id);
                  setSelectedNodeKey(null);
                }
              }}
              onNodeClick={(_, node) => {
                if (isObjectNode(node)) {
                  setSelectedNodeKey(node.id);
                  setSelectedFlowId(null);
                }
              }}
              onPaneClick={() => {
                setSelectedFlowId(null);
                setSelectedNodeKey(null);
              }}
              nodesDraggable={layoutEditable || notesEditable}
              nodesConnectable={!readOnly && (perms.add_connection || perms.change_service)}
              elementsSelectable
              deleteKeyCode={layoutEditable || notesEditable ? ['Delete', 'Backspace'] : null}
              multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
              snapToGrid={snapToGrid}
              snapGrid={[grid, grid]}
              colorMode={colorMode}
              minZoom={0.1}
              maxZoom={2.5}
              onlyRenderVisibleElements={nodes.length > 300}
            >
              <Background variant={BackgroundVariant.Dots} gap={grid * 2} size={1} />
              <Controls showInteractive={false} />
              {minimap && <MiniMap pannable zoomable nodeStrokeWidth={2} />}
            </ReactFlow>
          </div>
          {selectedFlow && (
            <EdgePanel
              key={selectedFlow.id}
              flow={selectedFlow}
              edgeStyle={edgeStyles[String(selectedFlow.id)]}
              onEdgeStyle={(update) => setEdgeStyle(selectedFlow.id, update)}
              source={descriptorFor(selectedFlow.source)}
              target={descriptorFor(selectedFlow.target)}
              onClose={() => setSelectedFlowId(null)}
              onChanged={() => void refreshGraph()}
            />
          )}
          {!selectedFlow && selectedNodeDesc && (
            <NodePanel
              key={selectedNodeDesc.key}
              desc={selectedNodeDesc}
              flows={graphEdges.flows}
              describe={descriptorFor}
              layoutEditable={layoutEditable}
              impactActive={impactRoot === selectedNodeDesc.key}
              onClose={() => setSelectedNodeKey(null)}
              onChanged={() => void refreshGraph()}
              onRemove={() => removeFromCanvas(selectedNodeDesc.key)}
              onSelectFlow={(id) => {
                setSelectedFlowId(id);
                setSelectedNodeKey(null);
              }}
              onToggleImpact={() => setImpactRoot((r) => (r === selectedNodeDesc.key ? null : selectedNodeDesc.key))}
              onNewService={() => openNewService(selectedNodeDesc.key)}
            />
          )}
        </div>
        <div className="nsc-legend small text-muted">
          <span><span className="nsc-legend-line active" /> {t('active')}</span>
          <span><span className="nsc-legend-line planned" /> {t('planned')}</span>
          <span><span className="nsc-legend-line disabled" /> {t('disabled')}</span>
          <span><span className="nsc-legend-line runs-on" /> {t('runs on')}</span>
          <span><span className="nsc-legend-line part-of" /> {t('belongs to')}</span>
          {impact && (
            <>
              <span><span className="nsc-legend-dot" style={{ background: '#d63939' }} /> {t('fails with it')}</span>
              <span><span className="nsc-legend-dot" style={{ background: '#f76707' }} /> {t('affected (depends on it)')}</span>
              <span><span className="nsc-legend-dot" style={{ background: '#f59f00' }} /> {t('unreachable (behind a failed proxy)')}</span>
            </>
          )}
          <span className="ms-auto">{t('Tip: click a node or connection to edit it')}</span>
        </div>
        {pendingConnect && (
          <ConnectDialog
            source={pendingConnect.source}
            target={pendingConnect.target}
            onClose={() => setPendingConnect(null)}
            onDone={async ({ connectionId, message }) => {
              setPendingConnect(null);
              notify(message, 'success');
              await refreshGraph();
              if (connectionId) setSelectedFlowId(connectionId);
            }}
          />
        )}
        {newService && (
          <NewServiceModal
            initialParent={newService.parent}
            onClose={() => setNewService(null)}
            onCreated={onServiceCreated}
          />
        )}
        {newApplication && (
          <NewApplicationModal
            initialServices={newApplication.services}
            onClose={() => setNewApplication(null)}
            onCreated={onApplicationCreated}
          />
        )}
        <div className="nsc-toasts">
          {toasts.map((toast) => (
            <div key={toast.id} className={`alert alert-${toast.kind} py-2 px-3 mb-2 shadow-sm`}>{toast.message}</div>
          ))}
        </div>
      </div>
    </EditorContext.Provider>
  );
}

export function App({ config }: { config: EditorConfig }) {
  return (
    <ReactFlowProvider>
      <Editor config={config} />
    </ReactFlowProvider>
  );
}
