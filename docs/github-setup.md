# GitHub-Repo veröffentlichen: Checkliste

Diese Datei ist für dich als Maintainer. Sie listet alles, was sich nicht über Dateien im Repo einstellen lässt.

## 1. Repo anlegen und pushen

```powershell
gh repo create Jasper-Claus/netbox-service-canvas --public --source . --remote origin --description "Interactive service map for NetBox: which services run where, how they talk, and what breaks if a host fails."
```
```powershell
git push -u origin main
```

## 2. Beschreibung, Website, Topics

**About → Description:**
> 🗺️ Interactive service map for NetBox: which services run where, how they talk, and what breaks if a host fails.
> Built 100% with AI.

**Topics** (Settings → About → Topics, max. 20). Sie machen das Repo in der GitHub-Suche auffindbar:

```
netbox netbox-plugin homelab selfhosted ipam dcim service-map dependency-mapping network-documentation
infrastructure-documentation impact-analysis netdevops django react react-flow diagram sysadmin
ai-generated claude-code open-source
```

Per CLI:

```powershell
gh repo edit Jasper-Claus/netbox-service-canvas --add-topic netbox,netbox-plugin,homelab,selfhosted,ipam,dcim,service-map,dependency-mapping,network-documentation,infrastructure-documentation,impact-analysis,netdevops,django,react,react-flow,diagram,sysadmin,ai-generated,claude-code
```

Außerdem **Settings → Features → Discussions** einschalten. Der Issue-Dialog verlinkt dorthin.

## 3. Screenshots (wichtig für Aufmerksamkeit!)

1. In NetBox eine schöne Beispiel-Canvas bauen: Gruppen, Applications, ein paar Datenflüsse, eine Notiz.
2. Screenshots speichern unter `docs/images/`:
   - `editor.png`: der ganze Editor (ca. 1600×900)
   - `impact.png`: Impact-Analyse aktiv
   - `node-panel.png`: Knoten-Panel offen
3. In `README.md` den auskommentierten Bild-Block oben einkommentieren.
4. Optional ein kurzes GIF (z. B. mit ScreenToGif): Device hineinziehen, Kante ziehen, Impact-Analyse.

**Social Preview** (Settings → General → Social preview): `editor.png` auf 1280×640 zuschneiden und hochladen. Dieses
Bild erscheint, wenn der Link in Foren, Discord oder Reddit geteilt wird.

## 4. Erstes Release

```powershell
git tag -a v0.2.0 -m "v0.2.0"
```
```powershell
git push origin v0.2.0
```
```powershell
gh release create v0.2.0 --title "v0.2.0 – Applications, Impact-Analyse, A4-PDF" --notes-file CHANGELOG.md
```

Danach funktionieren die Installations-URLs aus dem README (`…/archive/refs/tags/v0.2.0.tar.gz`).

## 5. Optional: PyPI

Mit einem PyPI-Release lautet die Installation einfach `netbox-service-canvas==0.2.0`:

```powershell
python -m pip install build twine
```
```powershell
python -m build
```
```powershell
python -m twine upload dist/*
```

## 6. Bekannt machen

Fertige Beitragstexte stehen in [announcement.md](announcement.md).
