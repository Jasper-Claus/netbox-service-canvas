# Impact Analysis

*"What breaks if this box goes down?"*

![Impact analysis](https://raw.githubusercontent.com/Jasper-Claus/netbox-service-canvas/main/docs/images/impact.png)

## How to use it

1. Click a node (device, VM, service or application).
2. In the node panel, click **⚡ "Impact-Analyse"**.
3. Everything else fades out. A chip in the toolbar shows *Impact: Ausfall von …* ("failure of …"). Click × to end
   the analysis.

## What the colours mean

| Colour | Meaning |
|---|---|
| 🔴 Red | **Fails with it**: the object itself, the services running on a failed host, and the applications of failed services |
| 🟠 Orange | **Affected**: anything that sends data to a failed object, transitively (if A → B → failed C, then A and B are marked) |

Bidirectional flows count in both directions.

## Limits

- Only what is on the **current canvas** is analysed. Use **"Fehlende ergänzen"** first for a complete picture.
- VMs are not yet linked to the device they run on, so a failing hypervisor does not mark its VMs yet. This is on
  the roadmap.
