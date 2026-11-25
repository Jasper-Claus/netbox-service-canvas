# Testumgebung: NetBox 4.5.7 mit netbox-docker auf einer Ubuntu-VM

Diese Anleitung baut auf einer **leeren Ubuntu-VM** eine NetBox **v4.5.7** auf, also dieselbe Version wie auf `rick`.
Grundlage ist netbox-docker, Release **4.0.2**, das das Image `netboxcommunity/netbox:v4.5.7-4.0.2` verwendet.
Das Plugin wird dabei direkt aus deinem Code-Ordner geladen. Wenn du Code änderst, lädt NetBox ihn automatisch neu,
ein Image-Neubau ist dafür nicht nötig.

```
Windows (Code)  ──scp/git──►  VM: ~/netbox-service-canvas   (Plugin-Quellcode)
                               VM: ~/netbox-dev              (netbox-docker 4.0.2 + unsere Dev-Dateien)
                                     ├─ netbox         (runserver, DEBUG, Plugin als Volume)
                                     ├─ netbox-worker
                                     ├─ postgres
                                     └─ redis / redis-cache (Valkey)
Browser  ──►  http://VM-IP:8000
```

---

## 0. VM vorbereiten

- Ubuntu Server 22.04 oder 24.04, mindestens **2 vCPU, 4 GB RAM, 20 GB Platte**
- Du kannst dich per SSH anmelden: `ssh user@VM-IP` (die IP zeigt `ip -4 addr` auf der VM)
- Port 8000 muss vom Windows-Rechner aus erreichbar sein. Falls `ufw` aktiv ist: `sudo ufw allow 8000/tcp`

## 1. Docker installieren (einmalig)

Offizielle Paketquelle von Docker (https://docs.docker.com/engine/install/ubuntu/):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Danach **einmal ab- und wieder anmelden**, damit die Gruppe `docker` greift. Zum Prüfen: `docker run --rm hello-world`.

## 2. Plugin-Code auf die VM bringen

**Variante A, direkt vom Windows-Rechner** (PowerShell, im Ordner `Documents\netbox-service-canvas`):

```powershell
ssh user@VM-IP "mkdir -p ~/netbox-service-canvas"
scp -r .\pyproject.toml .\README.md .\dev .\netbox_service_canvas user@VM-IP:~/netbox-service-canvas/
```

**Variante B, sobald das Repo auf GitHub liegt:**

```bash
git clone https://github.com/REPLACE_ME/netbox-service-canvas.git ~/netbox-service-canvas
```

Auf der VM wird **kein Node.js** gebraucht, weil das gebaute Frontend unter `netbox_service_canvas/static/` schon
im Repo liegt.

## 3. netbox-docker aufsetzen und starten

Der Einfachheit halber gibt es dafür ein Skript:

```bash
cd ~/netbox-service-canvas
chmod +x dev/setup-vm.sh
./dev/setup-vm.sh
```

Es macht genau das hier, du kannst die Schritte auch von Hand ausführen:

```bash
git clone --depth 1 --branch 4.0.2 https://github.com/netbox-community/netbox-docker.git ~/netbox-dev
cp ~/netbox-service-canvas/dev/docker-compose.override.yml ~/netbox-dev/
cp ~/netbox-service-canvas/dev/plugins.py ~/netbox-dev/configuration/plugins.py
echo "PLUGIN_SRC=$HOME/netbox-service-canvas" > ~/netbox-dev/.env
cd ~/netbox-dev
docker compose build netbox      # Dev-Image = offizielles 4.5.7-Image + Plugin (editable)
docker compose up -d             # erster Start: alle Migrationen laufen, dauert 2–5 Minuten
```

Den Fortschritt siehst du mit `docker compose logs -f netbox`. Fertig ist es, wenn dort
`Starting development server at http://0.0.0.0:8080/` erscheint.

Danach legst du einen Admin-Benutzer an:

```bash
cd ~/netbox-dev
docker compose exec netbox /opt/netbox/netbox/manage.py createsuperuser
```

Jetzt im Browser **http://VM-IP:8000** öffnen und dich anmelden.

### Was die Dev-Dateien anders machen als dein Produktiv-Setup auf `rick`

| Datei | Zweck |
|---|---|
| `dev/Dockerfile.dev` | Offizielles Image plus `uv pip install -e` des Plugins |
| `dev/docker-compose.override.yml` | Plugin-Ordner als Volume, `DEBUG=true`, `runserver` statt Granian, Port 8000 |
| `dev/plugins.py` | `PLUGINS = ['netbox_service_canvas']` |

In Produktion (`rick`) läuft es dagegen wie gewohnt: Eintrag in `plugin_requirements.txt`, Image bauen, `collectstatic`.
Das beschreibt [docs/install-netbox-docker.md](../docs/install-netbox-docker.md).

## 4. Beispieldaten laden

```bash
cd ~/netbox-dev
docker compose exec -T netbox /opt/netbox/netbox/manage.py nbshell < ~/netbox-service-canvas/dev/demo_data.py
```

Das legt Folgendes an:
- die Devices `rick` und `nas` sowie die VM `monitoring`
- die Services traefik, speedtest-tracker, netbox, grafana, prometheus und nfs
- 4 Service-Connections, darunter speedtest → grafana über die Hops traefik und VRF Tailscale
- eine Canvas „Homelab“

## 5. Testen

### a) Automatische Tests

```bash
cd ~/netbox-dev
docker compose exec netbox /opt/netbox/netbox/manage.py test netbox_service_canvas --keepdb -v 2
```

Am Ende sollte `OK` stehen. Falls nicht, schick mir die Zeilen ab `FAIL:` bzw. `ERROR:` und die Zusammenfassung.

### b) Durchklicken (Checkliste)

1. **Menü „Service Canvas“** ist vorhanden und enthält Canvases, Service Connections und Connection Hops.
2. **Service Connections:**
   - Liste mit Filtern (Protokoll, Status, Device, VM)
   - Eine Connection öffnen: Source, Target und die Hop-Tabelle unten stimmen
   - Neue Connection anlegen: Typ wählen, danach wird das Objektfeld aktiv
3. **CSV-Import** unter Service Connections → Import:
   ```
   source_type,source_id,target_type,target_id,protocol,port,data_description
   ipam.service,<ID>,ipam.service,<ID>,http,80,Test
   ```
4. **Device `rick` öffnen:** Tab **„Connections“** mit eingehenden und ausgehenden Verbindungen und Button
   **„Auf Canvas anzeigen“**. Der Button führt in den Editor und hebt `rick` hervor.
5. **Canvas „Homelab“ öffnen**, dann Tab **„Editor“**:
   - Seitenleiste: Devices, VMs und Services suchen und auf die Canvas ziehen (oder `+`)
   - **Fehlende ergänzen** holt die Services der Hosts und die Verbindungspartner dazu
   - **Auto-Layout** ordnet alles von links nach rechts an
   - Knoten verschieben: Oben rechts steht kurz „Speichere…“ und dann „Gespeichert“. Nach dem Neuladen (F5) sind die
     Positionen erhalten
   - Kante von Service zu Service ziehen, **Datenfluss** wählen: Die neue Connection erscheint auch unter
     Service Connections
   - Kante von Service zu Device ziehen, **Läuft auf** wählen: Der Parent des Service hat sich geändert
   - Auf eine farbige Kante klicken: Im Panel rechts Port oder Status ändern, einen Hop (z. B. VRF) anhängen und die
     Hops per Ziehen umsortieren
   - **Neuer Service** (unten in der Seitenleiste) legt einen Service an, wenn vorher ein Host markiert war direkt
     auf diesem Host
   - **Gruppe**: zwei Knoten markieren (Shift+Klick), dann *Gruppe*. Doppelklick auf den Namen benennt sie um, die
     Farbe wählst du über die Leiste über der markierten Gruppe, die Größe über die Ecken. Knoten hinein- und
     herausziehen
   - **PNG** / **SVG** exportieren
   - NetBox auf Dark Mode umschalten: Der Canvas zieht mit
6. **Lösch-Kaskade:** Service `grafana` löschen. Danach sind seine Connections und sein Canvas-Node verschwunden, und
   im Changelog stehen die Löschungen.
7. **Rechte:** Einen Benutzer nur mit `view`-Rechten anlegen. Die Canvas ist für ihn nur lesbar, ohne Drag und ohne
   Bearbeiten-Buttons.

Wenn im Editor etwas nicht klappt: Browser-Konsole öffnen (F12 → Konsole) und mir die roten Zeilen schicken.

## 6. Alltag

| Was | Befehl (in `~/netbox-dev`) |
|---|---|
| Code aktualisieren | `scp` wie in Schritt 2 oder `git -C ~/netbox-service-canvas pull`; NetBox lädt automatisch neu |
| Neue Migration einspielen | `docker compose exec netbox /opt/netbox/netbox/manage.py migrate` |
| Logs | `docker compose logs -f netbox` |
| Shell | `docker compose exec netbox /opt/netbox/netbox/manage.py nbshell` |
| Nach Änderung an `pyproject.toml` | `docker compose build netbox && docker compose up -d` |
| Stoppen / Starten | `docker compose stop` / `docker compose start` |
| Alles löschen inkl. Datenbank | `docker compose down -v` |

## 7. Probleme

| Symptom | Ursache / Lösung |
|---|---|
| `permission denied ... docker.sock` | Nach `usermod -aG docker` nicht neu angemeldet |
| `set PLUGIN_SRC in .env` | Die Datei `~/netbox-dev/.env` fehlt, siehe Schritt 3 |
| Container startet neu, im Log steht `Waiting on DB` | Der erste Start dauert; `docker compose logs postgres` prüfen |
| `ImproperlyConfigured: Unable to import plugin` | Das Image wurde ohne Plugin gebaut: `docker compose build netbox` |
| Seite ohne CSS/JS im Editor | `DEBUG` ist nicht `true`; in der Override-Datei nachsehen |
| Browser erreicht Port 8000 nicht | Firewall auf der VM: `sudo ufw allow 8000/tcp` |
