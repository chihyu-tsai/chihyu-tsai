# Project handoff

## Design decision — November 7, 2026

- **V3 is the owner's chosen design and the only version to maintain.**
- The live entry point is `index.html`; use `assets/v3.css` and its shared `assets/base.css`.
- The owner explicitly requested discarding V1/V2 to reduce storage and clutter. Their pages, comparison links and archive-only assets have been removed. Do not recreate them unless asked.
- Keep the current look: fixed navigation, moving dotted underline, English/Traditional Chinese switch, light/dark themes, circular portrait and print-style Chinese name.
- Active pages: About, Projects, Education, Experience, Coffee, For Fun. Blog/Contact content is retained but disabled/hidden for now.
- No custom arrow-key/Home/End page shortcuts. Keep standard accessible links, keyboard focus and reduced-motion behavior. Map pointer clicks must not show native blue focus boxes; keep keyboard focus indicators.

## Files and workflows

- `assets/i18n.js`: curated Traditional Chinese translations; update when changing English text.
- `assets/journey-map.js`, `data/journey.json`, `assets/geography/`: Education journey. `npm run build:journey` regenerates geometry; do not infer new biography facts.
- `assets/coffee.js`, `coffee-admin.html`, `assets/coffee-admin.js`: public journal and single-entry editor.
- `server.mjs`, `lib/`: dependency-free Node server and café helpers.
- `data/runtime/`: git-ignored saved visits and possible secrets. **Do not delete, overwrite or expose these.** Practice data is separate from normal runtime data.
- `npm run practice`: local keyless editor, http://localhost:3000/coffee-admin.html; preview http://localhost:3000/.
- `npm test`: test suite. Also run `git diff --check` after changes.
- Deployment is prepared, not activated. Do not commit, push, deploy or create paid resources without authorization.

See `README.md` for full project structure, source credits, storage, deployment and return-to-work instructions. Changes are saved on disk; a fresh session should read this file and the README rather than assume it has the previous conversation.
