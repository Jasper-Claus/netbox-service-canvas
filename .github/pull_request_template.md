## What does this change?

<!-- Short description, link the issue if there is one (e.g. "Closes #12") -->

## Checklist

- [ ] Tested against at least one supported NetBox version (CI runs 4.5, 4.6 and 4.7)
- [ ] `npm test` and `npm run build` in `frontend/` (bundled assets committed if the frontend changed)
- [ ] Backend tests pass (`manage.py test netbox_service_canvas`)
- [ ] Docs / README updated if behaviour changed
- [ ] Still compatible with netbox-branching (change-logged models, no raw SQL)
