import type { EditorConfig, GraphResponse, Hop, LayoutPayload, ObjectDescriptor } from './types';

declare global {
  interface Window {
    CSRF_TOKEN?: string;
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(ApiError.format(status, body));
    this.status = status;
    this.body = body;
  }

  static format(status: number, body: unknown): string {
    if (body && typeof body === 'object') {
      const parts: string[] = [];
      for (const [field, value] of Object.entries(body as Record<string, unknown>)) {
        const text = Array.isArray(value) ? value.map(String).join(' ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
        parts.push(field === 'detail' || field === 'non_field_errors' ? text : `${field}: ${text}`);
      }
      if (parts.length) return parts.join(' · ');
    }
    return `HTTP ${status}`;
  }
}

function csrfToken(): string {
  if (window.CSRF_TOKEN) return window.CSRF_TOKEN;
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  const input = document.querySelector<HTMLInputElement>('input[name=csrfmiddlewaretoken]');
  return input?.value ?? '';
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRFToken'] = csrfToken();
  const response = await fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text.slice(0, 200) };
  }
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export interface ListResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

export interface BriefObject {
  id: number;
  display: string;
  name?: string;
  url?: string;
  description?: string;
}

/** Core NetBox API list endpoints, relative to the API root, by "app.model" label. */
export const CORE_ENDPOINTS: Record<string, string> = {
  'dcim.device': 'dcim/devices/',
  'virtualization.virtualmachine': 'virtualization/virtual-machines/',
  'ipam.service': 'ipam/services/',
  'dcim.interface': 'dcim/interfaces/',
  'virtualization.vminterface': 'virtualization/interfaces/',
  'ipam.vlan': 'ipam/vlans/',
  'ipam.vrf': 'ipam/vrfs/',
  'ipam.prefix': 'ipam/prefixes/',
  'ipam.ipaddress': 'ipam/ip-addresses/',
  'vpn.tunnel': 'vpn/tunnels/',
};

/** This plugin's own list endpoints, relative to the plugin API root. */
export const PLUGIN_ENDPOINTS: Record<string, string> = {
  'netbox_service_canvas.application': 'applications/',
};

export interface ApplicationData {
  name?: string;
  status?: string;
  version?: string;
  web_url?: string;
  description?: string;
  services?: number[];
}

export class Api {
  private root: string;
  private plugin: string;
  private canvasId: number;

  constructor(config: EditorConfig) {
    this.root = config.urls.api;
    this.plugin = config.urls.plugin_api;
    this.canvasId = config.canvas.id;
  }

  private canvasUrl(suffix: string, params: Record<string, string | undefined> = {}) {
    return `${this.plugin}canvases/${this.canvasId}/${suffix}${query(params)}`;
  }

  graph(include: string[] = []) {
    return request<GraphResponse>('GET', this.canvasUrl('graph/', { include: include.join(',') || undefined }));
  }

  missing(include: string[] = []) {
    return request<{ objects: Record<string, ObjectDescriptor> }>(
      'GET',
      this.canvasUrl('missing/', { include: include.join(',') || undefined }),
    );
  }

  saveLayout(payload: LayoutPayload) {
    return request<GraphResponse & {
      created_groups: Record<string, number>;
      created_nodes: Record<string, number>;
      created_notes: Record<string, number>;
      updated: number;
      deleted: number;
    }>('PUT', this.canvasUrl('layout/'), payload);
  }

  /** List URL for an "app.model" label (NetBox core or this plugin). */
  listUrl(label: string): string {
    if (PLUGIN_ENDPOINTS[label]) return `${this.plugin}${PLUGIN_ENDPOINTS[label]}`;
    return `${this.root}${CORE_ENDPOINTS[label]}`;
  }

  search(label: string, q: string, limit = 25, extra: Record<string, string | number | undefined> = {}) {
    return request<ListResponse<BriefObject>>(
      'GET',
      `${this.listUrl(label)}${query({ q, limit, brief: 1, ordering: 'name', ...extra })}`,
    );
  }

  /** Searches "app.model" objects without `ordering` (not every model has a name field). */
  searchAny(label: string, q: string, limit = 25) {
    return request<ListResponse<BriefObject>>('GET', `${this.listUrl(label)}${query({ q, limit, brief: 1 })}`);
  }

  updateService(id: number, data: Record<string, unknown>) {
    return request<{ id: number }>('PATCH', `${this.root}ipam/services/${id}/`, data);
  }

  createApplication(data: ApplicationData) {
    return request<{ id: number }>('POST', `${this.plugin}applications/`, data);
  }

  getApplication(id: number) {
    return request<Omit<ApplicationData, 'services'> & { id: number; services: BriefObject[] }>(
      'GET', `${this.plugin}applications/${id}/`,
    );
  }

  updateApplication(id: number, data: ApplicationData) {
    return request<{ id: number }>('PATCH', `${this.plugin}applications/${id}/`, data);
  }

  createService(data: {
    parent_object_type: string;
    parent_object_id: number;
    name: string;
    protocol: string;
    ports: number[];
    description?: string;
  }) {
    return request<{ id: number }>('POST', `${this.root}ipam/services/`, data);
  }

  setServiceParent(serviceId: number, parentType: string, parentId: number) {
    return request<{ id: number }>('PATCH', `${this.root}ipam/services/${serviceId}/`, {
      parent_object_type: parentType,
      parent_object_id: parentId,
    });
  }

  createConnection(data: Record<string, unknown>) {
    return request<{ id: number }>('POST', `${this.plugin}connections/`, data);
  }

  updateConnection(id: number, data: Record<string, unknown>) {
    return request<{ id: number }>('PATCH', `${this.plugin}connections/${id}/`, data);
  }

  deleteConnection(id: number) {
    return request<void>('DELETE', `${this.plugin}connections/${id}/`);
  }

  hops(connectionId: number) {
    return request<ListResponse<Hop>>(
      'GET',
      `${this.plugin}connection-hops/${query({ connection_id: connectionId, limit: 1000 })}`,
    );
  }

  addHop(connectionId: number, objectType: string, objectId: number, note: string) {
    return request<Hop>('POST', `${this.plugin}connection-hops/`, {
      connection: connectionId,
      object_type: objectType,
      object_id: objectId,
      note,
    });
  }

  updateHop(id: number, data: Record<string, unknown>) {
    return request<Hop>('PATCH', `${this.plugin}connection-hops/${id}/`, data);
  }

  deleteHop(id: number) {
    return request<void>('DELETE', `${this.plugin}connection-hops/${id}/`);
  }

  reorderHops(connectionId: number, hopIds: number[]) {
    return request<Hop[]>('POST', `${this.plugin}connections/${connectionId}/reorder-hops/`, { hops: hopIds });
  }
}
