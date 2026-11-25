export type ObjType = 'device' | 'virtualmachine' | 'service';

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

export type ConnectionStatus = 'active' | 'planned' | 'disabled';
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
  url: string;
}

export interface RunsOn {
  id: string;
  source: string; // service key
  target: string; // host key
}

export interface GraphResponse {
  canvas: number;
  grid_size: number;
  groups: LayoutGroup[];
  nodes: LayoutNode[];
  objects: Record<string, ObjectDescriptor>;
  edges: { runs_on: RunsOn[]; flows: Flow[] };
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
}

export interface EditorConfig {
  canvas: { id: number; name: string; site_id: number | null; cluster_id: number | null };
  urls: { api: string; plugin_api: string; canvas: string };
  grid_size: number;
  perms: Perms;
  focus: string;
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

export interface Snapshot {
  nodes: Record<string, SnapNode>;
  groups: Record<string, SnapGroup>;
}

export interface LayoutPayload {
  groups: Array<Record<string, unknown>>;
  nodes: Array<Record<string, unknown>>;
  deleted_nodes: number[];
  deleted_groups: number[];
}

export interface Hop {
  id: number;
  order: number;
  object_type: string;
  object_id: number;
  object: { id: number; display: string; url?: string; display_url?: string } | null;
  note: string;
}
