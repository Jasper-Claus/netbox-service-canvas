# GitHub-Repo: Checkliste für den Maintainer

Diese Datei listet alles, was sich nicht über Dateien im Repo einstellen lässt. Repo, Tag `v0.2.0` und das
Release v0.2.0 gibt es schon. Offen ist alles ab Version 0.3.0 (englische Oberfläche, `pip install`, Demo-GIF).

## ✅ Jetzt noch zu tun (in dieser Reihenfolge)

- [ ] **1. Änderungen committen und pushen.** Danach sind README, GIF, Bilder und Doku auf GitHub sichtbar.
- [ ] **2. Social Preview hochladen:** Settings → General → Social preview → Edit → `docs/images/social-preview.png`.
- [ ] **3. About-Box prüfen:** Beschreibung, Website und Topics (siehe [Abschnitt 2](#2-beschreibung-website-topics)).
- [ ] **4. Discussions einschalten:** Settings → General → Features → *Discussions*. Der Issue-Dialog verlinkt dorthin.
- [ ] **5. PyPI einrichten** (einmalig, [Abschnitt 4](#4-pypi-einrichten-einmalig)): Konto, Trusted Publisher und
      GitHub-Environment `pypi`.
- [ ] **6. Release v0.3.0 erstellen** ([Abschnitt 5](#5-release-v030)) und unter **Actions** prüfen, dass
      *Publish to PyPI* grün ist.
- [ ] **7. Installation testen:** auf der NetBox-VM `netbox-service-canvas==0.3.0` in `plugin_requirements.txt`
      eintragen, neu bauen, `migrate`, `collectstatic`. Editor öffnen, auf Deutsch und auf Englisch anschauen
      (Sprache in den NetBox-Benutzereinstellungen umschalten).
- [ ] **8. Wiki hochladen bzw. aktualisieren** ([Abschnitt 6](#6-wiki)). Die Seiten haben jetzt englische Button-Namen.
- [ ] **9. Repo auf dem Profil anpinnen:** github.com/Jasper-Claus → *Customize your pins*.
- [ ] **10. Bekannt machen** ([Abschnitt 7](#7-bekannt-machen)), erst wenn `pip install` funktioniert.

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

## 5. Release v0.3.0

Die Version in `pyproject.toml` (jetzt `0.3.0`) muss zum Tag passen, sonst bricht der Workflow ab.

```powershell
git tag -a v0.3.0 -m "v0.3.0"
```
```powershell
git push origin v0.3.0
```
```powershell
gh release create v0.3.0 --title "v0.3.0: English UI, pip install, VM impact" --notes "English UI (follows the NetBox language), pip install netbox-service-canvas, impact analysis follows VMs on their hypervisor. See CHANGELOG.md."
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

## 7. Bekannt machen

Fertige Texte für Reddit, X, Slack, Foren und LinkedIn stehen in [announcement.md](announcement.md), dazu eine
Tabelle, wo es sich lohnt. Hier der Ablauf und die Hashtags.

### Ablauf

| Tag | Wo |
|---|---|
| 1 | r/homelab, r/Netbox, X, Bluesky, Mastodon |
| 2 | NetDev Slack `#netbox`, NetBox GitHub Discussions, LinkedIn |
| 3–4 | r/selfhosted (Regeln zum Projekt-Tag beachten), Hacker News *Show HN* |
| danach | selfh.st-Newsletter einreichen, PR an awesome-netbox-Listen, deutsche Foren und Discords |

- Immer das **GIF direkt hochladen**, nicht nur den Link. Bewegtbild bekommt im Feed deutlich mehr Aufmerksamkeit.
- Auf X und LinkedIn den **Link in die erste Antwort** bzw. den ersten Kommentar. Posts mit externem Link werden
  seltener ausgespielt.
- In der ersten Stunde auf Kommentare antworten. Das hält den Beitrag oben.
- Mit einer Frage enden, z. B. *"What would you want on the canvas next?"*.
- Nach ein paar Wochen ein Update posten (neues Feature + GIF). Das zweite Posting erreicht oft mehr Leute als das erste.

### Hashtags

**X / Twitter:** X zeigt Posts mit 1–3 Hashtags am besten an. Darum im Post selbst nur die ersten zwei oder drei,
weitere in die Antwort mit dem Link:

```
#NetBox #homelab #selfhosted
```
```
#NetDevOps #SysAdmin #OpenSource #Python #Django #ReactJS #DevOps #Networking #NetworkAutomation #IPAM #BuiltWithAI #ClaudeCode #AI
```

**Mastodon:** Die Suche dort läuft fast nur über Hashtags, also ruhig viele (am besten am Ende, in CamelCase, das
ist für Screenreader lesbar):

```
#NetBox #NetBoxPlugin #Homelab #SelfHosted #SelfHosting #NetDevOps #SysAdmin #Networking #NetworkEngineering
#NetworkAutomation #IPAM #DCIM #Documentation #InfrastructureAsCode #OpenSource #FOSS #Python #Django #React
#Proxmox #TrueNAS #DevOps #ITOps #BuiltWithAI #ClaudeCode
```

**Bluesky:** Hashtags funktionieren, außerdem gibt es Feeds zu Homelab und Self-Hosting, die nach Stichworten
filtern ("homelab", "selfhosted" im Text helfen):

```
#NetBox #homelab #selfhosted #NetDevOps #sysadmin #networking #opensource #python #BuiltWithAI
```

**LinkedIn:** 3–5 Hashtags reichen, mehr wirkt dort schnell wie Spam:

```
#NetBox #NetworkAutomation #NetDevOps #OpenSource #AI
```

**Instagram / Threads** (falls gewünscht; GIF als Video hochladen):

```
#homelab #homelabsetup #selfhosted #sysadmin #networkengineer #networking #devops #opensource #python #coding
#programming #serverroom #proxmox #truenas #techsetup #itinfrastructure #ai #aicoding #buildinpublic
```

**Reddit und Hacker News:** keine Hashtags. Dort zählen ein klarer Titel und das GIF.

### Weitere Stellen

- **GitHub-Profil-README:** einen Satz und das GIF ergänzen.
- **dev.to oder Medium:** ein kurzer Artikel "How I built a NetBox plugin entirely with AI" (Tags: `netbox`,
  `homelab`, `python`, `ai`). Solche Erfahrungsberichte werden gerne geteilt und verlinken dauerhaft aufs Repo.
- **YouTube Shorts / TikTok:** das GIF als 25-Sekunden-Clip mit Text-Overlay ("What breaks if my NAS dies?").
- **Homelab-YouTuber und Newsletter** (z. B. selfh.st, Homelab-Discords) kurz anschreiben, mit Link und GIF.
