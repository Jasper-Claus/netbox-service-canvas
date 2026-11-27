import { describe, expect, it } from 'vitest';
import {
  applySaveResult,
  buildEdges,
  buildNodes,
  cableLabel,
  computeImpact,
  diffLayout,
  findGroupAt,
  flowEdge,
  flowLabel,
  impactRole,
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
import { searchObjects } from './components/CanvasSearch';
import { addHandles, bezierPoint, halfway, smoothPath } from './components/FlowEdge';
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
  notes: [],
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
    part_of: [],
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

  it('applies the per-canvas line style (bend points, color)', () => {
    const e = flowEdge(flow, { points: [{ x: 10, y: 20 }], color: 'ae3ec9' });
    expect(e.type).toBe('flow');
    expect(e.style?.stroke).toBe('#ae3ec9');
    expect(e.data).toMatchObject({ kind: 'flow', points: [{ x: 10, y: 20 }], color: 'ae3ec9' });
    const plain = buildEdges(graph.edges, new Set(['dcim.device:1', 'ipam.service:1', 'ipam.service:2']), undefined, {});
    const plainFlow = plain.find((x) => x.data?.kind === 'flow')!;
    expect(plainFlow.data).toMatchObject({ points: [] });
  });

  it('draws a smooth line through the bend points', () => {
    expect(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe('M 0,0 C 1.6666666666666667,0 8.333333333333334,0 10,0');
    const path = smoothPath([{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }]);
    expect(path.match(/C /g)).toHaveLength(2);
    expect(path.endsWith('100,0')).toBe(true);
    expect(halfway([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toEqual({ x: 50, y: 0 });
    expect(halfway([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 30 }])).toEqual({ x: 10, y: 10 });
  });

  it('places the add handles away from the label', () => {
    const bezier = 'M0,0 C50,0 50,100 100,100';
    expect(bezierPoint(bezier, 0.5)).toEqual({ x: 50, y: 50 });
    const ends = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    // Straight-ish line without points: two handles on the curve, none on the label in the middle
    const plain = addHandles(ends, [], bezier, { x: 50, y: 50 }, 40);
    expect(plain.map((h) => h.index)).toEqual([0, 0]);
    expect(plain[0].at).toEqual(bezierPoint(bezier, 0.25));
    expect(plain[1].at).toEqual(bezierPoint(bezier, 0.75));
    // With a point: one handle per segment, the one under the label moves aside
    const all = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const bent = addHandles(all, [{ x: 100, y: 0 }], bezier, { x: 50, y: 0 }, 40);
    expect(bent).toEqual([
      { index: 0, at: { x: 25, y: 0 } },
      { index: 1, at: { x: 100, y: 50 } },
    ]);
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

describe('applications', () => {
  const APP = 'netbox_service_canvas.application:4';
  const edges = {
    ...graph.edges,
    part_of: [{ id: `part_of:ipam.service:1:${APP}`, source: 'ipam.service:1', target: APP }],
  };

  it('shows part-of edges together with runs-on edges', () => {
    const all = new Set(['dcim.device:1', 'ipam.service:1', 'ipam.service:2', APP]);
    const built = buildEdges(edges, all);
    expect(built.map((e) => e.data?.kind).sort()).toEqual(['flow', 'part_of', 'runs_on']);
    expect(built.find((e) => e.data?.kind === 'part_of')!.className).toBe('nsc-edge-part-of');
    expect(buildEdges(edges, all, { showRunsOn: false })).toHaveLength(1);
  });

  it('keys applications by their plugin label', () => {
    expect(parseKey(APP)).toEqual({ label: 'netbox_service_canvas.application', id: 4 });
  });
});

describe('notes', () => {
  const withNote: GraphResponse = {
    ...graph,
    notes: [{ id: 5, text: 'Wartung Fr.', color: 'ffe082', x: 400, y: 400, width: 220, height: 140 }],
  };
  const base = buildNodes(withNote, 10);
  const saved = snapshotFromNodes(base, 10);

  it('builds note nodes', () => {
    const note = base.find((n) => n.id === 'note:db-5')!;
    expect(note.type).toBe('note');
    expect(saved.notes['db-5'].text).toBe('Wartung Fr.');
    expect(diffLayout(saved, snapshotFromNodes(base, 10))).toBeNull();
  });

  it('sends changed, new and deleted notes', () => {
    const edited = base.map((n) => (n.id === 'note:db-5' && n.type === 'note'
      ? { ...n, data: { ...n.data, text: 'Neu' } }
      : n)) as CanvasNode[];
    const payload = diffLayout(saved, snapshotFromNodes(edited, 10))!;
    expect(payload.notes).toEqual([{ id: 5, text: 'Neu', color: 'ffe082', x: 400, y: 400, width: 220, height: 140 }]);

    const added: CanvasNode = {
      id: 'note:new-n', type: 'note', position: { x: 0, y: 0 }, width: 200, height: 100,
      data: { kind: 'note', clientKey: 'new-n', dbId: null, text: '', color: 'c8e6c9' },
    };
    const current = [...base.filter((n) => n.id !== 'note:db-5'), added];
    const snapshot = snapshotFromNodes(current, 10);
    const p2 = diffLayout(saved, snapshot)!;
    expect(p2.deleted_notes).toEqual([5]);
    expect(p2.notes).toEqual([{ key: 'new-n', text: '', color: 'c8e6c9', x: 0, y: 0, width: 200, height: 100 }]);

    const after = applySaveResult(snapshot, {}, {}, { 'new-n': 8 });
    expect(after.notes['new-n'].dbId).toBe(8);
  });
});

describe('impact analysis', () => {
  const APP = 'netbox_service_canvas.application:4';
  const edges = {
    runs_on: [
      { id: 'r1', source: 'ipam.service:1', target: 'dcim.device:1' },
      { id: 'r2', source: 'ipam.service:3', target: 'dcim.device:2' },
    ],
    part_of: [{ id: 'p1', source: 'ipam.service:1', target: APP }],
    flows: [
      // service 2 sends data to service 1 -> depends on it
      { ...flow, id: 1, source: 'ipam.service:2', target: 'ipam.service:1' },
      // service 3 depends on service 2 (transitive)
      { ...flow, id: 2, source: 'ipam.service:3', target: 'ipam.service:2' },
      // disabled flows are ignored
      { ...flow, id: 3, source: 'ipam.service:9', target: 'ipam.service:1', status: 'disabled' as const },
    ],
  };

  it('propagates host failure to services, applications and dependents', () => {
    const impact = computeImpact('dcim.device:1', edges);
    expect([...impact.direct].sort()).toEqual([APP, 'ipam.service:1'].sort());
    expect([...impact.indirect].sort()).toEqual(['ipam.service:2', 'ipam.service:3']);
    expect([...impact.flows].sort()).toEqual([1, 2]);
    expect(impactRole(impact, 'dcim.device:1')).toBe('root');
    expect(impactRole(impact, 'ipam.service:1')).toBe('direct');
    expect(impactRole(impact, 'ipam.service:3')).toBe('indirect');
    expect(impactRole(impact, 'dcim.device:2')).toBe('none');
    expect(impactRole(impact, 'ipam.service:9')).toBe('none');
    expect(impactRole(null, 'x')).toBeUndefined();
  });

  it('treats bidirectional flows as dependencies both ways', () => {
    const bi = { ...edges, flows: [{ ...flow, id: 5, source: 'ipam.service:1', target: 'ipam.service:2', direction: 'bi' as const }] };
    const impact = computeImpact('ipam.service:2', bi);
    expect(impact.indirect.has('ipam.service:1')).toBe(true);
    // ... and the application of service 1 is NOT structurally failed, it only loses a dependency of its service
    expect(impact.direct.size).toBe(0);
  });

  it('cascades from a hypervisor to its VMs, their services and applications', () => {
    const VM = 'virtualization.virtualmachine:7';
    const hosted = {
      runs_on: [
        { id: `runs_on:${VM}`, source: VM, target: 'dcim.device:1' },
        { id: 'r1', source: 'ipam.service:1', target: VM },
      ],
      part_of: [{ id: 'p1', source: 'ipam.service:1', target: APP }],
      flows: [{ ...flow, id: 1, source: 'ipam.service:2', target: 'ipam.service:1' }],
    };
    const impact = computeImpact('dcim.device:1', hosted);
    expect([...impact.direct].sort()).toEqual([APP, 'ipam.service:1', VM].sort());
    expect([...impact.indirect]).toEqual(['ipam.service:2']);
    // A failing VM does not take its host down
    expect(computeImpact(VM, hosted).direct.has('dcim.device:1')).toBe(false);
  });

  it('marks targets behind a failed reverse proxy as unreachable', () => {
    const PROXY = 'ipam.service:10';
    const PROXY2 = 'ipam.service:11';
    const proxied = {
      runs_on: [{ id: 'r1', source: PROXY, target: 'dcim.device:9' }],
      part_of: [{ id: 'p1', source: 'ipam.service:1', target: APP }],
      flows: [
        // traefik -> paperless / traefik -> second proxy -> grafana
        { ...flow, id: 1, source: PROXY, target: 'ipam.service:1', kind: 'proxy' as const },
        { ...flow, id: 2, source: PROXY, target: PROXY2, kind: 'proxy' as const },
        { ...flow, id: 3, source: PROXY2, target: 'ipam.service:3', kind: 'proxy' as const },
        // paperless uses postgres: unaffected by the proxy
        { ...flow, id: 4, source: 'ipam.service:1', target: 'ipam.service:5' },
      ],
    };
    const impact = computeImpact('dcim.device:9', proxied);
    expect([...impact.direct]).toEqual([PROXY]);
    expect([...impact.unreachable].sort()).toEqual([APP, 'ipam.service:1', PROXY2, 'ipam.service:3'].sort());
    expect(impact.indirect.size).toBe(0);
    expect([...impact.flows].sort()).toEqual([1, 2, 3]);
    expect(impactRole(impact, 'ipam.service:1')).toBe('unreachable');
    expect(impactRole(impact, 'ipam.service:5')).toBe('none');
    // A failing backend does not affect its proxy
    expect(computeImpact('ipam.service:1', proxied).indirect.has(PROXY)).toBe(false);
  });

  it('breaks connections whose hop fails', () => {
    const viaHop = {
      runs_on: [],
      part_of: [],
      flows: [
        { ...flow, id: 1, source: 'ipam.service:2', target: 'ipam.service:1', hop_keys: ['ipam.service:7'] },
        { ...flow, id: 2, source: 'ipam.service:7', target: 'ipam.service:3', kind: 'proxy' as const, hop_keys: ['dcim.device:4'] },
      ],
    };
    const hopFails = computeImpact('ipam.service:7', viaHop);
    expect([...hopFails.indirect]).toEqual(['ipam.service:2']);
    expect(hopFails.flows.has(1)).toBe(true);
    // A failing hop of a proxy connection makes its target unreachable
    expect([...computeImpact('dcim.device:4', viaHop).unreachable]).toEqual(['ipam.service:3']);
  });
});

describe('canvas search', () => {
  const obj = (key: string, name: string, extra: Partial<ObjectDescriptor> = {}): ObjectDescriptor => ({
    key, type: 'service', id: 1, name, url: '', status: null, primary_ip: null, subtitle: '', ...extra,
  });
  const objects = [
    obj('ipam.service:1', 'postgres', { subtitle: 'TCP 5432', service: { protocol: 'tcp', protocol_label: 'TCP', ports: [5432], parent_key: 'x', parent_type: 'vm', parent_name: 'db-vm' } }),
    obj('ipam.service:2', 'paperless'),
    obj('dcim.device:1', 'pve1', { type: 'device', primary_ip: '10.0.0.5/24' }),
    obj('netbox_service_canvas.application:1', 'PostgreSQL', { type: 'application' }),
    obj('ipam.service:3', 'grafana-postgres-exporter'),
  ];
  const names = (q: string) => searchObjects(objects, q).map((d) => d.name);

  it('ranks names that start with the query first', () => {
    expect(names('post')).toEqual(['postgres', 'PostgreSQL', 'grafana-postgres-exporter']);
    expect(names('PAPER')).toEqual(['paperless']);
  });

  it('finds objects by host, IP and port, and needs every word to match', () => {
    expect(names('db-vm')).toEqual(['postgres']);
    expect(names('10.0.0')).toEqual(['pve1']);
    expect(names('5432')).toEqual(['postgres']);
    expect(names('postgres db-vm')).toEqual(['postgres']);
    expect(names('nothing here')).toEqual([]);
    expect(names('   ')).toEqual([]);
  });
});

describe('physical layer (cables)', () => {
  const SW = 'dcim.device:10';
  const SRV1 = 'dcim.device:11';
  const SRV2 = 'dcim.device:12';
  const ROUTER = 'dcim.device:13';
  const VM = 'virtualization.virtualmachine:5';
  const SVC = 'ipam.service:20';
  const APP = 'netbox_service_canvas.application:9';
  const cable = (source: string, target: string, interfaces: [string, string][] = [['eth0', 'port1']]) => ({
    id: `cable:${source}-${target}`, source, target, interfaces, cable_ids: [1], active: true, patched: false,
  });
  const edges = {
    runs_on: [
      { id: 'r1', source: VM, target: SRV1 },
      { id: 'r2', source: SVC, target: VM },
    ],
    part_of: [{ id: 'p1', source: SVC, target: APP }],
    flows: [],
    // srv1 only hangs on the switch, srv2 on the switch and the router
    cables: [cable(SRV1, SW), cable(SRV2, SW), cable(SRV2, ROUTER), cable(SW, ROUTER)],
  };

  it('labels cables with their interfaces', () => {
    expect(cableLabel(cable(SRV1, SW))).toBe('eth0 ↔ port1');
    expect(cableLabel(cable(SRV1, SW, [['eth0', 'port1'], ['eth1', 'port2']]))).toBe('eth0 ↔ port1 +1');
  });

  it('builds cable edges and hides them on request', () => {
    const present = new Set([SW, SRV1]);
    const shown = buildEdges(edges, present, { showRunsOn: true });
    expect(shown.filter((e) => e.data?.kind === 'cable').map((e) => e.id)).toEqual([`cable:${SRV1}-${SW}`]);
    const hidden = buildEdges(edges, present, { showRunsOn: true, showCables: false });
    expect(hidden.some((e) => e.data?.kind === 'cable')).toBe(false);
  });

  it('makes devices behind a failed switch unreachable, with everything on them', () => {
    const impact = computeImpact(SW, edges);
    expect([...impact.unreachable].sort()).toEqual([APP, SRV1, SVC, VM].sort());
    // srv2 still has a cable to the router, the router to srv2
    expect(impactRole(impact, SRV2)).toBe('none');
    expect(impactRole(impact, ROUTER)).toBe('none');
  });

  it('does not take the switch down when a server fails', () => {
    const impact = computeImpact(SRV1, edges);
    expect(impact.unreachable.size).toBe(0);
    expect([...impact.direct].sort()).toEqual([SVC, VM, APP].sort());
  });
});
