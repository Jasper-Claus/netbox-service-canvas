# Contributing

Issues, ideas and pull requests are welcome.

## Reporting a bug

Please [open an issue](https://github.com/Jasper-Claus/netbox-service-canvas/issues/new/choose) and include:

- NetBox version, plugin version and how NetBox runs (netbox-docker or plain install),
- what you did, what you expected and what happened instead,
- for editor problems: the messages in the browser console (F12 → Console) and, if possible, a screenshot,
- for server errors: the traceback from the NetBox log (`docker compose logs netbox`).

## Ground rules

- **NetBox 4.5.x** is the target.
- Relationships are real NetBox data; the canvas only stores the layout. New features should follow that idea, so
  connections stay usable without a canvas (tabs, API, export).
- Stay compatible with [netbox-branching](https://github.com/netboxlabs/netbox-branching). netbox-branching replays
  changes through the change log, so:
  - all models are change-logged NetBox models,
  - writes use `snapshot()` + `full_clean()` + `save()`, never `bulk_update` or raw SQL,
  - deletions go through `.delete()` so they appear in the change log,
  - no changes to NetBox core models or templates.
- Endpoints that can be several object types use a `GenericForeignKey` with a whitelist of allowed types and an index
  on `(type, id)`, like `Service.parent` in NetBox core. Because generic relations have no database cascade, one
  `pre_delete` signal removes canvas nodes, connections and hops of a deleted object.
- The layout is saved diff-only: the client sends and the server writes only rows that changed, so moving nodes
  does not flood the change log.
- Permissions are checked by NetBox. The editor's flags only hide controls; every change goes through the REST API
  with the user's session, including object permission constraints.
- No CDNs or external requests at runtime. Everything the browser needs is bundled.
- Keep out of other plugins' way: own URL prefix (`service-canvas`), own menu, static path `netbox_service_canvas/`,
  templates in their own namespace, CSS only under `.nsc-root`.

## Project layout

| Path | What |
|---|---|
| `netbox_service_canvas/` | Django app: models, views, API, GraphQL, signals, templates, tests |
| `netbox_service_canvas/static/netbox_service_canvas/dist/` | Built frontend, committed to the repository |
| `frontend/` | React 18 + React Flow 12 editor (TypeScript, Vite, Vitest) |
| `dev/` | Dev environment on top of netbox-docker, demo data |
| `docs/` | Installation guide, German README, wiki sources (`docs/wiki/`) |

## Development setup

[dev/README.md](dev/README.md) (German) sets up NetBox with netbox-docker on an Ubuntu VM. The plugin is mounted from
your working copy, so Python changes are picked up without rebuilding the image. `frontend/` needs Node.js 22 on the
machine where you build it.

## Tests

Frontend:

```bash
cd frontend
npm ci
npm test            # Vitest: graph derivation, edge styling, layout diff, groups, port parser, translations
npm run build       # type check + bundle into netbox_service_canvas/static/netbox_service_canvas/dist/
npm run watch       # rebuild on every change, then reload the page
```

Backend (inside the NetBox container of the dev environment):

```bash
docker compose exec netbox /opt/netbox/netbox/manage.py test netbox_service_canvas --keepdb
```

Lint:

```bash
ruff check netbox_service_canvas --select E,F
```

CI runs the frontend tests and build, the lint and the Django tests against NetBox v4.5.7 and the newest 4.5
release. All of them must pass before a pull request is merged.

Test data for trying things out by hand: `dev/test_scenario.py` creates the canvas "Testlabor" (reverse proxy chain,
hops, switch with cables, application icons):

```bash
docker compose exec -T netbox /opt/netbox/netbox/manage.py nbshell < ~/netbox-service-canvas/dev/test_scenario.py
```

## Pull requests

1. Fork the repository and create a branch.
2. Make your change. Add or adjust tests in `netbox_service_canvas/tests/` or `frontend/src/*.test.ts`.
3. Frontend changes: run `npm run build` and commit the updated `dist/` files.
4. New model fields: `manage.py makemigrations netbox_service_canvas`.
5. Add an entry to `CHANGELOG.md` under *Unreleased*.
6. Open the pull request and describe what changes for users.

UI texts are written in English and passed through `t()`. Add the German translation to
`frontend/src/i18n.de.ts`; a test checks that every text has one.

## Releases (maintainers)

1. `npm run build` in `frontend/` and commit `dist/`.
2. Raise the version in `pyproject.toml` and `netbox_service_canvas/__init__.py`, update `CHANGELOG.md`.
3. Create a GitHub release with the tag `vX.Y.Z`. The workflow `publish.yml` builds the package and publishes it to
   PyPI.

## A note on AI

This project was written with AI assistance (Claude Code). AI-assisted contributions are fine. Please review and test
what you submit as carefully as if you had typed it yourself.
