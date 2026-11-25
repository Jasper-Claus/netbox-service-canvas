# FAQ & Troubleshooting

### I don't see any delete or remove buttons.
The editor is in **"View only"** (view mode). Click the button at the top left to switch to **"Edit"**. If
you only see a grey badge, your user lacks change permission on the canvas.

### Is removing a node from the canvas the same as deleting it?
No. "Remove" only removes the node from this canvas. To delete the object itself, use "Edit all fields" →
Delete in NetBox. See [[Editor Guide]].

### Does the plugin load anything from the internet?
No. There are no CDNs and no external calls. The frontend is bundled with the plugin.

### Does it work with netbox-branching?
Yes. All models are change-logged and there is no raw SQL. Keep `netbox_branching` **last** in `PLUGINS`.

### After an update the editor looks old or broken.
Run `collectstatic` (production), then hard-reload the browser with **Ctrl+F5**. In a dev setup with `DEBUG = True`
and `runserver`, static files are served directly, so `collectstatic` is not needed.

### `collectstatic` fails with `PermissionError`.
The static directory belongs to another user. Fix the ownership or permissions of
`/opt/netbox/netbox/static/netbox_service_canvas`. In a `DEBUG` dev setup you can skip `collectstatic` instead (see
above).

### My hypervisor fails in the impact analysis, but its VMs stay grey.
Set the **Device** field of those VMs in NetBox (the cluster member they run on). Then they appear with a "runs on"
edge to the device and fail together with it. "Add missing" on the device adds its VMs to the canvas.

### Which languages does the editor support?
English and German. The editor follows the NetBox language setting (user preferences or `LANGUAGE_CODE`). Another
language needs one dictionary file, `frontend/src/i18n.<lang>.ts`; PRs are welcome!

### Was this really written 100% by AI?
Yes, with Claude Code. The README has the details.
