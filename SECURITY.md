# Security Policy

## Supported versions

Only the latest release receives fixes. Please update before reporting.

| Version | Supported |
|---|---|
| 0.5.x | ✅ |
| < 0.5 | ❌ |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report it privately through GitHub instead:
[Security → Report a vulnerability](https://github.com/Jasper-Claus/netbox-service-canvas/security/advisories/new).

Please include the plugin and NetBox version, what an attacker can do, and steps to reproduce. You get an answer
within a week. Once a fix is released, the advisory is published and you are credited if you want.

## What the plugin does and does not do

Useful context for judging a report:

- It runs inside NetBox and uses NetBox's permission system for every object it reads or writes. Users without
  view permission on an object do not see it on the canvas; editing needs the matching add/change/delete permissions.
- All writes go through NetBox models with `full_clean()` and the change log (no raw SQL).
- It makes **no outbound requests** and loads no assets from CDNs; the frontend is bundled with the plugin.
- It does not scan, ping or connect to anything in your network. Everything it shows comes from the NetBox database.
- Dependencies are updated through Dependabot; CI runs the backend tests against NetBox 4.5, 4.6 and 4.7 and the frontend tests on
  every change.
