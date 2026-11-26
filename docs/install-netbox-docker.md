# Installation in netbox-docker

Diese Anleitung geht von einer laufenden netbox-docker-Installation aus. Wer dort noch nie ein Plugin installiert
hat, legt zuerst die drei Dateien `plugin_requirements.txt`, `Dockerfile-Plugins` und `docker-compose.override.yml`
an, wie in der README unter „Noch keine Plugins installiert?“ beschrieben (oder im offiziellen netbox-docker-Wiki:
[Using NetBox Plugins](https://github.com/netbox-community/netbox-docker/wiki/Using-Netbox-Plugins)).

| | |
|---|---|
| NetBox | 4.5.x |
| Python-Paket | `netbox-service-canvas` ([PyPI](https://pypi.org/project/netbox-service-canvas/)) |
| Django-App / `PLUGINS`-Eintrag | `netbox_service_canvas` |
| URL-Präfix | `/plugins/service-canvas/`, API `/api/plugins/service-canvas/` |
| Node.js im Container | nicht nötig, das Frontend liegt fertig gebaut im Paket |

> [!WARNING]
> Das Plugin erklärt sich nur mit NetBox 4.5 kompatibel. Auf einer neueren Minor-Version (zum Beispiel 4.6) startet
> NetBox insgesamt nicht, solange das Plugin aktiviert ist. Vor einem NetBox-Upgrade unter
> [Releases](https://github.com/Jasper-Claus/netbox-service-canvas/releases) nach einer passenden Plugin-Version
> sehen oder das Plugin vorher aus `PLUGINS` entfernen.

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

Die Datei öffnen (`nano plugin_requirements.txt`) und diese Zeile ergänzen. Sie gehört in die Datei, nicht ins
Terminal:

```text
netbox-service-canvas
```

Wer eine feste Version möchte, hängt sie an, zum Beispiel `netbox-service-canvas==X.Y.Z`. Die verfügbaren Versionen
stehen auf [PyPI](https://pypi.org/project/netbox-service-canvas/#history) und unter
[Releases](https://github.com/Jasper-Claus/netbox-service-canvas/releases).

## 3. Static-Dateien beim Bauen sammeln: `Dockerfile-Plugins`

Die Datei öffnen (`nano Dockerfile-Plugins`). Sie muss mit dieser Zeile enden:

```dockerfile
RUN DEBUG="true" SECRET_KEY="dummydummydummydummydummydummydummydummydummydummy" /opt/netbox/venv/bin/python /opt/netbox/netbox/manage.py collectstatic --no-input
```

Vollständig sieht die Datei typischerweise so aus (Image-Tag wie in deiner `docker-compose.yml`):

```dockerfile
FROM netboxcommunity/netbox:v4.5

COPY ./plugin_requirements.txt /opt/netbox/
RUN /usr/local/bin/uv pip install -r /opt/netbox/plugin_requirements.txt

RUN DEBUG="true" SECRET_KEY="dummydummydummydummydummydummydummydummydummydummy" /opt/netbox/venv/bin/python /opt/netbox/netbox/manage.py collectstatic --no-input
```

**Warum im Dockerfile?** Der NetBox-Container läuft als unprivilegierter Benutzer. Ein späteres
`docker compose exec netbox … collectstatic` scheitert deshalb mit `PermissionError`, und der Editor findet
`canvas.js` nicht. Beim Bauen des Images gibt es dieses Problem nicht. So empfiehlt es auch das netbox-docker-Wiki.

## 4. Aktivieren: `configuration/plugins.py`

Die Datei öffnen und `"netbox_service_canvas"` in die **bestehende** `PLUGINS`-Liste eintragen. Den Eintrag
ergänzen, die Liste nicht ersetzen. Wer netbox-branching nutzt: `netbox_branching` bleibt der letzte Eintrag
(Vorgabe von netbox-branching).

```python
PLUGINS = [
    "netbox_foo",                # Beispiel: ein bereits vorhandenes Plugin
    "netbox_service_canvas",     # neu
    "netbox_branching",          # falls vorhanden: bleibt zuletzt
]
```

Einstellungen sind nicht nötig. Optional lässt sich das Raster ändern; dazu in `PLUGINS_CONFIG` neben den
bestehenden Einträgen ergänzen:

```python
PLUGINS_CONFIG = {
    # ... bestehende Einträge unverändert ...
    "netbox_service_canvas": {
        "grid_size": 10,         # Raster in Pixeln, Standard 10
    },
}
```

## 5. Image bauen und neu starten

```bash
docker compose build --no-cache
docker compose up -d
docker compose logs -f netbox      # warten bis "Listening at" / keine Tracebacks, dann Strg+C
```

Der Container führt beim Start automatisch die Datenbank-Migrationen aus. Nur zur Kontrolle:

```bash
docker compose exec netbox /opt/netbox/netbox/manage.py showmigrations netbox_service_canvas
# alle Einträge mit [X]
docker compose exec netbox ls /opt/netbox/netbox/static/netbox_service_canvas/dist/
# canvas.css  canvas.js  chunks/
```

## 6. Prüfen

1. Im Menü erscheint **Plugins → Service Canvas**.
2. Unter **Admin → Permissions** die Rechte für Benutzer und Gruppen vergeben. Die Objekttypen heißen
   *Service Canvas | canvas*, *service connection*, *connection hop*, *canvas node*, *canvas group*,
   *canvas note* und *application*. Welche Aktion welches Recht braucht, steht in der README unter
   „Berechtigungen“.
3. Eine Canvas anlegen, den Tab **Editor** öffnen, ein Device aus der Seitenleiste hineinziehen und die Seite neu
   laden. Die Position muss erhalten bleiben.
4. Auf einer Device-Seite erscheint der Tab **Connections**, sobald Verbindungen existieren.
5. Die anderen installierten Plugins kurz anklicken.

### Hinweis zu netbox-branching

Alle Plugin-Modelle sind normale NetBox-Modelle mit Changelog. Layout-Änderungen und Verbindungen funktionieren
deshalb auch innerhalb eines Branches und werden beim Merge übernommen. Branches, die **vor** der Installation angelegt
wurden, kennen die neuen Tabellen noch nicht. netbox-branching zeigt dann an, dass der Branch migriert werden muss.
Diese Migration in der Branch-Ansicht ausführen oder einen neuen Branch anlegen.

### Hinweis zu `collectstatic --clear`

`collectstatic` nie mit `--clear` aufrufen, wenn Dateien read-only in den Static-Ordner gemountet sind (zum Beispiel
ein eigenes Logo). `--clear` versucht, sie zu löschen, und bricht ab. Ohne `--clear` werden nur neue oder geänderte
Dateien kopiert.

## 7. Update

1. Backup wie in Schritt 1.
2. Ist in `plugin_requirements.txt` eine feste Version eingetragen, diese auf die neue Version ändern.
3. Neu bauen und starten. Migrationen und `collectstatic` laufen dabei automatisch mit:

```bash
docker compose build --no-cache
docker compose up -d
```

Danach im Browser einmal hart neu laden (Strg+F5), denn `canvas.js` hat einen festen Dateinamen.

## 8. Deinstallation

> [!CAUTION]
> Schritt 2 löscht **alle Canvases, Verbindungen, Hops und Applications** dieses Plugins unwiderruflich. Vorher das
> Backup aus Schritt 1 machen.

Die Reihenfolge ist wichtig: Die Tabellen werden entfernt, **solange das Plugin noch installiert ist**.

1. Backup (Schritt 1).
2. Tabellen des Plugins entfernen:

   ```bash
   docker compose exec netbox /opt/netbox/netbox/manage.py migrate netbox_service_canvas zero
   ```

3. `netbox_service_canvas` aus `configuration/plugins.py` entfernen (aus `PLUGINS` und, falls vorhanden, aus
   `PLUGINS_CONFIG`).
4. Die Zeile aus `plugin_requirements.txt` entfernen.
5. Neu bauen und starten:

   ```bash
   docker compose build --no-cache
   docker compose up -d
   ```

6. Optional die übrig gebliebenen Static-Dateien entfernen. Das geht nur als root:

   ```bash
   docker compose exec -u root netbox rm -rf /opt/netbox/netbox/static/netbox_service_canvas
   ```

Core-Daten wie Devices, VMs und Services bleiben unangetastet. Das Plugin ändert keine Core-Tabellen.

## Fehlersuche

| Symptom | Ursache / Lösung |
|---|---|
| Editor bleibt bei „Loading canvas…“ / „Lade Canvas…“ stehen; Browser-Konsole zeigt 404 für `canvas.js` oder „MIME type ("") blocked“; `collectstatic` bricht mit `PermissionError` ab | Die Static-Dateien fehlen. Die `collectstatic`-Zeile in `Dockerfile-Plugins` ergänzen (Schritt 3) und neu bauen. Von Hand nur als root: `docker compose exec -u root netbox /opt/netbox/netbox/manage.py collectstatic --no-input`. Danach Strg+F5. |
| Editor sieht nach einem Update alt aus | Browser-Cache: Strg+F5. |
| `ModuleNotFoundError: netbox_service_canvas` | Image nicht neu gebaut, oder die Zeile fehlt in `plugin_requirements.txt`. |
| `ImproperlyConfigured … requires NetBox …` | NetBox-Version ist nicht 4.5.x (siehe Warnung oben). |
| 403 beim Speichern des Layouts | Rechte fehlen (siehe Schritt 6.2); der Editor zeigt die fehlende Berechtigung als Meldung an. |
| Migration hängt in einem Branch | siehe „Hinweis zu netbox-branching“. |
