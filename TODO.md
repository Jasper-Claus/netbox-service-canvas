# TODO – netbox-service-canvas

**Stand 2026-11-25:** Phasen 1–6 als Code fertig · lokal geprüft: Lint, Imports, URLs, Templates, Static, `manage.py check`, GraphQL, Vitest (15/15), Frontend-Build, Editor-Smoke-Test im Browser mit Mock-API · **Django-Tests noch nicht ausgeführt** (laufen auf der Ubuntu-VM) · offen: Gruppen-Autobefüllung (Cluster/Site/Tag), Services im Parent-Container, Screenshots, Kompatibilitäts-Check auf rick

Legende: `[ ]` offen · `[x]` erledigt · ⏸ = Stopp, Ergebnis zeigen und auf Freigabe warten

---

## 0. Recherche (Plan-Modus, noch kein Code)
- [x] NetBox-Plugin-Doku 4.5 lesen (Plugin-Config, Models, Views, Navigation, Template-Extensions, API, GraphQL, Filtersets, Tables, Forms, Import)
- [x] NetBox **v4.5.7** Quellcode prüfen:
  - [x] `ipam.models.Service` – generischer Parent (`parent_object_type`/`parent_object_id`), erlaubte Parent-Typen (Limit-Choices), Validierung, Ports-Feld, Protokoll-Choices
  - [x] `ipam.api` Service-Serializer: wie wird `parent` geschrieben (Payload-Format für Canvas)
  - [x] `netbox.plugins` – `PluginConfig`, `PluginMenu`/`PluginMenuItem`, `PluginTemplateExtension` (Signatur in 4.5: `models = [...]`)
  - [x] `netbox.models` – `NetBoxModel`, Mixins (`ChangeLoggingMixin` etc.) für schlanke Modelle
  - [x] `utilities.views.register_model_view` + `ViewTab`
  - [x] Generische-FK-Serializer-Muster im Core (z. B. `GFKSerializerField`, `ContentTypeField`), Filter auf ContentType
  - [x] GraphQL: Strawberry-Typen, `graphql_schema` im PluginConfig
  - [x] `utilities.testing` – `APIViewTestCases`, `ViewTestCases`
  - [x] Wie Core selbst GFK-Cleanup macht (z. B. bei Cable-Terminations / `post_delete`-Handlern)
- [x] netbox-branching: Anforderungen an Plugin-Modelle (ChangeLogging nötig für Branch-Sync? Verhalten nicht-changeloggter Modelle in Branches)
- [x] netbox-topology-views: URL-Präfix, Menü-Namen, Static-Pfad, Template-Namen notieren → Kollisionen vermeiden
- [x] netbox-docker: `Dockerfile-Plugins`, `plugin_requirements.txt`, Compose-Struktur für Dev-Override

## 1. Plan & Klärung ⏸
- [x] Implementierungsplan vorstellen (Architektur, Modelle, API, Frontend-Bundle, Dev-Setup)
- [x] Entscheidungen begründen:
  - [x] CanvasNode/CanvasGroup: volles NetBoxModel vs. schlank (ohne Changelog) – Branching beachten
  - [x] Bulk-Layout-Endpunkt: Format, Transaktion, ein zusammenfassender Changelog-Eintrag pro Speichern?
  - [x] Cascade-Strategie bei gelöschtem Connection-Endpunkt (löschen vs. Alternative vorschlagen)
  - [x] Bundler: Vite vs. esbuild
  - [x] elkjs vs. dagre
- [x] Fragen an dich:
  - [x] Dev-Umgebung lokal (Docker Desktop) oder auf `rick`?
  - [x] Repo-Hosting (GitHub/Gitea/…) und Repo-URL bzw. Platzhalter
  - [x] Lizenz
  - [x] Projektordner auf dem Rechner

## 2. Phase 1 – Gerüst, Modelle, API ⏸
- [x] `pyproject.toml` (Paket `netbox-service-canvas`, Modul `netbox_service_canvas`), `min_version="4.5.0"`, `max_version="4.5.99"`
- [x] `PluginConfig` mit eindeutigem `base_url` (`service-canvas`), Menü „Service Canvas“
- [x] Choices: Direction, Protocol, ConnectionStatus
- [x] Modelle:
  - [x] `ServiceConnection` (GFK source/target → Service/Device/VM; direction, protocol, port, data_description, status, description, comments) + `clean()`: source ≠ target, ContentType-Whitelist
  - [x] `ConnectionHop` (FK connection, order, GFK auf Service/Interface/VMInterface/VLAN/VRF/Prefix/IPAddress/Tunnel/Device/VM, note), Ordering, unique (connection, order)
  - [x] `Canvas` (Name, Beschreibung, optional Site/Cluster, Tags)
  - [x] `CanvasNode` (canvas, GFK Device/VM/Service, x, y, width, height, group) unique (canvas, object)
  - [x] `CanvasGroup` (Name, Farbe, x/y/w/h, optional Cluster/Site/Tag)
  - [x] DB-Indizes auf (content_type, object_id)
- [x] Migrations (sauber, keine Raw-SQL)
- [x] Lösch-Signale (`signals.py`, in `ready()` registriert):
  - [x] Device/VM/Service gelöscht → CanvasNodes weg
  - [x] Connection-Endpunkt gelöscht → Connection weg (bzw. gewählte Alternative)
  - [x] Hop-Objekt gelöscht → Hop weg, `order` der Rest-Hops neu durchnummerieren
  - [x] Interaktion mit Core-Cascades prüfen (Device-Löschen löscht Services/Interfaces mit)
- [x] Forms (Model, Filter, Bulk-Edit, CSV-Import inkl. GFK-Auflösung)
- [x] Tables, FilterSets
- [x] Views: List/Detail/Add/Edit/Delete/Bulk-Edit/Bulk-Delete/Import für Canvas, ServiceConnection, ConnectionHop (+ Group falls nutzerrelevant)
- [x] Templates (eindeutiger Namespace `netbox_service_canvas/…`)
- [x] REST-API: Serializer mit Brief-Mode, GFK sauber serialisiert (`*_type` + `*_id` + nested Objekt), `NetBoxModelViewSet`, Router
- [x] Bulk-Layout-Endpunkt `PUT /api/plugins/service-canvas/canvases/<id>/layout/` (atomar, Permission `change_canvas`)
- [x] GraphQL-Typen (wenn vertretbar)
- [x] Erste Model-/Validierungs- und Signal-Tests
- [x] Dev-Setup: `docker-compose.override` auf Basis netbox-docker, Plugin editable gemountet
- [x] Anleitung „wie teste ich Phase 1“

## 3. Phase 2 – Template-Extensions ⏸
- [x] Panel/Tab „Connections“ (eingehend/ausgehend) auf Device-, VM-, Service-Detailseite (`register_model_view` + `ViewTab` oder `PluginTemplateExtension`)
- [x] Link „Auf Canvas anzeigen“ (Canvases, die das Objekt enthalten)
- [x] Keine Core-Templates ändern
- [x] Tests der Tabs/Views

## 4. Phase 3 – Canvas-MVP ⏸
- [x] Frontend-Projekt (`frontend/`): React + `@xyflow/react`, TypeScript, Bundle nach `netbox_service_canvas/static/netbox_service_canvas/`
- [x] Gebaute Dateien ins Python-Paket (`package-data`), kein Node im Container, keine CDNs
- [x] Canvas-Detail-Seite: NetBox-Template mit Mount-Punkt, Config (IDs, API-URLs, Rechte, CSRF) per `json_script`
- [x] API-Client: Session-Auth + CSRF-Header, Plugin-API + Core-API
- [x] Node-Typen: Device, VM, Service (Icon, Name, Primär-IP bzw. Ports, Statusfarbe)
- [x] Kanten aus Daten ableiten: Parent-Beziehungen + ServiceConnections zwischen vorhandenen Nodes
- [x] Seitenleiste: Suche (Devices/VMs/Services) → Drag & Drop erzeugt CanvasNode
- [x] Layout speichern (Bulk-Endpunkt), Speichern-Button
- [x] Watch-Build für Dev (`npm run dev`/`build --watch`)

## 5. Phase 4 – Canvas-Editing ⏸
- [x] Kante ziehen → Dialog „läuft auf“ (PATCH Service-Parent) oder „Datenfluss“ (POST ServiceConnection)
- [x] Modal „Neuer Service“ (Name, Protokoll, Ports, Parent) → `ipam.Service` via Core-API
- [x] Kanten-Seitenpanel: Details, Hops bearbeiten, Reihenfolge per DnD, Link zur NetBox-Detailseite
- [x] Kanten-Styling: Label Protokoll/Port, gestrichelt = geplant, grau = deaktiviert, Pfeile nach Richtung
- [x] Read-only-Modus ohne `change_canvas` (kein Drag, keine Edit-Buttons); zusätzlich Rechte für Service/Connection-Anlage prüfen
- [x] „Fehlende ergänzen“: Services/Connections der vorhandenen Nodes nachladen
- [x] Fehlerbehandlung (Validierungsfehler der API im UI anzeigen)

## 6. Phase 5 – Gruppen, Layout, Export, Theme ⏸
- [x] CanvasGroup: anlegen, Größe ändern, Nodes hineinziehen (xyflow Parent-Nodes)
- [ ] Optional: Services visuell im Container ihres Parents
- [ ] Auto-Befüllung von Gruppen via Cluster/Site/Tag
- [x] Auto-Layout (elkjs oder dagre)
- [x] Minimap, Zoom/Fit, Snap-to-Grid
- [x] Autosave (debounced, Bulk-Endpunkt), Dirty-State-Anzeige
- [x] Export PNG + SVG
- [x] Theme: NetBox-/Tabler-CSS-Variablen, Light/Dark, Homelable-Optik

## 7. Phase 6 – Tests & Doku ⏸
- [x] Model-/Validierungstests vervollständigen
- [x] `APIViewTestCases` für alle API-Endpunkte + Layout-Endpunkt-Tests (Rechte, Transaktion, Changelog)
- [x] `ViewTestCases` für UI-Views inkl. CSV-Import
- [x] Signal-Tests (alle Lösch-Szenarien, Hop-Reihenfolge)
- [x] Frontend-Unit-Tests mit Vitest (Graph-Ableitung, Kanten-Styling, Layout-Diff)
- [ ] Kompatibilitäts-Check mit den aktiven Plugins (v. a. netbox-branching, netbox-topology-views)
- [ ] README: Features, Screenshots, Konfiguration, Architektur-Entscheidungen (Modelle, Cascade, Changelog/Layout)
- [x] Installationsanleitung netbox-docker:
  - [x] Backup: `pg_dump` aus dem Postgres-Container
  - [x] `plugin_requirements.txt` (Git-Install, Platzhalter-URL)
  - [x] `configuration/plugins.py`
  - [x] Image bauen, Container neu starten
  - [x] `migrate` + `collectstatic --no-input` (ohne `--clear`)
  - [x] Update-Anleitung
  - [x] Deinstallation (`migrate netbox_service_canvas zero`, Eintrag entfernen, Rebuild)
