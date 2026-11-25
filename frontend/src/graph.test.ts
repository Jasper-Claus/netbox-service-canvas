import { describe, expect, it } from 'vitest';
import {
  applySaveResult,
  buildEdges,
  buildNodes,
  diffLayout,
  findGroupAt,
  flowEdge,
  flowLabel,
  makeKey,
  parseKey,
  placeNew,
  reparent,
  snap,
  snapshotFromNodes,
  sortParentsFirst,
  type CanvasNode,
} from './graph';
import { runsOnPair } from './components/ConnectDialog';
import type { Flow, GraphResponse, ObjectDescriptor } from './types';
import { parsePorts, slugify } from './util';

function desc(key: string, type: ObjectDescriptor['type'], extra: Partial<ObjectDescriptor> = {}): ObjectDescriptor {
  const parsed = parseKey(key)!;
  return { key, type, id: parsed.id, name: key, url: '/x/', status: null, primary_ip: null, subtitle: '', ...extra };
}

const flow: Flow = {
  id: 7,
  source: 'ipam.service:1',
  target: 'ipam.service:2',
  direction: 'uni',
  protocol: 'https',
  protocol_label: 'HTTPS',
  port: 443,
  status: 'active',
  status_label: 'Active',
  data_description: 'Metriken',
  description: '',
  hop_count: 0,
  url: '/plugins/service-canvas/connections/7/',
};

const graph: GraphResponse = {
  canvas: 1,
  grid_size: 10,
  groups: [{ id: 3, name: 'Rack', color: '2196f3', x: 100, y: 100, width: 400, height: 300 }],
  nodes: [
    { id: 11, object_type: 'dcim.device', object_id: 1, x: 0, y: 0, width: null, height: null, group: null },
    { id: 12, object_type: 'ipam.service', object_id: 1, x: 20, y: 60, width: null, height: null, group: 3 },
    { id: 13, object_type: 'ipam.service', object_id: 2, x: 600, y: 0, width: null, height: null, group: null },
  ],
  objects: {
    'dcim.device:1': desc('dcim.device:1', 'device'),
    'ipam.service:1': desc('ipam.service:1', 'service', {
      service: { protocol: 'tcp', protocol_label: 'TCP', ports: [443], parent_key: 'dcim.device:1', parent_type: 'dcim.device', parent_name: 'rick' },
    }),
    'ipam.service:2': desc('ipam.service:2', 'service'),
  },
  edges: {
    runs_on: [{ id: 'runs_on:ipam.service:1', source: 'ipam.service:1', target: 'dcim.device:1' }],
    flows: [flow],
  },
};

describe('keys', () => {
  it('round-trips keys', () => {
    expect(makeKey('ipam.service', 12)).toBe('ipam.service:12');
    expect(parseKey('ipam.service:12')).toEqual({ label: 'ipam.service', id: 12 });
    expect(parseKey('garbage')).toBeNull();
    expect(parseKey('ipam.service:x')).toBeNull();
    expect(parseKey('ipam.service:0')).toBeNull();
  });
});

describe('snap', () => {
  it('snaps to the grid', () => {
    expect(snap(14, 10)).toBe(10);
    expect(snap(15, 10)).toBe(20);
    expect(snap(-14, 10)).toBe(-10);
    expect(snap(1.234, 0)).toBe(1.23);
  });
});

describe('buildNodes / buildEdges', () => {
  it('creates group and object nodes with parent relations', () => {
    const nodes = buildNodes(graph, 10);
    expect(nodes).toHaveLength(4);
    const svc = nodes.find((n) => n.id === 'ipam.service:1')!;
    expect(svc.parentId).toBe('group:db-3');
    expect(sortParentsFirst(nodes)[0].type).toBe('group');
  });

  it('only shows edges between present nodes', () => {
    const all = new Set(['dcim.device:1', 'ipam.service:1', 'ipam.service:2']);
    expect(buildEdges(graph.edges, all)).toHaveLength(2);
    expect(buildEdges(graph.edges, all, { showRunsOn: false })).toHaveLength(1);
    expect(buildEdges(graph.edges, new Set(['ipam.service:1']))).toHaveLength(0);
  });

  it('styles flows by status and direction', () => {
    expect(flowLabel(flow)).toBe('HTTPS 443 · Metriken');
    const e = flowEdge(flow);
    expect(e.markerStart).toBeUndefined();
    expect(e.markerEnd).toBeDefined();
    const bi = flowEdge({ ...flow, direction: 'bi', status: 'planned' });
    expect(bi.markerStart).toBeDefined();
    expect(bi.style?.strokeDasharray).toBe('6 4');
  });
});

describe('layout diff', () => {
  const base = buildNodes(graph, 10);
  const saved = snapshotFromNodes(base, 10);

  it('returns null when nothing changed', () => {
    expect(diffLayout(saved, snapshotFromNodes(base, 10))).toBeNull();
  });

  it('only sends moved nodes', () => {
    const moved = base.map((n) => (n.id === 'dcim.device:1' ? { ...n, position: { x: 50, y: 0 } } : n));
    const payload = diffLayout(saved, snapshotFromNodes(moved, 10))!;
    expect(payload.nodes).toEqual([{ id: 11, x: 50, y: 0, group: null }]);
    expect(payload.groups).toEqual([]);
  });

  it('ignores sub-grid jitter', () => {
    const jitter = base.map((n) => (n.id === 'dcim.device:1' ? { ...n, position: { x: 2, y: -3 } } : n));
    expect(diffLayout(saved, snapshotFromNodes(jitter, 10))).toBeNull();
  });

  it('handles new nodes, new groups and deletions', () => {
    const newNode: CanvasNode = {
      id: 'virtualization.virtualmachine:5',
      type: 'object',
      position: { x: 10, y: 10 },
      parentId: 'group:new-a',
      data: { kind: 'object', key: 'virtualization.virtualmachine:5', dbId: null, desc: null },
    };
    const newGroup: CanvasNode = {
      id: 'group:new-a',
      type: 'group',
      position: { x: 800, y: 0 },
      width: 300,
      height: 200,
      data: { kind: 'group', clientKey: 'new-a', dbId: null, name: 'Neu', color: '607d8b' },
    };
    const current = [...base.filter((n) => n.id !== 'ipam.service:2' && n.id !== 'group:db-3'), newGroup, newNode]
      // service:1 lost its group (deleted) -> becomes top level
      .map((n) => (n.id === 'ipam.service:1' ? { ...n, parentId: undefined, position: { x: 120, y: 160 } } : n));
    const snapshot = snapshotFromNodes(current, 10);
    const payload = diffLayout(saved, snapshot)!;
    expect(payload.deleted_nodes).toEqual([13]);
    expect(payload.deleted_groups).toEqual([3]);
    expect(payload.groups).toEqual([{ key: 'new-a', name: 'Neu', color: '607d8b', x: 800, y: 0, width: 300, height: 200 }]);
    expect(payload.nodes).toContainEqual({ id: 12, x: 120, y: 160, group: null });
    expect(payload.nodes).toContainEqual({
      object_type: 'virtualization.virtualmachine', object_id: 5, x: 10, y: 10, group_key: 'new-a',
    });

    const after = applySaveResult(snapshot, { 'new-a': 9 }, { 'virtualization.virtualmachine:5': 20 });
    expect(after.groups['new-a'].dbId).toBe(9);
    expect(after.nodes['virtualization.virtualmachine:5'].dbId).toBe(20);
    // Once IDs are known and nothing moved, there is nothing left to save
    const withIds = current.map((n) => {
      if (n.id === 'group:new-a') return { ...n, data: { ...n.data, dbId: 9 } } as CanvasNode;
      if (n.id === 'virtualization.virtualmachine:5') return { ...n, data: { ...n.data, dbId: 20 } } as CanvasNode;
      return n;
    });
    expect(diffLayout(after, snapshotFromNodes(withIds, 10))).toBeNull();
  });
});

describe('grouping', () => {
  it('reparents while keeping the absolute position', () => {
    const nodes = sortParentsFirst(buildNodes(graph, 10));
    const out = reparent(nodes, 'ipam.service:1', null);
    const svc = out.find((n) => n.id === 'ipam.service:1')!;
    expect(svc.parentId).toBeUndefined();
    expect(svc.position).toEqual({ x: 120, y: 160 });
    const back = reparent(out, 'ipam.service:1', 'group:db-3');
    expect(back.find((n) => n.id === 'ipam.service:1')!.position).toEqual({ x: 20, y: 60 });
  });

  it('finds the group under a node', () => {
    const nodes = buildNodes(graph, 10);
    expect(findGroupAt(nodes, { x: 200, y: 200, width: 100, height: 40 })?.id).toBe('group:db-3');
    expect(findGroupAt(nodes, { x: 900, y: 900, width: 100, height: 40 })).toBeNull();
  });
});

describe('placeNew', () => {
  it('places services below their parent and other objects in a new row', () => {
    const nodes = buildNodes(graph, 10).filter((n) => n.id === 'dcim.device:1');
    const descriptors = {
      'ipam.service:9': desc('ipam.service:9', 'service', {
        service: { protocol: 'tcp', protocol_label: 'TCP', ports: [22], parent_key: 'dcim.device:1', parent_type: 'dcim.device', parent_name: 'rick' },
      }),
      'dcim.device:2': desc('dcim.device:2', 'device'),
    };
    const pos = placeNew(nodes, ['ipam.service:9', 'dcim.device:2'], descriptors, 10);
    expect(pos['ipam.service:9'].y).toBeGreaterThan(0);
    expect(pos['dcim.device:2'].y).toBeGreaterThan(0);
    expect(Math.abs(pos['ipam.service:9'].x % 10)).toBe(0);
  });
});

describe('runsOnPair', () => {
  it('detects service/host pairs in both directions', () => {
    const s = desc('ipam.service:1', 'service');
    const h = desc('dcim.device:1', 'device');
    expect(runsOnPair(s, h)?.host.key).toBe('dcim.device:1');
    expect(runsOnPair(h, s)?.service.key).toBe('ipam.service:1');
    expect(runsOnPair(s, s)).toBeNull();
    expect(runsOnPair(h, h)).toBeNull();
  });
});

describe('util', () => {
  it('parses port lists', () => {
    expect(parsePorts('80, 443')).toEqual([80, 443]);
    expect(parsePorts('8000-8002 22')).toEqual([22, 8000, 8001, 8002]);
    expect(parsePorts('0')).toBeNull();
    expect(parsePorts('70000')).toBeNull();
    expect(parsePorts('abc')).toBeNull();
    expect(parsePorts('')).toBeNull();
  });

  it('slugifies names', () => {
    expect(slugify('Homelab Übersicht!')).toBe('homelab-bersicht');
    expect(slugify('***')).toBe('canvas');
  });
});
