# netbox-service-canvas

NetBox-Plugin mit einem interaktiven Canvas. Es zeigt, **welche Services auf welchen Devices und VMs laufen** und
**wie diese Services miteinander kommunizieren**: wer mit wem, über welches Protokoll und welchen Port, welche Daten
fließen und über welche Zwischenstationen.

**Grundprinzip:** Beziehungen sind echte NetBox-Daten. Der Canvas speichert nur das Layout.

- „Service läuft auf Host“ ist das Core-Feld `Service.parent` (Device oder VM).
- „Service spricht mit Service“ ist das Plugin-Modell `ServiceConnection`, mit optionalen `ConnectionHop`s (über
  Reverse-Proxy, VRF, Tunnel, VLAN …).
- „Service gehört zu Application“ ist das Plugin-Modell `Application` (z. B. Grafana, Paperless) mit seinen Services.
- Ein Canvas ist eine Ansicht. Dasselbe Objekt kann auf mehreren Canvases liegen. Verschwindet es aus NetBox,
  verschwindet es auch von allen Canvases.

| | |
|---|---|
| NetBox | 4.5.0 – 4.5.x |
| Paket / Modul | `netbox-service-canvas` / `netbox_service_canvas` |
| Lizenz | Apache-2.0 |
| Abhängigkeiten zur Laufzeit | keine (Frontend ist gebündelt, keine CDNs) |

---

## Funktionen

### Daten (überall in NetBox nutzbar, auch ohne Canvas)
- **Applications**: Anwendungen wie Grafana oder Paperless mit Status, Version, URL und den zugehörigen NetBox-Services.
  Auf Service-, Device- und VM-Seiten zeigt ein Panel die Applications des Objekts.
- **Service Connections**: Quelle und Ziel sind jeweils ein Service, Device, eine VM oder eine Application. Dazu kommen Richtung
  (uni/bi), Protokoll (TCP, UDP, HTTP, HTTPS, MQTT, gRPC, SMB, NFS, Other), Port, „Daten“-Beschreibung, Status
  (active/planned/disabled), Tags, Custom Fields und Kommentare.
- **Connection Hops**: geordnete Zwischenstationen. Erlaubt sind Service, Interface, VM-Interface, VLAN, VRF, Prefix,
  IP-Adresse, Tunnel, Device und VM.
- Für alle Modelle gibt es Listen, Filter, Detailseiten, Bulk-Edit/-Delete und **CSV-Import**, außerdem die globale
  Suche, REST-API, GraphQL, Changelog und Journal.
- Tab **Connections** (Abhängigkeits-Tabelle) auf Device-, VM-, Service- und Application-Seiten: ein- und ausgehende
  Verbindungen, bei Hosts und Applications inklusive ihrer Services.
- Button **Auf Canvas anzeigen** auf denselben Seiten. Er führt in jeden Canvas, der das Objekt enthält, und hebt es
  dort hervor.

### Canvas-Editor (Tab „Editor“ eines Canvas)
- **Seitenleiste** mit Suche nach Devices, VMs, Services und Applications. Objekte lassen sich per Drag & Drop oder über `+` auf den
  Canvas legen.
- **Knoten** zeigen Icon, Name, Primär-IP bzw. Protokoll und Ports (Applications: Version und URL). Die Statusfarbe ist die des Hosts;
  Services übernehmen sie von ihrem Parent.
- **Kanten** werden aus den Daten abgeleitet:
  - gestrichelt grau: „läuft auf“ (Service → Host)
  - lila gepunktet: „gehört zu“ (Service → Application)
  - farbig: Datenfluss. Grün bedeutet aktiv, gestrichelt cyan geplant, gepunktet grau deaktiviert. Pfeile zeigen die
    Richtung, das Label Protokoll, Port und Daten.
- **Kante ziehen** öffnet einen Dialog:
  - *Läuft auf* setzt `Service.parent` (mit Warnung, wenn der Service umzieht).
  - *Datenfluss* legt eine `ServiceConnection` an. Der Port ist aus dem Ziel-Service vorbelegt.
- **Kanten-Panel** (Klick auf eine Kante): Felder bearbeiten, Verbindung löschen, Hops anhängen, entfernen und per
  Drag & Drop umsortieren.
- **Knoten-Panel** (Klick auf einen Knoten): Details, Verbindungen auf der Canvas, „In NetBox öffnen“, „Alle Felder
  bearbeiten“ (NetBox-Formular, danach zurück zum Editor), Schnellbearbeitung für Services und Applications,
  Impact-Analyse und „Von dieser Canvas entfernen“.
- **Impact-Analyse**: Was fällt aus, wenn dieses Objekt ausfällt? Rot: fällt mit aus (Services auf dem Host,
  Applications dieser Services). Orange: abhängig betroffen (wer Daten an ein ausgefallenes Objekt sendet, transitiv;
  bidirektionale Flüsse in beide Richtungen, deaktivierte werden ignoriert). Alles andere wird ausgegraut.
- **Notizen**: Haftnotizen auf der Canvas, Doppelklick zum Schreiben, Farbe und Größe änderbar.
- **Neue Application**: Name, Status, Version, URL und Services. Markierte Services werden vorausgewählt.
- **Neuer Service**: Name, Protokoll, Ports (`80, 443, 8000-8010`) und Host. Der Service wird direkt in NetBox
  angelegt und unter seinen Host gelegt.
- **Gruppen**: Rahmen mit Name und Farbe, in der Größe änderbar. Knoten hineinziehen nimmt sie auf. Sind beim Anlegen
  Knoten markiert, umschließt die Gruppe sie.
- **Fehlende ergänzen**: holt Services der Hosts, Hosts der Services und Verbindungspartner hinzu.
- **Auto-Layout** (ELK, schichtweise von links nach rechts, Gruppen bleiben zusammen), **Minimap**, Zoom,
  **Snap-to-Grid**.
- **Autosave** (abschaltbar) mit Statusanzeige. Gespeichert werden nur tatsächlich geänderte Knoten und Gruppen.
- **Export** als PNG, SVG oder **PDF (DIN A4)** zum Drucken: Hoch- oder Querformat je nach Diagramm, Kopfzeile mit
  Name und Datum, Legende, immer im hellen Design.
- **Nur-Ansicht-Modus**: automatisch ohne Bearbeitungsrechte, sonst umschaltbar. Jede Aktion richtet sich nach den
  NetBox-Rechten des Benutzers (inklusive Objekt-Constraints).
- **Light/Dark** folgt dem NetBox-Theme.

---

## Installation

- **Produktiv (netbox-docker):** siehe [docs/install-netbox-docker.md](docs/install-netbox-docker.md). Dort stehen
  Backup, Installation, `collectstatic` ohne `--clear`, Update und Deinstallation.
- **Test-/Entwicklungsumgebung auf einer Ubuntu-VM:** siehe [dev/README.md](dev/README.md).

Kurzfassung für eine bestehende Installation:

```text
# plugin_requirements.txt
netbox-service-canvas @ https://github.com/REPLACE_ME/netbox-service-canvas/archive/refs/tags/v0.1.0.tar.gz
```

```python
# configuration/plugins.py
PLUGINS = [..., 'netbox_service_canvas', 'netbox_branching']   # branching bleibt zuletzt
PLUGINS_CONFIG = {'netbox_service_canvas': {'grid_size': 10}}
```

```bash
docker compose build --no-cache netbox && docker compose up -d
docker compose exec netbox /opt/netbox/netbox/manage.py migrate
docker compose exec netbox /opt/netbox/netbox/manage.py collectstatic --no-input
```

### Konfiguration

| Einstellung | Standard | Bedeutung |
|---|---|---|
| `grid_size` | `10` | Raster in Pixeln. Positionen und Größen werden serverseitig darauf gerundet. |

### Berechtigungen

| Aktion im Editor | benötigte Rechte |
|---|---|
| Canvas ansehen | `view` auf *canvas* (Objekte und Verbindungen nur, soweit `view` darauf besteht) |
| Knoten verschieben, hinzufügen, entfernen | `change` auf den Canvas + `add`/`change`/`delete` auf *canvas node* |
| Gruppen bearbeiten | zusätzlich `add`/`change`/`delete` auf *canvas group* |
| Datenfluss anlegen / bearbeiten / löschen | `add` / `change` / `delete` auf *service connection* |
| Hops anhängen / umsortieren / entfernen | `add` / `change` / `delete` auf *connection hop* |
| „Läuft auf“ setzen, neuer Service | `change` / `add` auf *ipam › service* |
| Service im Knoten-Panel bearbeiten | `change` auf *ipam › service* |
| Application anlegen / im Knoten-Panel bearbeiten | `add` / `change` auf *application* |
| Notizen | `change` auf den Canvas + `add`/`change`/`delete` auf *canvas note* |

---

## REST-API

Basis: `/api/plugins/service-canvas/`

| Endpunkt | |
|---|---|
| `applications/`, `connections/`, `connection-hops/`, `canvases/`, `canvas-groups/`, `canvas-nodes/`, `canvas-notes/` | Standard-NetBox-CRUD inkl. Bulk, Filter, Brief-Mode |
| `GET canvases/<id>/graph/?include=<key>,…` | alles für den Editor in einer Anfrage: Layout, Objekt-Beschreibungen, Kanten |
| `GET canvases/<id>/missing/` | verwandte, noch nicht platzierte Objekte |
| `GET/PUT canvases/<id>/layout/` | Layout lesen / atomar speichern (siehe unten) |
| `POST connections/<id>/reorder-hops/` | `{"hops": [id, id, …]}` setzt die Reihenfolge in einer Transaktion |

Objekt-Schlüssel haben die Form `app_label.model:pk`, z. B. `ipam.service:12`.

Beispiel für das Layout-Speichern (es reicht, nur Geändertes zu senden):

```json
PUT /api/plugins/service-canvas/canvases/1/layout/
{
  "groups": [{"key": "g1", "name": "Proxmox", "color": "2196f3", "x": 0, "y": 0, "width": 600, "height": 400}],
  "nodes": [
    {"id": 17, "x": 40, "y": 60, "group_key": "g1"},
    {"object_type": "ipam.service", "object_id": 12, "x": 300, "y": 60, "group": null}
  ],
  "notes": [{"key": "n1", "text": "Wartung Freitag", "color": "ffe082", "x": 700, "y": 0, "width": 220, "height": 140}],
  "deleted_nodes": [5],
  "deleted_groups": [],
  "deleted_notes": []
}
```

Lässt man `group`/`group_key` weg, bleibt die Gruppenzugehörigkeit eines bestehenden Knotens unverändert.
`"group": null` löst den Knoten aus seiner Gruppe. Die Antwort enthält `created_groups`/`created_nodes`/`created_notes`
(Client-Key → neue ID) und die Zähler `updated`/`deleted`.

GraphQL: `service_canvas_connection(_list)`, `service_canvas_connection_hop(_list)`, `service_canvas_canvas(_list)`,
`service_canvas_group(_list)`, `service_canvas_node(_list)`, `service_canvas_note(_list)`,
`service_canvas_application(_list)`.

---

## Architektur-Entscheidungen

| Thema | Entscheidung | Warum |
|---|---|---|
| Datenhaltung | Beziehungen ausschließlich in NetBox-Modellen. Der Canvas speichert nur x/y/Größe/Gruppe. | Eine Quelle der Wahrheit; Verbindungen sind auch ohne Canvas nutzbar (Tabs, API, Export). |
| Generische Relationen | `GenericForeignKey` mit Typ-Whitelist und Indizes auf `(type, id)` | gleiches Muster wie `Service.parent` im Core |
| Löschen | ein `pre_delete`-Signal: Canvas-Knoten des Objekts löschen, Verbindungen mit dem Objekt als Endpunkt löschen, Hops des Objekts entfernen und den Rest neu nummerieren | GFKs haben kein DB-Cascade. Jedes Löschen läuft über `.delete()`, damit es im Changelog steht. |
| Changelog | alle Modelle change-geloggt; Layout-Änderungen über `snapshot()` + `save()`, nie `bulk_update` | Pflicht für netbox-branching (Replay über ObjectChanges). Es gibt keine Raw-SQL-Statements und keine eigenen Schemas. |
| Autosave | Diff-only: Client und Server schreiben nur geänderte Zeilen | Der Changelog wird beim Verschieben nicht geflutet. |
| Status-Farbe von Services | vom Parent (Device/VM) übernommen | `Service` hat in NetBox keinen Status. |
| FHRP-Gruppen als Parent | Service wird ohne „läuft auf“-Kante angezeigt | Eine FHRP-Gruppe ist kein platzierbarer Knoten. |
| Rechte | Editor-Flags nur für die UI; jede Änderung läuft über die REST-API mit Session und CSRF, inklusive Objekt-Constraints | keine zweite Rechte-Logik |
| Frontend | React 18 + @xyflow/react 12, elkjs (lazy geladen), dnd-kit, html-to-image; Vite-Bundle im Python-Paket | Kein Node.js im Container, keine CDNs, offline-fähig |
| Koexistenz | eigener URL-Präfix (`service-canvas`), eigener Menüpunkt, Static-Pfad `netbox_service_canvas/`, Templates im eigenen Namespace, CSS nur unter `.nsc-root` | keine Kollision mit netbox-topology-views & Co. |

---

## Entwicklung

```text
netbox_service_canvas/      Django-App (Modelle, Views, API, GraphQL, Signale, Templates)
  static/netbox_service_canvas/dist/   gebautes Frontend (wird mit eingecheckt!)
  tests/                    NetBox-Testfälle (Model, Signal, API, View, FilterSet)
frontend/                   React/TypeScript-Quellen, Vite, Vitest
dev/                        netbox-docker-Override für die Test-VM, Beispieldaten
docs/                       Installationsanleitung
```

```bash
# Frontend
cd frontend
npm install
npm test            # Vitest: Graph-Ableitung, Kanten-Styling, Layout-Diff, Gruppen, Port-Parser
npm run build       # schreibt nach netbox_service_canvas/static/netbox_service_canvas/dist/
npm run watch       # Rebuild bei jeder Änderung (Dev-VM: Seite neu laden)

# Backend-Tests (in der Dev-Umgebung, siehe dev/README.md)
docker compose exec netbox /opt/netbox/netbox/manage.py test netbox_service_canvas --keepdb
```

**Release:** `npm run build` ausführen, `dist/` mit committen, Version in `pyproject.toml` und
`netbox_service_canvas/__init__.py` erhöhen, dann taggen (`v0.x.y`). Das Tag-Archiv ist das, was
`plugin_requirements.txt` installiert.

## Lizenz

Apache License 2.0, siehe [LICENSE](LICENSE).
