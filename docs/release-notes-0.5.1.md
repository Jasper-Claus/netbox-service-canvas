A small maintenance release with fixes to
the documentation. No code changes in the editor, no migration.

## Fixed

- **Installation with netbox-docker:** `Dockerfile-Plugins` has to copy `configuration/configuration.py` and
  `configuration/plugins.py` into the image before `collectstatic`. Without these two lines NetBox does not know the
  plugin while the image is built, the editor's JavaScript is not collected, and the editor stays at
  "Loading canvas…". If you followed the old instructions, add them now:

  ```dockerfile
  COPY configuration/configuration.py /etc/netbox/config/configuration.py
  COPY configuration/plugins.py /etc/netbox/config/plugins.py
  RUN DEBUG="true" SECRET_KEY="dummydummydummydummydummydummydummydummydummydummy" /opt/netbox/venv/bin/python /opt/netbox/netbox/manage.py collectstatic --no-input
  ```

- NetBox showed plugin version 0.4.0 for 0.5.0. It now shows the right version.
- Smaller corrections in README, wiki, SECURITY.md and the issue templates.

```text
netbox-service-canvas==0.5.1
```

Full list: [CHANGELOG.md](https://github.com/Jasper-Claus/netbox-service-canvas/blob/main/CHANGELOG.md).
