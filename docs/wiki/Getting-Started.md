# Getting Started

This page walks you through a first canvas with a small homelab: a NAS, a VM called `monitoring`, Grafana and
Prometheus. Use your own names; the steps are the same.

## 1. Install

Follow the [installation section of the README](https://github.com/Jasper-Claus/netbox-service-canvas#installation).
It covers netbox-docker (including a setup for people who have never installed a plugin) and a plain install.

When it worked, the NetBox menu shows **Plugins → Service Canvas**. If the editor later stays at "Loading canvas…",
the static files are missing; see [[FAQ]].

## 2. What you need in NetBox

The canvas shows NetBox objects. It does not invent its own. For the example you need:

- a **device** `nas` and a **virtual machine** `monitoring` (create them in NetBox as usual),
- optionally: set the VM's *Device* field to the host it runs on. Then the canvas knows that `monitoring` fails when
  that host fails.

Services and applications can be created later directly in the editor.

## 3. Create a canvas

1. Go to **Plugins → Service Canvas → Canvases** and click **Add**.
2. Name it *Homelab* and save.
3. Open the **Editor** tab.

A canvas is only a view. You can create several (for example one per site) and the same object can appear on all of
them.

## 4. Put hosts on the canvas

The sidebar on the left lists devices, VMs, services and applications. Search for `nas` and drag it onto the canvas,
or click **+** next to it. Do the same for `monitoring`.

Then click **Add missing** in the toolbar. The editor looks up everything in NetBox that belongs to the objects on the
canvas (services on these hosts, VMs on these devices, connection peers) and offers to add it.

## 5. Add a service

Suppose Grafana runs on `monitoring` on TCP port 3000, but NetBox does not know it yet.

1. At the bottom of the sidebar, under **Create new**, click **Service**.
2. Name `grafana`, protocol TCP, port `3000`, host `monitoring`.
3. Under *Application (optional)* choose **New application** and name it `Grafana`.
4. Click **Create service**.

NetBox now has a service `grafana` on `monitoring` and an application `Grafana`. Both appear on the canvas: a grey
dashed line shows that the service runs on the VM, a dotted purple line shows that it belongs to the application.
See [[Service vs Application]] for when you need an application at all.

Create a second service `prometheus` (TCP 9090 on `monitoring`) the same way, this time with application **None**.

## 6. Draw a connection

Grafana reads metrics from Prometheus. To record that:

1. In edit mode every node has a small dot on its right edge.
2. Drag from that dot onto the `prometheus` service and let go.
3. Choose **Data flow**. The port is taken from the target service. Optionally describe the data, for example
   *metrics*.
4. Click **Create connection**.

This creates a real **service connection** in NetBox. It also shows up in the *Connections* tab of both services and
in the REST API, even without the canvas.

## 7. Arrange and save

Click **Auto layout** to arrange everything from left to right, then move things by hand if you like. With
**Autosave** switched on (the default), every change is stored right away. The status next to it shows *Saved*.

## 8. Try the impact analysis

Click `monitoring` and then **Impact analysis** in the panel on the right. The VM, its services and the `Grafana`
application turn red: they fail with it. Anything that sends data to them turns orange. Click × in the toolbar to end
the analysis. More in [[Impact Analysis]].

## 9. Export

Use **PDF (A4)** in the toolbar to get a printable page with title, date and legend, or PNG / SVG for a wiki or
ticket. See [[Export]].

Next: [[Editor Guide]]
