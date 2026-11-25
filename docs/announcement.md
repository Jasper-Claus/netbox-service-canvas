# Beitragstexte zum Teilen

Vorlagen zum Kopieren. Screenshot oder GIF anhängen, das bringt am meisten.

---

## Reddit: r/homelab, r/selfhosted, r/Netbox (Englisch)

**Titel:**
> I love NetBox, but it never showed me *which service runs where and who talks to whom*, so I (well, an AI) built a plugin for it

**Text:**

> NetBox is the source of truth for my whole homelab, but I always missed the **service layer**: Grafana pulling from
> Prometheus, Paperless writing to Postgres on the NAS, everything behind the reverse proxy.
>
> So I built **NetBox Service Canvas**, an interactive drag-and-drop canvas inside NetBox:
>
> - 🗺️ Drag devices, VMs, services and applications onto a canvas
> - 🔗 Draw an edge = create a real NetBox object (connection with protocol, port, data, hops)
> - ⚡ **Impact analysis**: click a host and see everything that breaks if it goes down
> - 📝 Sticky notes, groups, auto layout, autosave
> - 🖨️ Export as PNG, SVG or print-ready **A4 PDF**
> - 🔒 No CDNs, respects NetBox permissions, works with netbox-branching
>
> Fun fact: the plugin was written **100% by AI** (Claude Code). I was the "product owner": I described what I wanted,
> tested it in my homelab and gave feedback. I'm curious what you think about that, too!
>
> NetBox 4.5.x, Apache-2.0. Feedback, issues and ideas are very welcome. 🙏
>
> 👉 https://github.com/Jasper-Claus/netbox-service-canvas

---

## NetBox GitHub Discussions (Show and tell) / NetDev Slack `#netbox` (Englisch)

> 👋 Hi all! I'd like to share a plugin I've been using in my homelab: **netbox-service-canvas**.
>
> It adds an interactive canvas that shows which services run on which devices/VMs and how they communicate. Edges
> are real data (`ServiceConnection` with protocol, port and hops via VRF/VLAN/proxy…), and there's a new
> `Application` model to group services (e.g. Grafana = web + DB). There's also an impact analysis ("what breaks if
> this host fails?") and an A4 PDF export for documentation.
>
> Target: NetBox 4.5.x, change-logged models, compatible with netbox-branching, no external assets.
> Full disclosure: the code was written entirely by AI (Claude Code). Reviews from experienced plugin devs would be
> super appreciated!
>
> https://github.com/Jasper-Claus/netbox-service-canvas

---

## Deutschsprachige Foren / Discord (z. B. Homelab-Communities)

> Ich nutze NetBox sehr gerne für mein Homelab. Was mir aber immer gefehlt hat: **Welcher Dienst läuft auf welcher
> Kiste, und wer redet mit wem über welchen Port?**
>
> Deshalb habe ich mir ein Plugin gebaut, genauer gesagt: bauen lassen. **Der komplette Code ist zu 100 % von KI
> geschrieben** (Claude Code), ich habe Anforderungen gestellt, getestet und Feedback gegeben.
>
> **NetBox Service Canvas** kann:
> - Devices, VMs, Services und Applications per Drag & Drop auf eine Canvas ziehen
> - Verbindungen ziehen, die als echte NetBox-Daten gespeichert werden (Protokoll, Port, Daten, Zwischenstationen)
> - ⚡ Impact-Analyse: Was fällt aus, wenn dieser Server ausfällt?
> - Notizen, Gruppen, Auto-Layout, Export als PNG, SVG und **DIN-A4-PDF**
>
> NetBox 4.5.x, Open Source (Apache-2.0). Ich freue mich über Feedback, Ideen und Sterne ⭐
>
> 👉 https://github.com/Jasper-Claus/netbox-service-canvas

---

## Kurzpost (Mastodon / Bluesky / LinkedIn / X)

> 🗺️ NetBox Service Canvas: an interactive service map for #NetBox. Which service runs where, who talks to whom, and
> ⚡ what breaks if a host fails. A4 PDF export included. Built 100% with AI.
>
> https://github.com/Jasper-Claus/netbox-service-canvas
>
> #NetBoxPlugin #Homelab #SelfHosted #NetDevOps #IPAM #SysAdmin #OpenSource #BuiltWithAI #ClaudeCode
