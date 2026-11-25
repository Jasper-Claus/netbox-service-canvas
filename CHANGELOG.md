# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

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

[0.2.0]: https://github.com/Jasper-Claus/netbox-service-canvas/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Jasper-Claus/netbox-service-canvas/releases/tag/v0.1.0
