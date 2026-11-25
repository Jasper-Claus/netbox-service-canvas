import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  getNodesBounds,
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
import { ConnectDialog } from './components/ConnectDialog';
import { EdgePanel } from './components/EdgePanel';
import { GroupNode } from './components/GroupNode';
import { NewServiceModal } from './components/NewServiceModal';
import { ObjectNode } from './components/ObjectNode';
import { DRAG_MIME, Sidebar } from './components/Sidebar';
import { Toolbar, type SaveState } from './components/Toolbar';
import { EditorContext, type EditorContextValue, type GroupUpdate } from './context';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  absolutePosition,
  applySaveResult,
  buildEdges,
  buildNodes,
  diffLayout,
  findGroupAt,
  groupNodeId,
  isGroupNode,
  isObjectNode,
  newGroupKey,
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
  type ObjectNode as ObjectNodeType,
} from './graph';
import { autoLayout } from './layout';
import type { EditorConfig, GraphResponse, ObjectDescriptor, Snapshot } from './types';
import { downloadDataUrl, slugify } from './util';

const nodeTypes = { object: ObjectNode, group: GroupNode };
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
    || perms.add_service;
  const storagePrefix = `nsc:${config.canvas.id}:`;

  const { screenToFlowPosition, fitView } = useReactFlow<CanvasNode, CanvasEdge>();
  const colorMode = useColorMode();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const nodesRef = useRef<CanvasNode[]>(nodes);
  nodesRef.current = nodes;

  const [graphEdges, setGraphEdges] = useState<GraphResponse['edges']>({ runs_on: [], flows: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [readOnlyPref, toggleReadOnly] = useStoredFlag(`${storagePrefix}readonly`, false);
  const readOnly = !canEdit || readOnlyPref;
  const layoutEditable = !readOnly && canEditLayout;
  const [autosave, toggleAutosave] = useStoredFlag('nsc:autosave', true);
  const [snapToGrid, toggleSnap] = useStoredFlag('nsc:snap', true);
  const [minimap, toggleMinimap] = useStoredFlag('nsc:minimap', true);
  const [showRunsOn, toggleRunsOn] = useStoredFlag('nsc:runs-on', true);
  const [sidebar, toggleSidebar] = useStoredFlag('nsc:sidebar', true);

  const savedRef = useRef<Snapshot>({ nodes: {}, groups: {} });
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');

  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null);
  const [pendingConnect, setPendingConnect] = useState<{ source: ObjectDescriptor; target: ObjectDescriptor } | null>(null);
  const [newService, setNewService] = useState<{ parent: { label: string; id: number } | null } | null>(null);
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
      notify(`Laden fehlgeschlagen: ${(e as Error).message}`, 'danger');
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
    if (!canEditLayout) return;
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    const current = snapshotFromNodes(nodesRef.current, grid);
    const payload = diffLayout(savedRef.current, current);
    if (!payload) {
      setSaveState('saved');
      return;
    }
    savingRef.current = true;
    setSaveState('saving');
    try {
      const result = await api.saveLayout(payload);
      savedRef.current = applySaveResult(current, result.created_groups, result.created_nodes);
      // Store the new database IDs on the nodes
      setNodes((ns) => ns.map((n) => {
        if (isObjectNode(n) && n.data.dbId === null && result.created_nodes[n.data.key]) {
          return { ...n, data: { ...n.data, dbId: result.created_nodes[n.data.key] } };
        }
        if (isGroupNode(n) && n.data.dbId === null && result.created_groups[n.data.clientKey]) {
          return { ...n, data: { ...n.data, dbId: result.created_groups[n.data.clientKey] } };
        }
        return n;
      }));
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      notify(`Layout nicht gespeichert: ${e instanceof ApiError ? e.message : String(e)}`, 'danger');
    } finally {
      savingRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        window.setTimeout(() => void save(), 0);
      }
    }
  }, [api, canEditLayout, grid, notify, setNodes]);

  // Detect changes and autosave
  useEffect(() => {
    if (loading || !canEditLayout) return;
    if (nodes.some((n) => n.dragging || n.resizing)) return;
    const payload = diffLayout(savedRef.current, snapshotFromNodes(nodes, grid));
    if (!payload) {
      if (!savingRef.current) setSaveState((s) => (s === 'error' ? s : 'saved'));
      return;
    }
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
    if (!autosave || readOnly) return;
    const timer = window.setTimeout(() => void save(), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [nodes, autosave, readOnly, loading, canEditLayout, grid, save]);

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

  const edges = useMemo(() => {
    const list = buildEdges(graphEdges, placedKeys, { showRunsOn });
    return list.map((e) => (e.data?.kind === 'flow' && e.data.flow.id === selectedFlowId
      ? { ...e, selected: true, className: `${e.className} nsc-edge-selected` }
      : e));
  }, [graphEdges, placedKeys, showRunsOn, selectedFlowId]);

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
      data: { kind: 'group', clientKey, dbId: null, name: 'Neue Gruppe', color: '607d8b' },
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
    if (!layoutEditable) return false;
    // Groups: keep their members (React Flow would delete children together with the parent)
    const groups = toDelete.filter(isGroupNode);
    for (const g of groups) deleteGroup(g.id);
    const objects = toDelete.filter((n) => isObjectNode(n));
    // Connections are never deleted with the keyboard; use the edge panel for that
    return { nodes: objects, edges: [] };
  }, [deleteGroup, layoutEditable]);

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
      window.setTimeout(() => fitView({ duration: 400, maxZoom: 1.2 }), 50);
    } catch (e) {
      notify(`Auto-Layout fehlgeschlagen: ${(e as Error).message}`, 'danger');
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
        notify('Nichts zu ergänzen – alle zugehörigen Objekte sind schon im Canvas.', 'info');
        return;
      }
      if (keys.length > 40 && !window.confirm(`${keys.length} Objekte hinzufügen?`)) return;
      addNodes(placeNew(nodesRef.current, keys, objects, grid), objects);
      notify(`${keys.length} Objekt(e) ergänzt.`, 'success');
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
      const vp = getViewportForBounds(bounds, width, height, 0.1, 2, padding);
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
      notify(`Export fehlgeschlagen: ${(e as Error).message}`, 'danger');
    } finally {
      setBusy(false);
    }
  }, [colorMode, config.canvas.name, notify]);

  const onNewService = useCallback(() => {
    const selectedHosts = nodesRef.current.filter(
      (n): n is ObjectNodeType => n.selected === true && isObjectNode(n) && !!n.data.desc && n.data.desc.type !== 'service',
    );
    const parsed = selectedHosts.length === 1 ? parseKey(selectedHosts[0].data.key) : null;
    setNewService({ parent: parsed });
  }, []);

  const onServiceCreated = useCallback((serviceKey: string, parentKey: string) => {
    setNewService(null);
    notify('Service angelegt.', 'success');
    const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
    const parent = byId.get(parentKey);
    if (parent) {
      const p = absolutePosition(parent, byId);
      const siblings = nodesRef.current.filter(
        (n) => isObjectNode(n) && n.data.desc?.service?.parent_key === parentKey,
      ).length;
      addNodes({ [serviceKey]: { x: p.x + siblings * (NODE_WIDTH + 20), y: p.y + NODE_HEIGHT + 60 } });
    } else {
      addAtCenter(serviceKey);
    }
  }, [addAtCenter, addNodes, notify]);

  const contextValue: EditorContextValue = useMemo(() => ({
    api, perms, readOnly, grid, updateGroup, deleteGroup, notify,
  }), [api, perms, readOnly, grid, updateGroup, deleteGroup, notify]);

  if (loadError) {
    return (
      <div className="alert alert-danger m-3">
        Canvas konnte nicht geladen werden: {loadError}
        <button type="button" className="btn btn-sm btn-outline-danger ms-3" onClick={() => void initialLoad()}>
          Erneut versuchen
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
          onReload={() => {
            if (saveState !== 'saved' && !window.confirm('Ungespeicherte Layout-Änderungen verwerfen?')) return;
            setSelectedFlowId(null);
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
              canEdit={layoutEditable}
            />
          )}
          <div className="nsc-flow" ref={wrapperRef} onDragOver={onDragOver} onDrop={onDrop}>
            {loading && <div className="nsc-overlay text-muted">Lade Canvas…</div>}
            {!loading && nodes.length === 0 && (
              <div className="nsc-overlay nsc-empty text-muted">
                {layoutEditable
                  ? 'Der Canvas ist leer. Ziehe Devices, VMs oder Services aus der Seitenleiste hierher.'
                  : 'Der Canvas ist leer.'}
              </div>
            )}
            <ReactFlow<CanvasNode, CanvasEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onNodeDragStop={onNodeDragStop}
              onBeforeDelete={onBeforeDelete}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              connectionMode={ConnectionMode.Loose}
              onEdgeClick={(_, edge) => {
                if (edge.data?.kind === 'flow') setSelectedFlowId(edge.data.flow.id);
              }}
              onPaneClick={() => setSelectedFlowId(null)}
              nodesDraggable={layoutEditable}
              nodesConnectable={!readOnly && (perms.add_connection || perms.change_service)}
              elementsSelectable
              deleteKeyCode={layoutEditable ? ['Delete', 'Backspace'] : null}
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
              source={descriptorFor(selectedFlow.source)}
              target={descriptorFor(selectedFlow.target)}
              onClose={() => setSelectedFlowId(null)}
              onChanged={() => void refreshGraph()}
            />
          )}
        </div>
        <div className="nsc-legend small text-muted">
          <span><span className="nsc-legend-line active" /> aktiv</span>
          <span><span className="nsc-legend-line planned" /> geplant</span>
          <span><span className="nsc-legend-line disabled" /> deaktiviert</span>
          <span><span className="nsc-legend-line runs-on" /> läuft auf</span>
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
        <div className="nsc-toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`alert alert-${t.kind} py-2 px-3 mb-2 shadow-sm`}>{t.message}</div>
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
