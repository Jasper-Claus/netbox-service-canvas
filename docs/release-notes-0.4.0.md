Thanks for all the feedback on 0.3.0! This release follows it: the plugin stays a **documentation tool** for impact
assessment, design and security reviews, it does **not** turn NetBox into a monitoring platform, and new features
reuse what NetBox already knows.

## New

- **Reverse proxies in the impact analysis**: mark a connection as *Proxy* (target is reached through the source).
  If the proxy fails, everything behind it is shown as *unreachable*, including proxy chains such as
  Traefik → Authelia → Grafana.
- **Physical layer**: the cables documented in NetBox are shown between devices (interface names as label, paths
  through patch panels count as one link). A failed switch makes the servers that only hang on it unreachable.
  *Add missing* also adds cabled switches and routers. Toggle it in the toolbar.
- **Hops count**: if a hop of a connection fails, the connection breaks in the impact analysis.
- **Bendable, colourable lines**: drag the + points of a selected line to route it, pick a colour per canvas.
- **Search** in the toolbar: find an object by name, host, IP or port and jump to it.
- **Application icons**: 24 icons (database, web, DNS, backup, media, …).

## Fixed and project

- All Django tests pass again and are now required in CI; bulk creation of hops and the reorder permission are fixed.
- `SECURITY.md` with private reporting, Dependabot for dependencies.
- README section *What this is not*: no monitoring, no discovery, not another network diagram.

## Upgrade

Migration `0003` adds three fields; existing connections keep their behaviour (kind *uses*).

```text
netbox-service-canvas==0.4.0
```

Rebuild the image (`collectstatic` in `Dockerfile-Plugins`), restart, then reload the editor with Ctrl+F5.
Full list: [CHANGELOG.md](https://github.com/Jasper-Claus/netbox-service-canvas/blob/main/CHANGELOG.md).
