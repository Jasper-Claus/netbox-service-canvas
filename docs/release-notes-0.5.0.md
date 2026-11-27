Thanks to everyone who reported it in [#10](https://github.com/Jasper-Claus/netbox-service-canvas/issues/10) and
[#11](https://github.com/Jasper-Claus/netbox-service-canvas/issues/11): the plugin now runs on **NetBox 4.5, 4.6 and
4.7**.

## New

- **NetBox 4.6 and 4.7 support.** CI tests every change against NetBox v4.5.7 and the newest 4.5, 4.6 and 4.7
  release.
- **Services with several protocols** (NetBox 4.7 `port_mappings`, e.g. DNS on `tcp/53` and `udp/53`) show all their
  ports on the canvas, in the node panel and in the sidebar.

## Fixed

- On NetBox 4.7, a canvas with a service on it no longer fails to load.

## Notes

- Quick edit in the node panel only renames a service with several protocols. Edit its ports in NetBox.
- No database migration in this release.

```text
netbox-service-canvas==0.5.0
```

Rebuild the image (`collectstatic` in `Dockerfile-Plugins`), restart, then reload the editor with Ctrl+F5.
Full list: [CHANGELOG.md](https://github.com/Jasper-Claus/netbox-service-canvas/blob/main/CHANGELOG.md).
