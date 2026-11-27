export type ObjType = 'device' | 'virtualmachine' | 'service' | 'application';

export interface Status {
  value: string;
  label: string;
  color: string | null;
}

export interface ServiceInfo {
  protocol: string;
  protocol_label: string;
  ports: number[];
  parent_key: string;
  parent_type: string;
  parent_name: string;
}

export interface ApplicationInfo {
  version: string;
  /** Material Design icon class, e.g. "mdi-database"; empty = default icon. */
  icon?: string;
  web_url: string;
  description: string;
  service_keys: string[];
}

/** Compact description of a NetBox object, as returned by the plugin's graph endpoint. */
export interface ObjectDescriptor {
  key: string; // "<app_label>.<model>:<pk>"
  type: ObjType;
  id: number;
  name: string;
  url: string;
  status: Status | null;
  primary_ip: string | null;
  subtitle: string;
  service?: ServiceInfo;
  application?: ApplicationInfo;
  /** VMs only: key of the device the VM is pinned to in NetBox, if any. */
  host_key?: string | null;
}

export interface LayoutNode {
  id: number;
  object_type: string;
  object_id: number;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  group: number | null;
}

export interface LayoutGroup {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutNote {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ConnectionStatus = 'active' | 'planned' | 'disabled';
/** uses: the source needs the target. proxy: the target is reached through the source (reverse proxy, gateway). */
export type ConnectionKind = 'uses' | 'proxy';
export type Direction = 'uni' | 'bi';

export interface Flow {
  id: number;
  source: string;
  target: string;
  direction: Direction;
  protocol: string;
  protocol_label: string;
  port: number | null;
  status: ConnectionStatus;
  status_label: string;
  data_description: string;
  description: string;
  hop_count: number | null;
  /** Kind for the impact analysis; older backends do not send it ("uses"). */
  kind?: ConnectionKind;
  /** Keys of the objects the connection passes through (hops). */
  hop_keys?: string[];
  url: string;
}

export interface Point {
  x: number;
  y: number;
}

/** Per-canvas look of a connection line: bend points (canvas coordinates) and an optional color (rrggbb). */
export interface EdgeStyle {
  points: Point[];
  color?: string;
}

export type EdgeStyles = Record<string, EdgeStyle>;

export interface RunsOn {
  id: string;
  source: string; // service key, or VM key for a VM pinned to a device
  target: string; // host key (device or VM)
}

export interface PartOf {
  id: string;
  source: string; // service key
  target: string; // application key
}

/** Physical link between two devices, from the cables documented in NetBox (merged per device pair). */
export interface Cable {
  id: string;
  source: string; // device key
  target: string; // device key
  /** Interface names at both ends, one pair per link: [source side, target side]. */
  interfaces: [string, string][];
  cable_ids: number[];
  /** All cables of the link are "connected" (not planned or decommissioning). */
  active: boolean;
  /** The link runs through patch panels or other pass-through ports. */
  patched: boolean;
}

export interface GraphEdges {
  runs_on: RunsOn[];
  part_of: PartOf[];
  flows: Flow[];
  cables?: Cable[];
}

export interface GraphResponse {
  canvas: number;
  grid_size: number;
  groups: LayoutGroup[];
  nodes: LayoutNode[];
  notes: LayoutNote[];
  objects: Record<string, ObjectDescriptor>;
  edges: GraphEdges;
  edge_styles?: EdgeStyles;
}

export interface Perms {
  change_canvas: boolean;
  edit_layout: boolean;
  edit_groups: boolean;
  add_connection: boolean;
  change_connection: boolean;
  delete_connection: boolean;
  add_hop: boolean;
  change_hop: boolean;
  delete_hop: boolean;
  add_service: boolean;
  change_service: boolean;
  add_device: boolean;
  add_virtualmachine: boolean;
  add_application: boolean;
  change_application: boolean;
  edit_notes: boolean;
}

export interface EditorConfig {
  canvas: { id: number; name: string; site_id: number | null; cluster_id: number | null };
  urls: { api: string; plugin_api: string; canvas: string };
  grid_size: number;
  perms: Perms;
  focus: string;
  /** NetBox UI language of the user, e.g. "en" or "de". Older configs may not have it. */
  language?: string;
}

/** Layout state as stored by the backend (x/y relative to the group if a node belongs to one). */
export interface SnapNode {
  key: string;
  dbId: number | null;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  groupKey: string | null;
}

export interface SnapGroup {
  clientKey: string;
  dbId: number | null;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapNote {
  clientKey: string;
  dbId: number | null;
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Snapshot {
  nodes: Record<string, SnapNode>;
  groups: Record<string, SnapGroup>;
  notes: Record<string, SnapNote>;
}

export interface LayoutPayload {
  groups: Array<Record<string, unknown>>;
  nodes: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
  deleted_nodes: number[];
  deleted_groups: number[];
  deleted_notes: number[];
  /** Complete style map; only sent when it changed. */
  edge_styles?: EdgeStyles;
}

export interface Hop {
  id: number;
  order: number;
  object_type: string;
  object_id: number;
  object: { id: number; display: string; url?: string; display_url?: string } | null;
  note: string;
}
