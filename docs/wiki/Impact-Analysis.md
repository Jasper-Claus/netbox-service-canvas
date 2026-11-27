# Impact Analysis

*What breaks if this host goes down?*

![Impact analysis](https://raw.githubusercontent.com/Jasper-Claus/netbox-service-canvas/main/docs/images/impact.png)

## How to start it

1. Click a node: a device, VM, service or application.
2. In the panel on the right, click **Impact analysis**.
3. Everything that is not affected fades out. The toolbar shows *Impact: failure of …*. Click × there to end the
   analysis.

## What the colours mean

| Colour | Meaning |
|---|---|
| Red | **Fails with it.** The object itself and everything that cannot run without it. |
| Orange | **Affected.** Objects that still run, but depend on something that failed. |
| Yellow, dashed | **Unreachable.** Objects that still run, but sit behind a failed proxy (see below). |
| Grey | Not affected. |

## How it is computed

The analysis only uses relations that are documented in NetBox and drawn on the canvas.

**Red** follows the "runs on" and "belongs to" lines:

- a failed device takes down the VMs whose *Device* field points to it,
- a failed device or VM takes down the services running on it,
- a failed service takes down every application it belongs to.

**Orange** follows the connections, against their direction: if A sends data to B and B has failed, A is affected.
This continues step by step: if A → B → C and C fails, both B and A are marked. Bidirectional connections count in
both directions. Disabled connections are ignored; planned ones count.

**Hops** count too: if a connection runs through a hop (for example a router, a firewall or a tunnel) and the hop
fails, the connection breaks. For a normal connection the source is marked as affected; for a proxy connection the
target is marked as unreachable.

**Yellow** follows connections of kind **Proxy** in their direction. Set the kind when drawing a line or later in the
connection panel:

- *Uses* (default): the source needs the target. Paperless → Postgres.
- *Proxy*: the target is reached through the source. Traefik → Paperless.

If the proxy fails, every target behind it is marked as unreachable, and so are the applications of those services.
Proxy chains are followed: Traefik → Authelia → Grafana marks both Authelia and Grafana if Traefik fails. Users of an
unreachable service are not marked, because the service itself still runs.

**Cables** (physical layer, see [[Editor Guide]]) are followed too. A device whose cables on the canvas all lead to
failed or unreachable devices is marked as unreachable, and so is everything running on it. Example: the switch fails,
the server that is only cabled to that switch is unreachable, and so are its VMs, services and applications. A server
with a second cable to another switch stays reachable. A failing server never makes its switch unreachable as long as
the switch has other cables.

## Limits

- Only objects and lines on the **current canvas** are analysed. Click **Add missing** first for a complete picture.
- A VM fails with a device only if the VM's **Device** field in NetBox points to that device. A VM that only belongs to
  a cluster is not marked, because NetBox does not know which cluster member it runs on.
- Redundancy is not modelled. If a service is reachable over two paths, it is still marked as affected when one of
  them fails.
- Cables count only between devices on the canvas, and only complete paths from interface to interface. Power is
  not considered.
- Nothing here is measured. The analysis answers "what if?" from what is documented in NetBox; it does not watch
  your network. Use a monitoring tool for live state.
