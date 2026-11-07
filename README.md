## Hello, I'm Chih Yu 🧋

<!--
**chihyu-tsai/chihyu-tsai** is a ✨ _special_ ✨ repository because its `README.md` (this file) appears on your GitHub profile.
Im currently
Here are some ideas to get you started:

[![Anurag's GitHub stats](https://github-readme-stats.vercel.app/api?username=chihyu-tsai)](https://github.com/anuraghazra/github-readme-stats)
[![Top Langs](https://github-readme-stats.vercel.app/api/top-langs/?username=chihyu-tsai)](https://github.com/anuraghazra/github-readme-stats)
- 🔭 I’m currently working on ...
- 🌱 I’m currently learning ...
- 👯 I’m looking to collaborate on ...
- 🤔 I’m looking for help with ...
- 💬 Ask me about ...
- 📫 How to reach me: ...
- 😄 Pronouns: ...
- ⚡ Fun fact: ...
-->

📚 I'm currently a second year MCIT student at the [University of Pennsylavania](https://www.upenn.edu/)<br/>
Currently I'm taking CIT 5950 - [Computer Systems Programming](https://www.seas.upenn.edu/~cit5950/current/) and CIS 5450 - Big Data Analytics

## Run the personal website and coffee map

**Design decision (November 7, 2026): keep the current V3 as the only maintained website.** The owner asked to discard V1/V2. Their HTML pages, comparison links and archive-only assets have been removed; do not restore them unless requested. `index.html` is V3. `assets/base.css` retains the shared layout that V3 needs (renamed from `assets/v2.css`); `assets/v3.css` contains the current design layer. This cleanup reduces disk clutter, not the AI conversation's memory. See `AGENTS.md` for the coding-session handoff.

Requires Node.js 20 or newer. No npm dependencies or Google account/API key are needed.

```sh
npm start
```

Open http://localhost:3000, then choose **Coffee**. Opening `index.html` directly still previews the portfolio, but the coffee API and editor require the running server. The journal starts empty rather than inventing café visits.

### Edit and publish cafés

#### Simplified local practice — no key

```sh
npm run practice
```

Open http://localhost:3000/coffee-admin.html. No password/key is required in this mode: paste a Google Maps link, import, confirm details, and publish. Watch http://localhost:3000/#coffee update automatically. Stop any existing server on port 3000 before starting practice mode.

Location entry uses linked **country → state/prefecture/region → city** dropdowns. Country choices load locally; choosing a country loads only that country's region/city names. Changing a parent clears its old children. Select **Other / enter manually…** for missing places or alternate local names. Editing older entries preserves values not present in the dataset instead of dropping them. Map imports do not automatically infer these administrative fields—confirm that they match the pin before publishing.

The public café list is an accordion: opening a country closes other countries, and opening Pennsylvania (or another region) closes other regions and countries. Selecting a café pin reveals its matching list branch. The active branch is retained when entries refresh.

Practice mode binds only to `127.0.0.1`, rejects remote/foreign-host and cross-origin edit requests, and cannot run with `NODE_ENV=production`. Entries are saved separately in the git-ignored `data/runtime/practice-coffees.json`. The normal `npm start` and deployed website still require an editor key. Do not expose practice mode through a tunnel or reverse proxy.

#### Local testing with a private key file

If `data/runtime/editor-key.txt` was created for your local preview, it is git-ignored and not served by the website. On macOS, copy it to your clipboard without printing it:

```sh
pbcopy < data/runtime/editor-key.txt
```

Open http://localhost:3000/coffee-admin.html and paste it into **Private editor key**. To restart an enabled local server later (first stop any existing server on port 3000):

```sh
COFFEE_ADMIN_TOKEN="$(cat data/runtime/editor-key.txt)" npm start
```

Publish a test café using the map or manual coordinates, then watch http://localhost:3000/#coffee in another tab. Delete the test entry afterward if you do not want it kept. Local entries are saved in `data/runtime/coffees.json`; they are not automatically uploaded to a future cloud deployment.

#### Set up a new key manually

1. Generate a private editor key:
   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```
2. Start the server with that key (replace the example; do not commit or share your real key):
   ```sh
   COFFEE_ADMIN_TOKEN='paste-your-generated-key-here' npm start
   ```
3. Visit http://localhost:3000/coffee-admin.html and paste the same key into the password field.
4. In **Start with a Google Maps link**, paste the Google Maps place/share link, leave the website blank, and click **Import café & find website**. This prefills the name and exact pin coordinates encoded in the URL, then tries to find a matching website from nearby OpenStreetMap records using the public Overpass API. It requires a matching café name and a location within 120 meters; ambiguous/missing results remain blank, never guessed. Supplying your own website skips the lookup. Review any suggested website before publishing. Google short links are expanded through an allowlist of Maps hosts; if expansion fails, open the link in a browser and copy the full Maps URL. A viewport `@lat,lng` is not an exact café pin and is deliberately not imported.
5. Review/enter the café name, country, optional state/prefecture/region and city, address, and notes; click **Publish café**. You can also choose a map pin or enter coordinates manually. The imported café website and Google Maps link are saved and shown as links to visitors. Use **Edit** or **Delete** to manage entries.

Visits are grouped by country → region → city, skipping blank levels. US/USA, Taiwan/台灣, and Japan/日本 aliases are grouped consistently. Existing entries without geographic fields stay visible under “Location not set” until edited. Import does not scrape Google reviews, business profiles, or the café website, and does not promise automatic address/country lookup. Website lookup sends café coordinates (never the editor key) to `overpass-api.de` and uses OpenStreetMap data with attribution. Open-data coverage varies; lookup failures do not prevent publishing without a website.

**The Coffee Editor is the single source of data entry.** Saving writes to the persistent café data file and sends a server-sent event to connected public pages, which fetch the new entries automatically—no commit or deployment is needed for each visit. Minute polling (paused while focus is in the list) and **Refresh cafés** provide fallbacks if event streaming is blocked. Hidden pages refresh when revisited. The key is held in page memory only, never public JavaScript or browser storage. Saved notes/coordinates/links are public; do not enter private information.

### Deployment and storage

This backend is **not deployed** by these changes. Deploy it to a Node-capable host with HTTPS and a persistent writable disk to let viewers see updates from anywhere. GitHub Pages alone cannot run this backend. Keep the editor secret in the hosting provider's environment/secret settings, not in this repository.

- Start command: `npm start`.
- Configure `HOST=0.0.0.0` on a hosted server; `PORT` defaults to `3000`.
- Configure `COFFEE_ADMIN_TOKEN` to a random secret of at least 24 characters. Without it, editing is disabled.
- Configure `COFFEE_DATA_FILE` to an absolute path on the host's persistent disk, e.g. `/var/data/coffees.json`. The default is `data/runtime/coffees.json`, which is git-ignored. Back up this file.
- Run **one server instance** with this JSON storage. Multiple replicas or serverless/ephemeral disks need a shared database instead. Redeploying without persistent storage can lose edits.
- Initial data comes from `data/coffees.json` only when no runtime data file exists.
- Serve behind an HTTPS reverse proxy; add host-level request/rate limits before exposing the editor publicly. Do not send the editor key over public plain HTTP.

### GitHub Actions → Render CI/CD (prepared, not activated)

The repository includes `.github/workflows/deploy.yml` and an optional `render.yaml` Blueprint. **Pushes save code and run tests only; they do not request deployment.** No cloud resources have been created or deployment activated by this work. Render's Starter service and persistent disk are paid resources; review pricing before approving the Blueprint.

1. Commit/push the site to the GitHub repository when ready. Pull requests and pushes to `main` run tests on Node 20 and 22 and check JavaScript syntax.
2. In Render, create a **Blueprint** from this repository and review/approve `render.yaml`. It configures a single Node service, persistent disk at `/var/data`, a generated `COFFEE_ADMIN_TOKEN`, and `/api/health` health checks. The initial service creation may deploy once; subsequent automatic Render Git deployments are disabled so GitHub CI controls deployments.
3. Copy the generated editor key from Render's private environment settings to your password manager. Use it only in the hosted `/coffee-admin.html` page. Never put it in GitHub source or this chat.
4. From the Render service's Settings, copy its **Deploy Hook URL**. Add it to GitHub → Settings → Secrets and variables → Actions as the repository secret `RENDER_DEPLOY_HOOK_URL`.
5. Only when you explicitly want to deploy, manually run the workflow on `main` and check its **deploy** input (off by default). Ordinary pushes, pull requests and manual runs without that option run tests only. With deployment explicitly enabled, only after both test jobs pass does GitHub request deployment of that **exact tested commit SHA**. Configure branch protection to require CI before merging. Add approvals to the GitHub `production` environment if desired.
6. The workflow reports whether Render accepted the asynchronous deploy request. Check Render for final deploy completion and health; acceptance is not proof the new version is live. If the secret is unset, CI still runs and explicitly reports deployment skipped.
7. Open the Render site URL and bookmark `/coffee-admin.html`. **All future café data edits happen there**, not in GitHub or the Render console. The mounted data file survives code redeployments; back it up separately from the repository.

Save workflow: `code push → tests only`. Optional deployment: `explicit manual deploy → tests → deploy request → Render health check`. Content workflow: `Coffee Editor → persistent data → live visitor update`. These are intentionally separate pipelines. For another hosting provider, replace only the deployment step; the editor/API can stay unchanged.

### Project structure

```text
index.html               V3 public website (the only retained design)
coffee-admin.html        Café editor
AGENTS.md                Project decisions and coding-session handoff
README.md                Setup, architecture, sources and return instructions
package.json             Node scripts; no npm dependencies
server.mjs               Static-file server, café API, authentication and events
assets/
  base.css               Shared layout, colors and typography
  v3.css                 Current V3 design and responsive overrides
  navigation.js          Page navigation, focus and moving dotted underline
  i18n.js                English / Traditional Chinese interface
  journey-map.js         Interactive Education SVG map
  coffee.js, coffee.css  Public café map and grouped list
  coffee-admin.js        Editor interface and saving
  maps.js                Shared MapLibre helpers
  coffee-groups.js       Country aliases and country/region/city grouping
  country-flag.js        Country flag generation
  location-picker.js     Cascading location dropdowns
  geography/             Generated journey geometry, credits and license
  locations/             Local global country/region/city data and license
  logos/, portraits/     School/team logos and cropped portrait
  favicon files          Browser and touch icons
data/
  coffees.json           Initial café data
  journey.json           Four Education/life stages
  runtime/               Saved local visits/keys; git-ignored, never discard
lib/                     Google Maps-link parsing and café website lookup
scripts/                 Practice launcher, data/map generation and deployment
tests/                   Node test suite
.github/workflows/       Prepared test/deployment automation
render.yaml              Optional Render deployment configuration
```

The frontend is plain HTML/CSS/JavaScript, not React or a bundled application. Node serves the files and café API. Geometry and location reference data are local; the interactive Coffee basemap uses external map providers.

### Returning to this project

All edits are saved to local files. You may close OpenCode/the terminal when work is idle; the changes do not require the chat window to stay open. **Local files and local commits are not a remote backup:** use `git status` to check for uncommitted work and unpushed commits. Push only after reviewing and approving the changes. Café runtime data is deliberately git-ignored; back it up separately from the repository. Design cleanup does not activate deployment.

From the project directory, resume the latest OpenCode session:

```sh
cd "/Users/chihyutsai/personal website/chihyu-tsai"
opencode --continue
```

Plain `opencode` opens the project but does not guarantee this conversation is selected. Use `/sessions` to choose this conversation if another session opens. A fresh session should read `AGENTS.md` and this README; it does not automatically have the previous conversation's full context.

For a complete browser preview (including language switching and maps), run this in a separate terminal tab if the server is no longer running:

```sh
cd "/Users/chihyutsai/personal website/chihyu-tsai"
npm run practice
```

Open http://localhost:3000/. Opening `index.html` directly is still the V3 source, but `file://` cannot provide the server API and may block JavaScript module/JSON loading. Closing a terminal may stop its preview server; saved files and visits remain. Do not start a second server on port 3000 if the existing preview is still available.

### Design baseline

- **V3 (chosen and retained):** `index.html` / http://localhost:3000 — the open, text-led layout with a circular portrait, print-style Chinese name, theme-aware logos, Education journey map, Coffee atlas and For Fun page. Navigation keeps every tab in a fixed order/size and animates a dotted underline, with page headings updating separately. Its design layer is `assets/v3.css`, importing `assets/base.css`.
- V1/V2 pages and archived transitions/styles have been discarded at the owner's request. There are no old-version links. Keep V3 as the baseline for future changes, rather than recreating multiple designs.
- The site includes the Berkeley scholarship distinction and project titles from the supplied résumé.
- V3 shows `chihyutsai AT alumni DOT upenn DOT edu` in About and Contact, both with the correct clickable `mailto:` link. Obfuscation is a display format, not a promise of spam protection. Browser/touch favicons are cropped/resized from the orange CT image supplied by the site owner.

### Maps and page turns

V3 has a keyboard-accessible **繁 / EN** language switch beside the theme control. It switches between English and Traditional Chinese, updates the document language and accessible labels, and remembers the selection in local storage when available. English remains the default without JavaScript. Translations live in `assets/i18n.js`; local text-node updates preserve links, icons, current navigation, selected journey stages, theme, and café data. Asynchronous journey and Coffee UI messages are localized too. Café names, addresses, notes, technical identifiers and brand names retain their original text; this is curated interface translation, not an external machine-translation service. The café editor remains English-only.

V3’s Education page includes a custom Pacific-centered journey: Kaohsiung (born and raised) → Tainan (National Tainan First Senior High School / 台南一中, supplied by the owner) → Bay Area (undergraduate) → Philadelphia (graduate). A Taiwan inset separates the first two stops; four native buttons highlight each stage, with a live text description. Map dots and labels also act as keyboard-accessible buttons: selecting one focuses its phase below and brings the description into view, respecting reduced motion. The world-scale Taiwan dot selects the Kaohsiung origin; the inset gives each Taiwanese city its own control. The text stays available if the optional map cannot load. Coordinates are approximate city centers and connecting curves are illustrative, not recorded travel routes. No high-school dates are inferred.

About uses `@` before Penn and UC Berkeley in the education sentence, with small inline school logos; email displays retain uppercase `AT`/`DOT`. The Chinese name is enlarged while retaining its print-style serif font. The Education caption uses “economics → computer science” (also an arrow in Chinese). The portrait crop shifts the person slightly right to center the face. Coffee’s sidebar is titled “Cafés I’ve visited,” without the former location instruction line. V3 prepends decorative country-flag emoji using the bundled global ISO country list; unknown locations do not receive an invented flag. Saved café records are unchanged by design cleanup.

Navigation uses ordinary links with standard Tab/Enter keyboard access and browser history. There are no custom arrow-key or Home/End page shortcuts.

V3’s **For Fun** page shares the owner's tennis, pickleball and badminton interests, love of watching sports, and favorite teams in a horizontal logo row (two columns on mobile): Oakland A’s, San Francisco Giants, Golden State Warriors and San Francisco 49ers. Each team has a small transparent inline logo (emoji-like sizing), bundled locally; original sources and rights notes are in `assets/logos/TEAM-SOURCES.txt` and the footer credits. The Oakland name is intentional. English and Traditional Chinese are supported. Blog and Contact markup is retained for later but marked `data-page-disabled="true" hidden`, omitted from navigation, and excluded from page routing; old hashes fall back to About. Contact links remain available in About.

The map uses public-domain [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) geography, with a custom SVG renderer inspired by the techniques in [D3’s geographic guide](https://www.d3indepth.com/geographic/), not a copied map design. All map geometry is served locally from `assets/geography/education-journey.json`; there is no runtime D3 or map-service dependency. To regenerate it, edit `data/journey.json` and run `npm run build:journey` (requires internet at build time). The generator pins the Natural Earth revision and verifies the D3 7.9.0 build-tool checksum; attribution and the D3 license are bundled alongside the geometry.

V3 uses Noto Serif TC for the Chinese name, with Songti TC/PMingLiU fallbacks. Its About portrait is a circular crop of the owner-supplied photo, exported as a 720px JPEG without the original EXIF metadata; the original HEIC is untouched and not bundled. V3 logo containers are transparent, with locally generated transparent/light-lettering MDM display variants for light/dark themes. The original owner-supplied logo remains as a source asset. These are display adaptations, not official alternate brand marks.

Location dropdown names are derived from [Countries States Cities Database](https://github.com/dr5hn/countries-states-cities-database) by dr5hn and contributors, under ODbL 1.0. The country-split derived data, complete license, source revision, and modification notice are in `assets/locations/`. This is community-maintained global reference data, not scraped USPS data or an official address validation system. Administrative levels and completeness vary; manual overrides are intentionally supported. Regenerate the pinned snapshot with `npm run update:locations` (downloads the source database once); normal editor use makes no third-party location-list requests.

Maps use [MapLibre GL JS 5.6.2](https://maplibre.org/) (BSD-3-Clause, loaded from unpkg) and [OpenFreeMap’s Positron vector style](https://openfreemap.org/quick_start/), with OpenMapTiles/OpenStreetMap attribution supplied by the map style. No Google account, API key, or device geolocation is used. These providers receive normal map/CDN requests; [OpenFreeMap’s terms](https://openfreemap.org/tos/) apply. A WebGL-capable browser and internet connection are needed for the map; the grouped café list works if the map cannot initialize. On desktop the list is to the right; on narrow screens it stacks below the map.

V3 has **no paper/tear animation**: tabs never move or change size; a dotted underline follows the active tab, and the page heading/content updates independently with a brief fade. Underline placement is recalculated after font loading and viewport changes, including wrapped mobile rows. Reduced-motion users get an immediate switch. Hash links, Back/Forward, keyboard focus, and rapid switching remain supported. Coffee has the same maximum width as other pages. Blog remains a reserved placeholder, currently hidden, not a publishing system.

### Tests

```sh
npm test
```
