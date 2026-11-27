# GitHub-Repo: Checkliste für den Maintainer

Diese Datei listet alles, was sich nicht über Dateien im Repo einstellen lässt. Repo, PyPI und die Releases v0.2.0
und v0.3.0 gibt es schon. Offen ist Version 0.4.0 (biegbare Linien, Proxy, Kabel-Ebene, Suche, App-Symbole).

## ✅ Jetzt noch zu tun für v0.4.0 (in dieser Reihenfolge)

- [ ] **1. Django-Tests auf der Dev laufen lassen** (alle grün?):
      `docker compose exec netbox /opt/netbox/netbox/manage.py test netbox_service_canvas --keepdb`
- [ ] **2. Branch nach `main` mergen und pushen.** Danach unter **Actions** prüfen, dass *CI* komplett grün ist. Die
      Django-Tests blockieren jetzt, ein roter Test hält also das Badge rot.
- [ ] **3. Sicherheit einschalten** (Settings → *Code security*, alles einmalig):
  - *Private vulnerability reporting* → **Enable** (dafür verlinkt `SECURITY.md` auf „Report a vulnerability“)
  - *Dependabot alerts* → **Enable**
  - *Dependabot security updates* → **Enable**
  - *Code scanning / CodeQL* → **Set up → Default** (optional, prüft Python und TypeScript auf Sicherheitslücken)
- [ ] **4. Release v0.4.0 erstellen** ([Abschnitt 5](#5-release-v040)) und unter **Actions** prüfen, dass
      *Publish to PyPI* grün ist.
- [ ] **5. Produktion aktualisieren:** Backup, `netbox-service-canvas==0.4.0` in `plugin_requirements.txt`,
      `docker compose build --no-cache`, `docker compose up -d` (Migration `0003` läuft automatisch), Strg+F5.
- [ ] **6. Wiki aktualisieren** ([Abschnitt 6](#6-wiki)): Editor-Guide und Impact-Analysis haben neue Abschnitte.
- [ ] **7. Auf Reddit antworten** (optional): Hinweis auf 0.4.0, *What this is not* im README, `SECURITY.md` und die
      grüne CI. Das beantwortet die Fragen nach Monitoring und Wartung.

Was Dependabot danach macht: einmal pro Woche (Frontend) bzw. pro Monat (GitHub Actions, Python) einen Pull Request
mit Updates, gebündelt. Die CI läuft darauf automatisch. Ist sie grün, kannst du mergen; das gebaute Frontend
(`dist/`) muss danach einmal mit `npm run build` neu erzeugt und committet werden, wenn sich Frontend-Pakete geändert
haben.

---

## 1. Repo (erledigt)

```powershell
gh repo create Jasper-Claus/netbox-service-canvas --public --source . --remote origin --description "Interactive service map for NetBox: which services run where, how they talk, and what breaks if a host fails."
```

## 2. Beschreibung, Website, Topics

**About → Description:**
> 🗺️ Interactive service map for NetBox: which services run where, how they talk, and what breaks if a host fails.
> Built 100% with AI.

**About → Website:** `https://pypi.org/project/netbox-service-canvas/` (sobald das Paket auf PyPI ist).

**Topics** (maximal 20). Sie machen das Repo in der GitHub-Suche und unter github.com/topics auffindbar:

```
netbox netbox-plugin homelab selfhosted ipam dcim service-map dependency-mapping network-documentation
infrastructure-documentation impact-analysis netdevops django react react-flow diagram sysadmin
ai-generated claude-code python
```

Per CLI:

```powershell
gh repo edit Jasper-Claus/netbox-service-canvas --description "Interactive service map for NetBox: which services run where, how they talk, and what breaks if a host fails. Built 100% with AI." --homepage "https://pypi.org/project/netbox-service-canvas/" --add-topic netbox,netbox-plugin,homelab,selfhosted,ipam,dcim,service-map,dependency-mapping,network-documentation,infrastructure-documentation,impact-analysis,netdevops,django,react,react-flow,diagram,sysadmin,ai-generated,claude-code,python
```

## 3. Bilder und Social Preview

Die Bilder liegen in `docs/images/` und sind in beide READMEs eingebunden. Alle zeigen eine Demo-Umgebung, keine
echten Daten.

| Datei | Inhalt | Wofür |
|---|---|---|
| `demo.gif` | Gerät reinziehen, *Add missing*, Verbindung ziehen, Impact-Analyse (25 s) | README oben, Posts auf X, Reddit, Mastodon |
| `editor.png` | Der Editor (helles Theme, Englisch) | README, Wiki |
| `impact.png` | Impact-Analyse: Ausfall von `truenas` | README, zweites Bild in Threads |
| `new-service.png` | Dialog *New service* mit Application | README, Wiki |
| `social-preview.png` | 1280×640 | GitHub Social Preview (Linkvorschau in Foren, Discord, Slack) |

Die Social Preview lässt sich nur im Browser setzen (Checkliste Punkt 2).

## 4. PyPI einrichten (einmalig)

Veröffentlicht wird automatisch über `.github/workflows/publish.yml`, sobald ein GitHub-Release erscheint. Es wird
kein API-Token gespeichert (PyPI *Trusted Publishing*).

1. Auf [pypi.org](https://pypi.org/account/register/) ein Konto anlegen, E-Mail bestätigen und 2FA aktivieren.
2. [Account → Publishing](https://pypi.org/manage/account/publishing/) → **Add a new pending publisher** (GitHub):
   - PyPI Project Name: `netbox-service-canvas`
   - Owner: `Jasper-Claus`
   - Repository name: `netbox-service-canvas`
   - Workflow name: `publish.yml`
   - Environment name: `pypi`
3. Auf GitHub: **Settings → Environments → New environment** → Name `pypi`. Optional *Required reviewers* mit dir
   selbst; dann muss jeder Upload in Actions kurz bestätigt werden.

## 5. Release v0.4.0

Die Version in `pyproject.toml` (jetzt `0.4.0`) muss zum Tag passen, sonst bricht der Workflow ab. Erst taggen, wenn
`main` gepusht und die CI grün ist.

```powershell
git tag -a v0.4.0 -m "v0.4.0"
```
```powershell
git push origin v0.4.0
```
```powershell
gh release create v0.4.0 --title "v0.4.0: Proxy-aware impact analysis, cable layer, bendable lines" --notes-file docs/release-notes-0.4.0.md
```

Danach läuft *Publish to PyPI* unter **Actions**. Wenn er grün ist, funktioniert `pip install netbox-service-canvas`.
Falls er fehlschlägt, kann er nach dem Beheben über **Actions → Publish to PyPI → Run workflow** neu gestartet werden.

Lokal prüfen, ohne hochzuladen:

```powershell
python -m pip install build twine; python -m build; python -m twine check dist/*
```

## 6. Wiki

Die Wiki-Seiten liegen als Quelle in `docs/wiki/` (Home, Getting Started, Service vs Application, Editor Guide,
Impact Analysis, Export, FAQ, Sidebar). GitHub legt das Wiki-Repo erst an, wenn die erste Seite im Browser
gespeichert wurde:

1. Falls noch nicht geschehen: im Repo auf **Wiki → Create the first page** klicken und einfach speichern.
2. Danach die Seiten hochladen (auch für spätere Aktualisierungen):

```powershell
git clone https://github.com/Jasper-Claus/netbox-service-canvas.wiki.git $env:TEMP\nsc-wiki
```
```powershell
Copy-Item docs\wiki\*.md $env:TEMP\nsc-wiki\ -Force; git -C $env:TEMP\nsc-wiki add -A; git -C $env:TEMP\nsc-wiki commit -m "Update wiki pages"; git -C $env:TEMP\nsc-wiki push
```

## 7. Bekannt machen: fertige Posts

Pro Plattform ein Block: **Text kopieren, GIF anhängen, posten.** Die Links und Hashtags stehen schon im Text.

- **GIF:** `docs/images/demo.gif` (liegt auch im Repo, falls du am Handy postest:
  https://raw.githubusercontent.com/Jasper-Claus/netbox-service-canvas/main/docs/images/demo.gif)
- **Zweites Bild** (wo mehrere Bilder gehen): `docs/images/impact.png`
- **GitHub:** https://github.com/Jasper-Claus/netbox-service-canvas
- **PyPI:** https://pypi.org/project/netbox-service-canvas/

**Alt-Text fürs GIF** (Mastodon und Bluesky fragen danach, bringt dort auch Reichweite):

```text
Screen recording of the NetBox Service Canvas editor: a NAS is dragged onto the canvas, "Add missing" adds its services, a connection is drawn from a VM to the NAS, and the impact analysis marks in red and orange everything that fails if the NAS goes down.
```

### Reihenfolge

| Tag | Wo |
|---|---|
| 1 | X, Bluesky, Mastodon, r/homelab, r/Netbox |
| 2 | NetDev Slack `#netbox`, NetBox GitHub Discussions, Discord |
| 3–4 | r/selfhosted (Regeln zum Projekt-Tag beachten), Hacker News |
| danach | selfh.st-Newsletter, PR an awesome-netbox-Listen, deutsche Foren (Text in [announcement.md](announcement.md)) |

Tipps: GIF immer direkt hochladen, nicht nur verlinken. In der ersten Stunde auf Kommentare antworten.

---

### X / Twitter

**Post** (mit GIF):

```text
NetBox knows my racks, IPs and VMs. It never told me which service runs where and what breaks if a box dies.

So I built a plugin: drag hosts in, draw connections, click "Impact analysis". Open source.

#NetBox #homelab #selfhosted
```

**Erste Antwort auf den eigenen Post** (X zeigt Posts mit Link seltener an, darum die Links hier):

```text
pip install netbox-service-canvas

GitHub: https://github.com/Jasper-Claus/netbox-service-canvas
PyPI: https://pypi.org/project/netbox-service-canvas/

#NetDevOps #SysAdmin #OpenSource #Python #BuiltWithAI
```

---

### Bluesky

**Post** (mit GIF + Alt-Text, max. 300 Zeichen):

```text
NetBox knows my racks, IPs and VMs, but not which service runs where. So I built a plugin: drag hosts in, draw connections, see what breaks if a box dies.

pip install netbox-service-canvas
github.com/Jasper-Claus/netbox-service-canvas

#NetBox #homelab #selfhosted #opensource
```

**Antwort:**

```text
On PyPI: pypi.org/project/netbox-service-canvas

Built entirely with AI (Claude Code), tested in my homelab. Feedback welcome!

#NetDevOps #sysadmin #networking #python #BuiltWithAI
```

---

### Mastodon

**Post** (mit GIF + Alt-Text, max. 500 Zeichen; auf Mastodon läuft die Suche über Hashtags, darum viele):

```text
NetBox knows my racks, IPs and VMs, but never told me which service runs where and what breaks if a box dies. So I built a plugin for it:

🗺️ drag hosts in, draw connections
⚡ impact analysis: what fails if this host goes down
🖨️ export as PNG, SVG or A4 PDF

pip install netbox-service-canvas
https://github.com/Jasper-Claus/netbox-service-canvas
https://pypi.org/project/netbox-service-canvas/

#NetBox #Homelab #SelfHosted #NetDevOps #SysAdmin #Networking #IPAM #OpenSource #FOSS #Python #Proxmox
```

---

### Reddit: r/homelab, r/Netbox, r/selfhosted

Als **Bild-/Video-Post** mit dem GIF anlegen, Text in den Body (oder als ersten Kommentar, wenn der Sub nur Medien
erlaubt). Reddit nutzt keine Hashtags. Bei r/homelab die Flair *Projects* bzw. *Tutorial/Projects* wählen.

**Titel:**

```text
NetBox never showed me which service runs where and what breaks if a box dies, so I built a plugin for it
```

**Text:**

```text
NetBox is the source of truth for my whole homelab, but I always missed the service layer: Grafana pulling from Prometheus, Paperless writing to Postgres, the NAS everything backs up to.

So I built NetBox Service Canvas, an interactive canvas inside NetBox:

- Drag devices, VMs, services and applications onto a canvas
- Drawing a line creates a real NetBox object (protocol, port, data, hops)
- Impact analysis: click a host and see everything that breaks if it goes down, including VMs on a hypervisor
- Sticky notes, groups, auto layout, autosave
- Export as PNG, SVG or print-ready A4 PDF
- English and German UI, respects NetBox permissions, works with netbox-branching

Install: pip install netbox-service-canvas (NetBox 4.5.x, Apache-2.0)

GitHub: https://github.com/Jasper-Claus/netbox-service-canvas
PyPI: https://pypi.org/project/netbox-service-canvas/

Full disclosure: the code was written entirely by AI (Claude Code). I described what I wanted, tested it in my homelab and gave feedback. Curious what you think, and what you'd want on the canvas next!
```

---

### Hacker News (Show HN)

Unter https://news.ycombinator.com/submit. Werktags 15–17 Uhr deutscher Zeit. Kein GIF möglich, das GIF ist im
README oben.

**Title:**

```text
Show HN: NetBox Service Canvas – see which service runs where and what breaks
```

**URL:** `https://github.com/Jasper-Claus/netbox-service-canvas`

**Erster Kommentar** (direkt nach dem Posten selbst schreiben):

```text
I run my homelab out of NetBox, but it never answered "which service runs on which box, and what breaks if it dies?". This plugin adds a canvas where hosts, services and applications are real NetBox objects, every line is a stored connection (protocol, port, hops), and an impact analysis follows hypervisor -> VMs -> services -> apps.

Django + React Flow, no external assets, pip install netbox-service-canvas.

The code was written entirely by Claude Code; I acted as product owner and tester. Happy to answer questions about that workflow too.
```

---

### NetDev Slack `#netbox` / Discord / GitHub Discussions

Einladung zum Slack über https://netdev.chat. GIF anhängen.

```text
Hi all! I'd like to share a plugin I've been using in my homelab: netbox-service-canvas.

It adds an interactive canvas that shows which services run on which devices/VMs and how they talk. Edges are real data (ServiceConnection with protocol, port and hops), there's an Application model to group services, an impact analysis ("what breaks if this host fails?") and an A4 PDF export.

NetBox 4.5.x, change-logged models, works with netbox-branching, no external assets.
pip install netbox-service-canvas

GitHub: https://github.com/Jasper-Claus/netbox-service-canvas
PyPI: https://pypi.org/project/netbox-service-canvas/

Full disclosure: written entirely by AI (Claude Code). Reviews from experienced plugin devs are very welcome!
```
