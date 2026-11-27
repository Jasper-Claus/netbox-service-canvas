# FAQ & Troubleshooting

## Installation

### The editor stays at "Loading canvas…".
The static files (JavaScript and CSS) were not collected. Typical signs in the browser console: a 404 for
`canvas.js` or "MIME type ("") blocked". In netbox-docker, add the two `COPY` lines and the `collectstatic` line to
`Dockerfile-Plugins` and rebuild the image, as described in the
[README](https://github.com/Jasper-Claus/netbox-service-canvas#installation). Then reload with Ctrl+F5.

### `collectstatic` fails with `PermissionError`.
The NetBox container runs as an unprivileged user and may not write to the static folder. Run `collectstatic` while
the image is built (see above), or run it by hand as root:
`docker compose exec -u root netbox /opt/netbox/netbox/manage.py collectstatic --no-input`. Files collected by hand
are lost when the container is recreated, for example on the next update, so the `Dockerfile-Plugins` way is the
lasting fix. If you mount your own logo into the static folder, the manual run stops with "Device or resource busy";
add `--ignore "netbox_logo_*"` in that case.
In a dev setup with `DEBUG = True` and `runserver`, static files are served directly and `collectstatic` is not
needed.

### NetBox does not start after a NetBox upgrade.
The plugin supports NetBox 4.5, 4.6 and 4.7. On another minor version NetBox refuses to start while the plugin is
enabled. Install a plugin release that supports your NetBox version, or remove `netbox_service_canvas` from
`PLUGINS`.

### After an update the editor looks old or broken.
Reload the page with Ctrl+F5. The file name of `canvas.js` does not change between versions, so the browser may still
use the old one.

### Does it work with netbox-branching?
Yes. Canvases, connections and layout changes work inside a branch and are merged with it. Keep `netbox_branching`
last in `PLUGINS`. Branches created before the plugin was installed need to be migrated in the branch view.

### Does the plugin load anything from the internet?
No. There are no CDNs and no external requests. Everything is bundled with the plugin.

## Using the editor

### I don't see any remove buttons or connection dots.
The editor is in view mode. Click **View only** at the top left to switch to **Edit**. If you only see a grey badge,
your user lacks change permission on the canvas.

### Is removing a node the same as deleting it?
No. **Remove** only takes the node off this canvas. To delete the object itself, use **Edit all fields** → Delete in
NetBox. See [[Editor Guide]].

### Saving fails with 403.
Your user lacks a permission. The editor names the missing one. The permissions table is in the
[README](https://github.com/Jasper-Claus/netbox-service-canvas#permissions).

### I deleted an object in NetBox. Where did it go on the canvas?
It disappears from every canvas, and connections that start or end at it are deleted as well.

### My hypervisor fails in the impact analysis, but its VMs stay grey.
Set the **Device** field of those VMs in NetBox to the host they run on. Then they are linked to the device and fail
with it. **Add missing** on the device adds its VMs to the canvas.

### Can I undo a change?
Not in the editor. Every change is recorded in the NetBox change log, where you can look up the previous values.

### Which languages does the editor support?
English and German. The editor follows the NetBox language setting (user preferences or `LANGUAGE_CODE`). Another
language needs one dictionary file, `frontend/src/i18n.<lang>.ts`. Pull requests are welcome.
