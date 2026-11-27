# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [0.5.0] – 2026-11-27

### Added
- **NetBox 4.6 and 4.7 support** ([#10](https://github.com/Jasper-Claus/netbox-service-canvas/issues/10),
  [#11](https://github.com/Jasper-Claus/netbox-service-canvas/issues/11)). The plugin now runs on NetBox 4.5, 4.6
  and 4.7.
- Services with several protocols (NetBox 4.7 `port_mappings`, e.g. `tcp/53` and `udp/53`) show all their ports on
  the canvas, in the node panel and in the sidebar.

### Changed
- `max_version` is `4.7.99`. CI runs the Django tests against NetBox v4.5.7 and the newest 4.5, 4.6 and 4.7 release.
- The graph API returns `ports_label` and `multi_protocol` for services.
- Quick edit in the node panel only renames a service with several protocols; its ports are edited in NetBox.
- Dependabot no longer opens pull requests for major versions of frontend packages (security updates still arrive).
- README: complete feature list, German README with *What this is not*.

### Fixed
- On NetBox 4.7 every canvas containing a service failed to load (`get_protocol_display` no longer exists on
  services).

## [0.4.0] – 2026-11-27

Shaped by the feedback on the 0.3.0 announcement: the plugin stays a documentation tool (impact assessment, design,
security review) and does not become a monitoring tool. New features use data that is already in NetBox where
possible, and the test suite is fully green again.

### Added
- **Bendable connection lines**: select a line in edit mode and drag the small dots to add bend points. Double-click a
  point to remove it, *Reset shape* straightens the line again. The shape is saved per canvas.
- **Line colours**: pick a colour for a connection on this canvas in the connection panel (default: status colour).
- **Proxy connections** (new field *Kind* on service connections): *Proxy* means the target is reached through the
  source, for example a reverse proxy in front of an app. The impact analysis marks everything behind a failed proxy
  in yellow as *unreachable*, including proxy chains and the applications of those services.
- **Hops count in the impact analysis**: if a hop of a connection fails, the connection breaks.
- **Physical layer**: cables documented in NetBox are shown between devices on the canvas (interface names as label,
  several links between the same devices merged, paths through patch panels count as one link). Toggle it in the
  toolbar. *Add missing* also adds cabled devices such as switches. In the impact analysis, a device whose cables all
  lead to failed devices becomes unreachable, together with everything running on it. The panel of a device lists its
  cables (own interface → other device and port).
- **Search on the canvas**: a small search field in the toolbar finds objects by name, host, IP or port and jumps
  to them.
- **Application icons**: choose one of 24 icons (database, web, DNS, backup, media, …) for an application. It is shown
  on the canvas, in the sidebar and in the node panel.

### Changed
- Migration `0003` adds `Application.icon`, `ServiceConnection.kind` (default *uses*, so existing connections behave
  as before) and `Canvas.edge_styles`.
- `PUT …/canvases/<id>/layout/` accepts and returns `edge_styles`; the graph API returns `kind` and `hop_keys` for
  each connection and `cables` for the physical layer.
- The Django tests are now required in CI (no longer `continue-on-error`).
- README: new section *What this is not* (no monitoring, no discovery).

### Fixed
- Creating several hops in one bulk API request without an explicit order failed with a duplicate order error.
- `POST …/connections/<id>/reorder-hops/` required the *add* permission on connections; it now needs *view* on the
  connection and *change* on its hops, as documented.
- The 6 failing Django tests (hop bulk create, GraphQL, reorder, layout permission) pass.

### Project
- `SECURITY.md` with a private reporting channel, Dependabot for frontend dependencies, GitHub Actions and Python
  packaging.
- `dev/test_scenario.py`: a ready-made test lab (reverse proxy chain, hops, switch with cables, app icons).

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

[Unreleased]: https://github.com/Jasper-Claus/netbox-service-canvas/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/Jasper-Claus/netbox-service-canvas/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Jasper-Claus/netbox-service-canvas/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Jasper-Claus/netbox-service-canvas/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Jasper-Claus/netbox-service-canvas/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Jasper-Claus/netbox-service-canvas/releases/tag/v0.1.0
