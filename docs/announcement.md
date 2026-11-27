> **Archived:** announcement texts for version 0.3.0 (November 2026), kept for reference. Current NetBox support: 4.5 to 4.7, see the README.

# Beitragstexte zum Teilen

Vorlagen zum Kopieren. Immer `docs/images/demo.gif` direkt hochladen (nicht nur verlinken): Bewegtbild im Feed holt
deutlich mehr Aufmerksamkeit als ein Link.

---

## X / Twitter

**Einzelpost** (unter 280 Zeichen; den Link als erste Antwort posten, X zeigt Posts mit externem Link seltener an):

> I built a NetBox plugin that shows which service runs where, who talks to whom, and what breaks if a host goes down.
>
> Drag hosts in, draw connections, click "Impact analysis". Open source.
>
> #NetBox #homelab

**Erste Antwort:**

> pip install netbox-service-canvas
> https://github.com/Jasper-Claus/netbox-service-canvas

**Alternative als Thread** (1. Post mit GIF, 2. mit `impact.png`, 3. mit `editor.png`):

> 1/ NetBox knows my racks, IPs and VMs. It never told me which service runs on which box and what talks to what.
> So I made a plugin for that. 🧵
>
> 2/ Click a host, hit "Impact analysis": red is what fails with it, orange is what depends on it. It follows VMs on
> a hypervisor, their services and the apps built on them.
>
> 3/ Every line you draw is a real NetBox object (protocol, port, data, hops), with REST API, GraphQL and changelog.
> Export as PNG, SVG or A4 PDF.
>
> 4/ Fun part: the code was written entirely by AI (Claude Code). I described, tested and gave feedback.
> pip install netbox-service-canvas
> https://github.com/Jasper-Claus/netbox-service-canvas

---

## Reddit: r/homelab, r/selfhosted, r/Netbox

**Titel:**
> I love NetBox, but it never showed me which service runs where and who talks to whom, so I built a plugin for it

**Text** (GIF als Bild/Video-Post hochladen, Text als ersten Kommentar oder im Body):

> NetBox is the source of truth for my whole homelab, but I always missed the **service layer**: Grafana pulling from
> Prometheus, Paperless writing to Postgres on the NAS, everything behind the reverse proxy.
>
> So I built **NetBox Service Canvas**, an interactive canvas inside NetBox:
>
> - Drag devices, VMs, services and applications onto a canvas
> - Drawing a line creates a real NetBox object (connection with protocol, port, data, hops)
> - **Impact analysis**: click a host and see everything that breaks if it goes down, including VMs on a hypervisor
> - Sticky notes, groups, auto layout, autosave
> - Export as PNG, SVG or print-ready A4 PDF
> - No CDNs, respects NetBox permissions, works with netbox-branching
>
> `pip install netbox-service-canvas` · NetBox 4.5.x · Apache-2.0
>
> Full disclosure: the code was written 100% by AI (Claude Code). I was the product owner: I described what I wanted,
> tested it in my homelab and gave feedback. Curious what you think about that, too.
>
> https://github.com/Jasper-Claus/netbox-service-canvas

---

## NetBox GitHub Discussions / NetDev Slack `#netbox`

> Hi all! I'd like to share a plugin I've been using in my homelab: **netbox-service-canvas**.
>
> It adds an interactive canvas that shows which services run on which devices/VMs and how they communicate. Edges
> are real data (`ServiceConnection` with protocol, port and hops via VRF/VLAN/proxy), and there's an `Application`
> model to group services (e.g. Grafana = web + DB). There's an impact analysis ("what breaks if this host fails?")
> that follows VMs pinned to a device, and an A4 PDF export for documentation.
>
> NetBox 4.5.x, change-logged models, compatible with netbox-branching, no external assets, on PyPI.
> Full disclosure: the code was written entirely by AI (Claude Code). Reviews from experienced plugin devs would be
> very welcome!
>
> https://github.com/Jasper-Claus/netbox-service-canvas

---

## Deutschsprachige Foren / Discord

> Ich nutze NetBox sehr gerne für mein Homelab. Was mir aber immer gefehlt hat: **Welcher Dienst läuft auf welcher
> Kiste, und wer redet mit wem über welchen Port?**
>
> Deshalb habe ich mir ein Plugin gebaut, genauer gesagt: bauen lassen. **Der komplette Code ist von KI geschrieben**
> (Claude Code), ich habe Anforderungen gestellt, getestet und Feedback gegeben.
>
> **NetBox Service Canvas** kann:
> - Devices, VMs, Services und Applications per Drag & Drop auf eine Canvas ziehen
> - Verbindungen ziehen, die als echte NetBox-Daten gespeichert werden (Protokoll, Port, Daten, Zwischenstationen)
> - Impact-Analyse: Was fällt aus, wenn dieser Server ausfällt? Inklusive VMs auf dem Hypervisor
> - Notizen, Gruppen, Auto-Layout, Export als PNG, SVG und DIN-A4-PDF
> - Oberfläche auf Deutsch oder Englisch, je nach NetBox-Sprache
>
> `pip install netbox-service-canvas` · NetBox 4.5.x · Open Source (Apache-2.0). Feedback und Ideen sind willkommen.
>
> 👉 https://github.com/Jasper-Claus/netbox-service-canvas

---

## Mastodon / Bluesky / LinkedIn

> NetBox Service Canvas: an interactive service map for #NetBox. Which service runs where, who talks to whom, and
> what breaks if a host fails. A4 PDF export, English and German UI. Built entirely with AI.
>
> pip install netbox-service-canvas
> https://github.com/Jasper-Claus/netbox-service-canvas
>
> #Homelab #SelfHosted #NetDevOps #SysAdmin #OpenSource

---

## Wo posten (grob nach Reichweite für dieses Thema)

| Ort | Warum | Hinweise |
|---|---|---|
| **r/homelab** | Größte passende Zielgruppe, NetBox ist dort bekannt | GIF als Medien-Post. Regeln zu Eigenwerbung lesen; ein Open-Source-Projekt mit Demo kommt gut an. |
| **r/selfhosted** | Sehr aktiv, mag neue Tools | Regeln prüfen: neue Projekte sind dort zeitweise nur an bestimmten Tagen erlaubt. |
| **r/Netbox** | Klein, aber genau die richtigen Leute | Kann am selben Tag wie r/homelab laufen. |
| **NetDev Slack `#netbox`** | Dort sind NetBox-Maintainer und Plugin-Autoren | Kurz halten, Link + GIF. Einladung über netdev.chat. |
| **NetBox GitHub Discussions** | Bleibt auffindbar, wird gegoogelt | Passende Kategorie wählen (Show and tell bzw. Plugins). |
| **Hacker News (Show HN)** | Hohe Reichweite, wenn es zündet | Titel: `Show HN: NetBox Service Canvas – see which service runs where`. Werktags 15–17 Uhr deutscher Zeit posten, in der ersten Stunde Kommentare beantworten. |
| **selfh.st Newsletter** | Wöchentlicher Self-Hosting-Newsletter mit großer Leserschaft | Über das Formular auf selfh.st einreichen. |
| **awesome-netbox / Plugin-Listen** | Dauerhafte Sichtbarkeit, bringt Sterne über Monate | Pull Request mit einer Zeile. Auch prüfen, ob die NetBox-Labs-Pluginübersicht Community-Plugins aufnimmt. |
| **X, Bluesky, Mastodon** | Netzwerker und Homelabber, Hashtags #homelab #NetBox | GIF direkt hochladen. Auf Mastodon z. B. über fosstodon.org. |
| **LinkedIn** | Netzwerk-Engineers und IT-Leute aus dem Beruf | Persönlich formulieren ("Ich habe…"), Link in den ersten Kommentar. |
| **Deutsch:** ComputerBase- und Hardwareluxx-Forum, r/de_EDV, Homelab-Discords | Deutschsprachige Homelab-Szene | Den deutschen Text oben nehmen. |

**Tipps:**
- Nicht alles am selben Tag: zuerst r/homelab und r/Netbox, ein bis zwei Tage später r/selfhosted und Hacker News,
  dann Newsletter und Listen. So lassen sich Fragen aus den ersten Kommentaren in README oder FAQ einarbeiten.
- In den ersten ein bis zwei Stunden auf Kommentare antworten; das hält den Beitrag in den Feeds oben.
- Eine offene Frage am Ende ("Was würdet ihr als Nächstes brauchen?") bringt mehr Kommentare.
- Vor dem Posten: PyPI-Release fertig, Social Preview im Repo gesetzt, Wiki online.
