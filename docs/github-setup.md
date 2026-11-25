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

## 3. Bilder und Social Preview

Die Bilder liegen fertig in `docs/images/` und sind in beide READMEs eingebunden:

| Datei | Inhalt |
|---|---|
| `banner.png` | Banner oben im README (2560×1280) |
| `editor.png` | Der ganze Editor mit Knoten-Panel (Dark Theme) |
| `impact.png` | Impact-Analyse: Ausfall von `truenas` (Light Theme) |
| `new-service.png` | Dialog „Neuer Service“ mit Application |
| `social-preview.png` | Social Preview, 1280×640 |

Alle Bilder zeigen eine Demo-Umgebung, keine echten Daten.

**Social Preview** lässt sich nur im Browser setzen: Settings → General → Social preview → Edit → `docs/images/social-preview.png`
hochladen. Dieses Bild erscheint, wenn der Link in Foren, Discord oder Reddit geteilt wird.

Optional: ein kurzes GIF (z. B. mit ScreenToGif): Device hineinziehen, Kante ziehen, Impact-Analyse.

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

## 7. Wiki

Die Wiki-Seiten liegen als Quelle in `docs/wiki/` (Home, Getting Started, Service vs Application, Editor Guide,
Impact Analysis, Export, FAQ, Sidebar). GitHub legt das Wiki-Repo erst an, wenn die erste Seite im Browser
gespeichert wurde:

1. Im Repo auf **Wiki → Create the first page** klicken und einfach speichern.
2. Danach die Seiten hochladen:

```powershell
git clone https://github.com/Jasper-Claus/netbox-service-canvas.wiki.git $env:TEMP\nsc-wiki
```
```powershell
Copy-Item docs\wiki\*.md $env:TEMP\nsc-wiki\ -Force; git -C $env:TEMP\nsc-wiki add -A; git -C $env:TEMP\nsc-wiki commit -m "Add wiki pages"; git -C $env:TEMP\nsc-wiki push
```
