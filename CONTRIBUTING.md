# Contributing

Thanks for your interest! 🎉 Issues, ideas, screenshots of your canvas and pull requests are all welcome.

## Ground rules

- **NetBox 4.5.x** is the target. Please mention your NetBox version in issues.
- Relationships are real NetBox data; the canvas only stores the layout. New features should follow that idea.
- Stay compatible with [netbox-branching](https://github.com/netboxlabs/netbox-branching): change-logged models,
  `snapshot()` + `full_clean()` + `save()` for writes, no raw SQL, no changes to NetBox core models or templates.
- No CDNs or external requests at runtime. Everything the browser needs is bundled.

## Project layout

| Path | What |
|---|---|
| `netbox_service_canvas/` | Django app: models, views, API, GraphQL, templates, tests |
| `frontend/` | React 18 + React Flow 12 editor, built with Vite into `netbox_service_canvas/static/netbox_service_canvas/dist` |
| `dev/` | Dev environment on top of netbox-docker (see `dev/README.md`) |
| `docs/` | Installation guide and German README |

## Workflow

1. Set up the dev environment: [dev/README.md](dev/README.md).
2. Frontend changes:
   ```bash
   cd frontend
   npm ci
   npm test          # Vitest
   npm run build     # type-check + bundle, commit the updated dist/ files
   ```
3. Backend changes: add or adjust tests in `netbox_service_canvas/tests/` and run
   `manage.py test netbox_service_canvas` inside the NetBox container.
4. New model fields: `manage.py makemigrations netbox_service_canvas`.
5. Lint: `ruff check netbox_service_canvas --select E,F`.
6. Update `CHANGELOG.md` under an *Unreleased* heading.

## A note on AI

This project was written entirely with AI assistance (Claude Code). AI-assisted contributions are fine. Please
review and test what you submit as carefully as if you had typed it yourself.
