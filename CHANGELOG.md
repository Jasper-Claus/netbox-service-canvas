# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added
- **Bendable connection lines**: select a line in edit mode and drag the small dots to add bend points. Double-click a
  point to remove it, *Reset shape* straightens the line again. The shape is saved per canvas.
- **Line colours**: pick a colour for a connection on this canvas in the connection panel (default: status colour).
- **Proxy connections** (new field *Kind* on service connections): *Proxy* means the target is reached through the
  source, for example a reverse proxy in front of an app. The impact analysis marks everything behind a failed proxy
  in yellow as *unreachable*, including proxy chains and the applications of those services.
- **Hops count in the impact analysis**: if a hop of a connection fails, the connection breaks.
- **Application icons**: choose one of 24 icons (database, web, DNS, backup, media, …) for an application. It is shown
  on the canvas, in the sidebar and in the node panel.

### Changed
- Migration `0003` adds `Application.icon`, `ServiceConnection.kind` (default *uses*, so existing connections behave
  as before) and `Canvas.edge_styles`.
- `PUT …/canvases/<id>/layout/` accepts and returns `edge_styles`; the graph API returns `kind` and `hop_keys` for
  each connection.

## [0.3.0] – 2026-11-25

### Added
- **English user interface.** The editor follows the NetBox language setting: German when NetBox is set to German,
  English otherwise. New languages only need one dictionary file (`frontend/src/i18n.<lang>.ts`).
- **Install from PyPI**: `pip install netbox-service-canvas`. Releases are published automatically from GitHub
  (Trusted Publishing, no stored token).
- **VMs run on their device**: a VM pinned to a device (NetBox field *Device*) gets a "runs on" edge to it. The
  impact analysis now cascades from a hypervisor to its VMs, their services and applications. *Add missing* adds the
  VMs of a device and the device of a VM.

### Changed
- **Documentation**: installation guide rewritten (`collectstatic` in `Dockerfile-Plugins`, warning before NetBox
  upgrades, setup for netbox-docker without plugins, plain install, update, uninstall, troubleshooting). README
  restructured; API details, editor guide and impact analysis moved to the wiki.
- The wheel no longer contains the test suite.
- CI also runs the Django tests against NetBox v4.5.7 and the newest 4.5 release (non-blocking for now, see
  CONTRIBUTING.md).

## [0.2.0] – 2026-11-25

### Added
- **Applications** (e.g. Grafana, Paperless): status, version, URL and member services. Full NetBox UI, REST API,
  GraphQL, search, CSV import; *Applications* panel on service, device and VM pages; usable as connection endpoints
  and canvas nodes.
- **Dependency table**: *Connections* tab for applications; `application_id` filter on service connections.
- **Sticky notes** on the canvas (`CanvasNote`), saved with the layout.
- **Node panel** in the editor: details, connections, quick edit for services and applications, link to the NetBox
  form with return to the editor, remove from canvas.
- **Impact analysis**: highlights what fails with a node and what depends on it.
- **PDF export (DIN A4)** with header, date and legend, always in the light theme.
- *Remove* button above selected nodes; *Device* / *VM* buttons that open the NetBox form in a new tab; the sidebar
  reloads when you return.
- *New service* dialog can create a new application or add the service to an existing one.
- GitHub repository setup: CI, issue/PR templates, English README (German version in `docs/README.de.md`).

### Changed
- Redesigned *New service* / *New application* dialogs, object picker and sidebar.

### Fixed
- Change log and journal tabs failed with `TemplateDoesNotExist`.
- PNG/SVG/PDF export was zoomed out to a tiny diagram.

## [0.1.0] – 2026-11-24

### Added
- Initial release: `ServiceConnection`, `ConnectionHop`, canvases with groups and nodes, interactive editor (drag &
  drop, edge drawing, auto layout, autosave, PNG/SVG export), REST API, GraphQL and NetBox UI integration.

[0.3.0]: https://github.com/Jasper-Claus/netbox-service-canvas/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Jasper-Claus/netbox-service-canvas/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Jasper-Claus/netbox-service-canvas/releases/tag/v0.1.0
