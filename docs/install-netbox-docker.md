# Installation in netbox-docker (Produktiv-Setup, z. B. `rick`)

Diese Anleitung geht von einer bestehenden netbox-docker-Installation aus, in der schon Plugins laufen. Es gibt also
bereits `plugin_requirements.txt`, `Dockerfile-Plugins`, `docker-compose.override.yml` und
`configuration/plugins.py`. Das Plugin wird dort nur **ergänzt**.

| | |
|---|---|
| NetBox | 4.5.0 – 4.5.x (getestet mit 4.5.7, netbox-docker 4.0.2) |
| Python-Paket | `netbox-service-canvas` |
| Django-App / `PLUGINS`-Eintrag | `netbox_service_canvas` |
| URL-Präfix | `/plugins/service-canvas/`, API `/api/plugins/service-canvas/` |
| Node.js im Container | nicht nötig, das Frontend liegt fertig gebaut im Paket |

Alle Befehle laufen im netbox-docker-Verzeichnis (dort, wo `docker-compose.yml` liegt).

---

## 1. Backup

```bash
cd ~/netbox-docker            # anpassen
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > netbox-$(date +%F-%H%M).dump
ls -lh netbox-*.dump          # sollte deutlich größer als 0 Byte sein
```

Zurückspielen, falls nötig (NetBox vorher stoppen):

```bash
docker compose stop netbox netbox-worker
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < netbox-JJJJ-MM-TT-HHMM.dump
docker compose start netbox netbox-worker
```

## 2. Paket eintragen: `plugin_requirements.txt`

Eine Zeile ergänzen. Empfohlen ist das **Tag-Archiv**, denn dafür braucht das Image kein `git`:

```text
netbox-service-canvas @ https://github.com/REPLACE_ME/netbox-service-canvas/archive/refs/tags/v0.1.0.tar.gz
```

Alternativ direkt aus Git, wenn dein `Dockerfile-Plugins` `git` installiert:

```text
netbox-service-canvas @ git+https://github.com/REPLACE_ME/netbox-service-canvas.git@v0.1.0
```

> `REPLACE_ME` durch deinen GitHub-Benutzer ersetzen, sobald das Repo veröffentlicht ist.

Dein `Dockerfile-Plugins` muss nicht geändert werden. Es installiert ohnehin alles aus `plugin_requirements.txt`,
typischerweise so:

```dockerfile
FROM netboxcommunity/netbox:v4.5.7-4.0.2
COPY ./plugin_requirements.txt /opt/netbox/
RUN /usr/local/bin/uv pip install -r /opt/netbox/plugin_requirements.txt
```

## 3. Aktivieren: `configuration/plugins.py`

`netbox_service_canvas` in die bestehende `PLUGINS`-Liste eintragen. **netbox-branching bleibt der letzte Eintrag**
(Vorgabe von netbox-branching):

```python
PLUGINS = [
    'netbox_qrcode',
    'netbox_floorplan',
    'netbox_dns',
    'netbox_topology_views',
    'netbox_prometheus_sd',
    'netbox_reorder_rack',
    'netbox_interface_synchronization',
    'netbox_inventory',
    'netbox_service_canvas',     # neu
    'netbox_branching',          # bleibt zuletzt
]

PLUGINS_CONFIG = {
    # ... bestehende Einträge unverändert ...
    'netbox_service_canvas': {
        'grid_size': 10,         # Raster in Pixeln (Snap und gespeicherte Positionen)
    },
}
```

Die Modulnamen der anderen Plugins oben sind nur ein Beispiel. Übernimm sie so, wie sie bei dir schon stehen, und füge
lediglich die neue Zeile ein.

## 4. Image bauen und neu starten

```bash
docker compose build --no-cache netbox
docker compose up -d
docker compose logs -f netbox      # warten bis "Listening at" / keine Tracebacks
```

Der Entrypoint führt beim Start `migrate` aus. Zur Sicherheit, und um es im Log zu sehen:

```bash
docker compose exec netbox /opt/netbox/netbox/manage.py migrate netbox_service_canvas
docker compose exec netbox /opt/netbox/netbox/manage.py showmigrations netbox_service_canvas
```

## 5. Static-Dateien

```bash
docker compose exec netbox /opt/netbox/netbox/manage.py collectstatic --no-input
```

**Kein `--clear`.** Auf `rick` sind Branding-Dateien read-only in den Static-Ordner gemountet. `--clear` würde
versuchen, sie zu löschen, und abbrechen. Ohne `--clear` werden nur neue oder geänderte Dateien kopiert.

Danach muss es diese Dateien geben:

```bash
docker compose exec netbox ls /opt/netbox/netbox/static/netbox_service_canvas/dist/
# canvas.css  canvas.js  chunks/
```

## 6. Prüfen

1. **Plugins → Service Canvas** erscheint im Menü (getrennt von „Topology Views“).
2. Unter **Admin → Permissions** die Rechte für Benutzer/Gruppen vergeben. Die Objekttypen heißen
   *Service Canvas | canvas*, *service connection*, *connection hop*, *canvas node*, *canvas group*,
   *canvas note* und *application*.
   Zum Bearbeiten im Editor braucht man `change` auf *canvas* sowie `add`/`change`/`delete` auf *canvas node*
   (und *canvas group* für Gruppen, *canvas note* für Notizen). Applications anlegen/bearbeiten: `add`/`change` auf
   *application*.
3. Einen Canvas anlegen, den Tab **Editor** öffnen, ein Device aus der Seitenleiste hineinziehen und die Seite neu
   laden. Die Position muss erhalten bleiben.
4. Auf einer Device-Seite erscheint der Tab **Connections**, sobald Verbindungen existieren.
5. Die anderen Plugins kurz anklicken (vor allem Topology Views, Floorplan und Branching).

### Hinweis zu netbox-branching

Alle Plugin-Modelle sind normale, change-geloggte NetBox-Modelle. Layout-Änderungen und Verbindungen funktionieren
deshalb auch innerhalb eines Branches und werden beim Merge übernommen. Branches, die **vor** der Installation angelegt
wurden, kennen die neuen Tabellen noch nicht. netbox-branching zeigt dann an, dass der Branch migriert werden muss.
Diese Migration in der Branch-Ansicht ausführen oder einen neuen Branch anlegen.

## 7. Update

1. In `plugin_requirements.txt` das Tag ändern, z. B. `v0.1.0` → `v0.2.0`.
2. Vorher das Backup aus Schritt 1 machen.
3. Dann:

```bash
docker compose build --no-cache netbox
docker compose up -d
docker compose exec netbox /opt/netbox/netbox/manage.py migrate
docker compose exec netbox /opt/netbox/netbox/manage.py collectstatic --no-input
```

Danach im Browser einmal hart neu laden (Strg+F5), denn `canvas.js` hat einen festen Dateinamen.

## 8. Deinstallation

Die Reihenfolge ist wichtig: Die Tabellen werden entfernt, **solange das Plugin noch installiert ist**.

```bash
# 1. Backup (Schritt 1)
# 2. Tabellen des Plugins entfernen (löscht alle Canvases, Verbindungen und Hops!)
docker compose exec netbox /opt/netbox/netbox/manage.py migrate netbox_service_canvas zero
```

3. `netbox_service_canvas` aus `configuration/plugins.py` (inkl. `PLUGINS_CONFIG`) entfernen.
4. Die Zeile aus `plugin_requirements.txt` entfernen.
5. Neu bauen und starten:

```bash
docker compose build --no-cache netbox
docker compose up -d
```

6. Optional die verwaisten Static-Dateien entfernen (wieder ohne `collectstatic --clear`):

```bash
docker compose exec -u root netbox rm -rf /opt/netbox/netbox/static/netbox_service_canvas
```

Core-Daten wie Devices, VMs und Services bleiben unangetastet. Das Plugin ändert keine Core-Tabellen.

## Fehlersuche

| Symptom | Ursache / Lösung |
|---|---|
| Editor zeigt nur „Loading canvas…“ | `collectstatic` vergessen oder Browser-Cache: Schritt 5, dann Strg+F5. In der Browser-Konsole nach 404 auf `canvas.js` suchen. |
| `ModuleNotFoundError: netbox_service_canvas` | Image nicht neu gebaut oder falscher Service gebaut (`docker compose build netbox`). |
| `ImproperlyConfigured … requires NetBox …` | NetBox-Version außerhalb von 4.5.x. |
| 403 beim Speichern des Layouts | Rechte fehlen (siehe Schritt 6.2); der Editor zeigt die fehlende Berechtigung als Meldung an. |
| Migration hängt in einem Branch | siehe „Hinweis zu netbox-branching“. |
