# Getting Started

## 1. Install

Requirements: **NetBox 4.5.x** and Python 3.12+.

**netbox-docker:** add the plugin to `plugin_requirements.txt`:

```text
netbox-service-canvas @ https://github.com/Jasper-Claus/netbox-service-canvas/archive/refs/tags/v0.2.0.tar.gz
```

Enable it in `configuration/plugins.py`. If you use netbox-branching, keep `netbox_branching` **last**:

```python
PLUGINS = ["netbox_service_canvas"]
PLUGINS_CONFIG = {"netbox_service_canvas": {"grid_size": 10}}
```

Rebuild, migrate and collect static files:

```bash
docker compose build --no-cache netbox && docker compose up -d
docker compose exec netbox /opt/netbox/netbox/manage.py migrate
docker compose exec netbox /opt/netbox/netbox/manage.py collectstatic --no-input
```

A detailed guide with backup, update and uninstall (German) is in
[docs/install-netbox-docker.md](https://github.com/Jasper-Claus/netbox-service-canvas/blob/main/docs/install-netbox-docker.md).

## 2. Your first canvas

1. Go to **Plugins → Service Canvas → Canvases → Add**, name it e.g. *Homelab* and save.
2. Open the **Editor** tab.
3. In the left sidebar, drag your **Devices** and **VMs** onto the canvas (or click **+**).
4. Click **"Fehlende ergänzen"** (add missing). The editor pulls in the services on those hosts and their peers.
5. Drag from the **dot on the right** of a node onto another node to create a **data flow**.
6. Click **"Auto-Layout"**, then tidy up by hand. Autosave stores the layout.

## 3. Add things that don't exist yet

These buttons are under **"Neu anlegen"** (create new) at the bottom of the sidebar:

- **Device** and **VM** open the normal NetBox form in a new tab. Back in the editor, the list refreshes
  automatically.
- **Service** creates a NetBox service on a host, optionally together with an application. See
  [[Service vs Application]].
- **Application** groups existing services.
- **"Notiz"** adds a sticky note.

Next: [[Editor Guide]]
