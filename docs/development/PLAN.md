> **Archiv:** ursprünglicher Implementierungsplan (gegen NetBox 4.5.7). Den aktuellen Stand beschreiben README, CHANGELOG und CONTRIBUTING.

# Implementierungsplan – netbox-service-canvas

Stand: Recherche gegen NetBox **v4.5.7** (Tag `d0651f6`), netbox-branching, netbox-topology-views, netbox-docker.

---

## 1. Befunde aus dem Code (die den Plan beeinflussen)

| # | Befund | Quelle | Konsequenz |
|---|---|---|---|
| B1 | `Service.parent` = GFK `parent_object_type` (FK ContentType, PROTECT) + `parent_object_id` (PositiveBigInt), Index auf beidem. Erlaubte Parents: **Device, VirtualMachine, FHRPGroup** (`ipam.constants.SERVICE_ASSIGNMENT_MODELS`). | `ipam/models/services.py`, `ipam/constants.py` | „läuft auf“ = PATCH `/api/ipam/services/<id>/` mit `parent_object_type: "dcim.device"` + `parent_object_id`. Services mit FHRPGroup-Parent gibt es → siehe Frage F3. |
| B2 | `Service.protocol` kennt nur **TCP/UDP/SCTP** (L4), `ports` ist ein `ArrayField[int]`. | `ipam/choices.py` | Das Modal „Neuer Service“ hat L4-Protokoll + Ports. HTTP/MQTT/gRPC… gehören fachlich zur **ServiceConnection** (L7) – passt zur Spezifikation. |
| B3 | `Service` hat **kein `status`-Feld**. | Modell | „Statusfarbe aus NetBox“ bei Services: Vorschlag = Status des Parents erben (F4). |
| B4 | `Service` ist `PrimaryModel` (seit 4.5 mit `owner`, `description`, `comments`). | `netbox/models/__init__.py` | ServiceConnection und Canvas werden ebenfalls `PrimaryModel` → gleiches Verhalten wie Core (Owner, Kommentare). |
| B5 | Device/VM haben `services = GenericRelation(Service)` → Löschen eines Devices löscht dessen Services per Django-Cascade, `pre_delete` feuert pro Service. | `dcim/models/devices.py:676` | Unsere Lösch-Signale greifen auch bei kaskadierten Services/Interfaces. |
| B6 | Changelog entsteht nur über `post_save`/`pre_delete`-Signale bei aktivem Request-Kontext. `bulk_update()`/`QuerySet.update()` erzeugen **kein** ObjectChange. | `core/signals.py` | Wichtig für Branching (B7). |
| B7 | **netbox-branching** repliziert Änderungen ausschließlich über `ObjectChange`. Modelle ohne `ChangeLoggingMixin` werden nicht gebrancht → Änderungen schlagen sofort in main durch. Ein Modell mit FK auf ein branchbares Modell **muss selbst branchbar sein**. Vor Änderungen außerhalb von Views soll `obj.snapshot()` aufgerufen werden (sonst keine Konflikterkennung). | `docs/plugin-development.md`, `best-practices.md` | CanvasNode/CanvasGroup (FK → Canvas) **müssen** changelogged sein. Der Layout-Endpunkt muss per `snapshot()` + `save()` speichern, **nicht** per `bulk_update`. |
| B8 | 4.5 nutzt deklarative Layouts (`netbox.ui.layout.SimpleLayout`, `netbox.ui.panels`). `PluginContentPanel` bindet `left_page`/`right_page`/`full_width_page` automatisch ein. | `netbox/ui/layout.py` | Template-Extensions funktionieren auf Device/VM/Service ohne Core-Änderung. Eigene Detail-Views nutzen dieselben Layouts. |
| B9 | `register_model_view(model, name, path)` + `ViewTab(label, badge, permission, hide_if_empty, weight)` | `utilities/views.py` | Eigener Tab „Connections“ an Device/VM/Service möglich. |
| B10 | API-Muster für GFK: `ContentTypeField(queryset=…)` + `*_id` + `GFKSerializerField(read_only=True)`. CSV: `CSVContentTypeField` + `*_object_id`. GraphQL: `strawberry.union(...)`. | Service-Serializer/-Importform/-GraphQL-Typ | 1:1 übernehmen → konsistent mit Core, GraphQL ist mit vertretbarem Aufwand machbar. |
| B11 | `window.CSRF_TOKEN` ist in jeder Seite gesetzt, CSRF-Cookie ist HttpOnly. Theme über `data-bs-theme` auf `<html>`, Farben über `--tblr-*`-Variablen. | `templates/base/base.html`, `colorMode.ts` | Das Frontend liest den Token aus `window.CSRF_TOKEN` und reagiert per `MutationObserver` auf Theme-Wechsel. |
| B12 | netbox-topology-views: Modul `netbox_topology_views`, `base_url = "netbox_topology_views"`, Templates/Static unter eigenem Namespace. | Repo | Unser `netbox_service_canvas`/`service-canvas` kollidiert nicht. |
| B13 | `APIViewTestCases`, `ViewTestCases`, `GraphQLTestCase` vorhanden. | `utilities/testing/` | Tests wie in der Spezifikation machbar. |

---

## 2. Architektur-Entscheidungen

### 2.1 Modelle

| Modell | Basisklasse | Begründung |
|---|---|---|
| `ServiceConnection` | `PrimaryModel` | Fachobjekt: Changelog, Tags, CF, Journal, Owner, Kommentare. |
| `ConnectionHop` | `NetBoxModel` | Eigene Liste, CSV-Import und Changelog sind gewünscht. Kommentare/Owner braucht ein Hop nicht. |
| `Canvas` | `PrimaryModel` | Nutzerobjekt mit Tags, Rechten und Changelog. |
| `CanvasNode` | **`ChangeLoggedModel`** (schlank) | Muss wegen Branching (B7) changelogged sein. Tags, CF und Journal ergeben für eine Position aber keinen Sinn → schlankes Modell, keine eigene UI-Liste, nur API. |
| `CanvasGroup` | **`ChangeLoggedModel`** (schlank) | wie oben |

**Warum CanvasNode/CanvasGroup nicht ohne Changelog gehen:** Sie haben einen FK auf `Canvas`. Wird in einem Branch eine Canvas angelegt und Nodes hineingezogen, würden nicht-changeloggte Nodes in main landen und auf eine Canvas zeigen, die es dort nicht gibt. Das führt zu einem FK-Fehler, oder die Nodes gehen beim Merge verloren. `exempt_models` ist laut Branching-Doku für solche Modelle ausdrücklich verboten.

Felder (Kurzfassung):
- **ServiceConnection**: `source_type`/`source_id` (+GFK `source`), `target_type`/`target_id`, `direction` (uni/bi), `protocol` (TCP, UDP, HTTP, HTTPS, MQTT, gRPC, SMB, NFS, Sonstiges), `port` (1–65535, optional), `data_description`, `status` (active/planned/disabled), + `description`/`comments`/`owner`/Tags/CF. Indizes auf beiden GFK-Paaren. `clean()`: Source ≠ Target und ContentType in der Whitelist (Service/Device/VM).
- **ConnectionHop**: `connection` (FK, CASCADE), `order` (PositiveSmallInt), `object_type`/`object_id` (Whitelist: Service, Interface, VMInterface, VLAN, VRF, Prefix, IPAddress, Tunnel, Device, VM), `note`. Eindeutig: `(connection, order)` als **deferrable** UniqueConstraint, damit das Umsortieren in einer Transaktion nicht an Zwischenzuständen scheitert.
- **Canvas**: `name` (unique), `description`, `comments`, optional `site` und `cluster` (nur als Filter für Seitenleiste und „Fehlende ergänzen“), Tags.
- **CanvasNode**: `canvas` (FK CASCADE), `object_type`/`object_id` (Device/VM/Service), `x`, `y` (float), `width`/`height` (optional), `group` (FK SET_NULL). Eindeutig: `(canvas, object_type, object_id)`.
- **CanvasGroup**: `canvas` (FK CASCADE), `name`, `color` (ColorField), `x`, `y`, `width`, `height`, optional `site`/`cluster`/`tag` für die Auto-Befüllung.

### 2.2 Layout-Speicherung & Changelog

`PUT /api/plugins/service-canvas/canvases/<id>/layout/`

```json
{ "nodes":  [{"id": 12, "x": 340, "y": 120, "width": null, "height": null, "group": 3},
             {"id": null, "object_type": "ipam.service", "object_id": 55, "x": 0, "y": 0}],
  "groups": [{"id": 3, "name": "Proxmox", "color": "2f6a31", "x": 0, "y": 0, "width": 600, "height": 400}],
  "deleted_nodes": [17], "deleted_groups": [] }
```

- Läuft in **einer** `transaction.atomic()`. Rechte: `change` auf die Canvas sowie `add`/`change`/`delete` auf Node/Group, je nachdem was passiert.
- **Diff-only:** Ein Node wird nur gespeichert, wenn sich x/y/w/h/group wirklich geändert hat. Koordinaten werden auf das Grid gerundet, damit Pixel-Rauschen keine Änderungen erzeugt.
- Jede echte Änderung läuft über `snapshot()` → `save()`. So entsteht ein korrektes ObjectChange, und Branching kann das replizieren und Konflikte erkennen (B6/B7).
- Alle Einträge einer Speicherung tragen dieselbe `request_id` und erscheinen im Changelog gruppiert. Dazu kommt ein `changelog_message` „Canvas-Layout gespeichert“.
- **Autosave**: debounced (z. B. 3 s nach dem letzten Drag-Ende, nie während des Ziehens), standardmäßig **aus**, pro Nutzer einschaltbar.
- Ergebnis: Ein Speichervorgang erzeugt so viele Changelog-Einträge, wie Nodes tatsächlich bewegt wurden, und nicht mehr.

*Alternative* (F1): Alle Positionen als ein JSON-Feld `layout` auf der Canvas. Das gibt genau **1** Changelog-Eintrag pro Speichern. Nachteile: Jeder Eintrag enthält das komplette Layout, zwei Branches, die dieselbe Canvas ändern, kollidieren immer, und Positionen sind nicht mehr einzeln per API abfragbar. **Empfehlung: Diff-only pro Node (wie oben).**

### 2.3 Löschen & Integrität (`signals.py`, registriert in `ready()`)

| Ereignis (`pre_delete`) | Reaktion |
|---|---|
| Device / VM / Service gelöscht | zugehörige `CanvasNode`s löschen |
| Endpunkt (Service/Device/VM) einer ServiceConnection gelöscht | **Connection löschen** (Empfehlung, F2) |
| Hop-Objekt gelöscht (Interface, VLAN, VRF, …) | Hops löschen, die übrigen Hops jeder betroffenen Connection in `post_delete` lückenlos neu nummerieren (1…n) |

- Gelöscht wird immer **pro Objekt** über `obj.delete()` und nicht über `QuerySet.delete()` ohne Signale. So hat jedes kaskadierte Löschen einen Changelog-Eintrag mit vollständigen Vorher-Daten. Das ist nachvollziehbar, wiederherstellbar und branching-sicher.
- Für Device-Löschungen genügt das, weil Django die Services und Interfaces des Devices per Cascade löscht und für jedes einzeln `pre_delete` auslöst (B5).
- Keine Änderungen an Core-Modellen oder Core-Templates. Zusätzlich ein `alerts()`-Template-Extension auf Device/VM/Service: „Dieses Objekt ist Endpunkt von N Service-Connections“. Der Grund: NetBox' Lösch-Bestätigung zeigt GFK-Abhängigkeiten nicht an.

*Warum Löschen statt Alternativen:* Ein „verwaister“ Zustand (Endpunkt = NULL, Status = deaktiviert) würde die Pflichtfelder aufweichen, Validierung und API verkomplizieren und tote Daten erzeugen. Über das Changelog bleibt die gelöschte Connection rekonstruierbar.

### 2.4 Integration in NetBox

- `PluginConfig`: `name="netbox_service_canvas"`, `base_url="service-canvas"`, `min_version="4.5.0"`, `max_version="4.5.99"`.
- Menü „Service Canvas“ mit den Gruppen Canvas · Service Connections · Connection Hops, jeweils mit „+“- und Import-Buttons.
- Views über `register_model_view` (List, Detail, Add/Edit, Delete, Bulk Import/Edit/Delete, Changelog, Journal). Detail-Views mit `SimpleLayout`/Panels.
- REST-API: `NetBoxModelSerializer`/`PrimaryModelSerializer`, `brief_fields`, GFK wie bei Service (B10). ViewSets, FilterSets (`source_type`, `source_id`, `target_*`, `endpoint` = beidseitig, `protocol`, `status`, `service_id`, `device_id`, `virtual_machine_id`).
- Zusätzliche Hilfs-Endpunkte für die Canvas (nur lesend):
  - `GET canvases/<id>/graph/` liefert Nodes, Gruppen, Parent-Kanten und Connections in einem Aufruf, statt viele Einzel-Requests zu machen.
  - `GET canvases/<id>/missing/` liefert Services und Connections der vorhandenen Nodes, die noch fehlen („Fehlende ergänzen“).
- GraphQL: Typen für alle 5 Modelle, GFK als Union (wie `ServiceParentType`).
- Phase 2: Panel **„Service Connections“** (`full_width_page`) auf Service, **Tab „Connections“** (`ViewTab` mit Badge) auf Device und VM. Der Tab fasst die Connections des Geräts selbst und aller seiner Services zusammen, getrennt nach eingehend und ausgehend. Dazu ein Button „Auf Canvas anzeigen“ über `buttons()` mit einem Dropdown aller Canvases, die das Objekt enthalten.

### 2.5 Frontend

- **Vite** im Library-/IIFE-Modus mit festen Dateinamen (`canvas.js`, `canvas.css`, ohne Hash). Ausgabe nach `netbox_service_canvas/static/netbox_service_canvas/dist/`. Die Build-Artefakte werden mit eingecheckt, damit `pip install git+…` ohne Node funktioniert.
- React 18, `@xyflow/react`, **elkjs** fürs Auto-Layout (kann verschachtelte Gruppen layouten, dagre kann das nicht; wird lazy nachgeladen), `@dnd-kit` für die Hop-Sortierung, `html-to-image` für den PNG/SVG-Export. Alles gebundelt, keine CDNs.
- Eingebettet in ein Template, das `generic/object.html` erweitert (Canvas-Detail, Tab „Editor“). Konfiguration per `{{ config|json_script }}`: Canvas-ID, API-Basis-URLs, Rechte (`can_change`, `can_add_service`, …).
- Read-only: `nodesDraggable`, `nodesConnectable` und `elementsSelectable` (Edit) werden aus den Rechten abgeleitet, Edit-Buttons ausgeblendet. Der Server prüft die Rechte zusätzlich.
- Graph-Logik (Kanten ableiten, Styling, Layout-Diff) ist reines TS ohne React-Abhängigkeit und wird mit Vitest getestet.

### 2.6 Dev-Setup

- `docker-compose.override.yml` (im Repo unter `dev/`) auf Basis von netbox-docker:
  - Image `netboxcommunity/netbox:v4.5.7`, Plugin als Volume nach `/opt/netbox-service-canvas`, beim Start `uv pip install -e`.
  - `DEBUG=true`, `manage.py runserver` mit Autoreload statt Granian.
  - `PLUGINS = ["netbox_service_canvas"]` (optional zusätzlich netbox-branching zum Testen).
- Frontend: `npm run watch` (Vite build --watch) schreibt direkt in den gemounteten Static-Ordner. Mit `DEBUG` liefert runserver die Static-Dateien ohne `collectstatic` aus.

---

## 3. Phasen & Lieferumfang

| Phase | Inhalt | Wie du testest |
|---|---|---|
| 1 | Gerüst, 5 Modelle, Migration `0001`, Signale, Forms/Tables/Filter/Views, CSV-Import, REST-API inkl. Layout-Endpunkt, GraphQL, erste Tests | Dev-Stack starten, Objekte in der UI anlegen und importieren, API im Browser, Device löschen und prüfen, dass Nodes und Connections verschwinden |
| 2 | Panel/Tab „Connections“, Button „Auf Canvas anzeigen“, Lösch-Hinweis | Detailseiten von Device/VM/Service |
| 3 | Canvas-MVP: Anzeige, Seitenleiste + Drag & Drop, Speichern, Kanten aus den Daten | Canvas öffnen, Objekte reinziehen, speichern, neu laden |
| 4 | Kanten ziehen (läuft auf / Datenfluss), Service anlegen, Kanten-Panel + Hops, Read-only, Fehlende ergänzen | Mit einem Nutzer ohne Änderungsrechte gegenprüfen |
| 5 | Gruppen, elk-Layout, Minimap, Snap, Autosave, Export, Theme | Light/Dark umschalten, Export prüfen |
| 6 | Tests vervollständigen, README, Installations-, Update- und Deinstallationsanleitung | `manage.py test netbox_service_canvas`, `npm test` |

---

## 4. Entscheidungen (geklärt am 2026-11-25)

- F1–F4: Empfehlungen übernommen (Diff-only pro Node · Connection löschen · FHRPGroup-Services ohne „läuft auf“-Kante · Statusfarbe vom Parent)
- F5: Dev-Umgebung = eigene, neue Ubuntu-VM mit netbox-docker 4.0.2 (NetBox v4.5.7), Befehle führt Jasper aus → `dev/README.md`
- F6: Repo lokal unter `Documents
etbox-service-canvas`, Hosting GitHub (URL noch Platzhalter), Lizenz Apache-2.0
- F7: offen – Branching-Version auf rick bei Gelegenheit prüfen

## 4a. Ursprüngliche Fragen

- **F1 Layout-Speicherung:** Diff-only pro Node (Empfehlung) oder ein JSON-Feld auf der Canvas?
- **F2 Gelöschter Connection-Endpunkt:** Connection löschen (Empfehlung) oder etwas anderes?
- **F3 Services mit FHRPGroup als Parent:** auf der Canvas anzeigen, aber ohne „läuft auf“-Kante; FHRPGroup im Modal nicht wählbar (Empfehlung)? Oder FHRPGroup als eigenen Node-Typ unterstützen?
- **F4 Statusfarbe von Services:** vom Parent erben (Empfehlung)?
- **F5 Dev-Umgebung:** lokal mit Docker Desktop (Empfehlung: getrennt von Produktion, schnelles Autoreload) oder auf `rick`?
- **F6 Repo:** Hosting (GitHub/Gitea) und Ordner auf dem Rechner, Lizenz (Empfehlung Apache-2.0)?
- **F7 Branching-Version auf rick:** Welche netbox-branching-Version läuft dort? (Für 4.5.7 kommen 0.7.4–1.1.x in Frage; das ändert nichts am Design, nur an der Test-Matrix.)
