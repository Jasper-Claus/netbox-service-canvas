# REST API & GraphQL

All plugin objects are normal NetBox objects. The REST API works like the rest of NetBox: same authentication
(token or session), filters, bulk operations and brief mode.

Base URL: `/api/plugins/service-canvas/`

## Endpoints

| Endpoint | What it does |
|---|---|
| `applications/`, `connections/`, `connection-hops/`, `canvases/`, `canvas-groups/`, `canvas-nodes/`, `canvas-notes/` | Standard NetBox create, read, update, delete, including bulk and filters |
| `GET canvases/<id>/graph/` | Everything the editor needs in one request: layout, object details, edges |
| `GET canvases/<id>/missing/` | Related objects that are not on the canvas yet (used by *Add missing*) |
| `GET/PUT canvases/<id>/layout/` | Read the layout, or save it in one transaction (see below) |
| `POST connections/<id>/reorder-hops/` | `{"hops": [id, id, …]}` sets the order of the hops in one transaction |

Object keys have the form `app_label.model:pk`, for example `ipam.service:12`.

## Saving the layout

Only send what changed:

```json
PUT /api/plugins/service-canvas/canvases/1/layout/
{
  "groups": [{"key": "g1", "name": "Proxmox", "color": "2196f3", "x": 0, "y": 0, "width": 600, "height": 400}],
  "nodes": [
    {"id": 17, "x": 40, "y": 60, "group_key": "g1"},
    {"object_type": "ipam.service", "object_id": 12, "x": 300, "y": 60, "group": null}
  ],
  "notes": [{"key": "n1", "text": "Maintenance on Friday", "color": "ffe082", "x": 700, "y": 0, "width": 220, "height": 140}],
  "deleted_nodes": [5],
  "deleted_groups": [],
  "deleted_notes": []
}
```

- Without `group` / `group_key`, an existing node keeps its group. `"group": null` takes it out of its group.
- The response contains `created_groups`, `created_nodes` and `created_notes` (client key → new ID) and the counters
  `updated` and `deleted`.
- Positions and sizes are rounded to the grid (`grid_size`, default 10 px).

## GraphQL

Queries: `service_canvas_application(_list)`, `service_canvas_connection(_list)`,
`service_canvas_connection_hop(_list)`, `service_canvas_canvas(_list)`, `service_canvas_group(_list)`,
`service_canvas_node(_list)`, `service_canvas_note(_list)`.
