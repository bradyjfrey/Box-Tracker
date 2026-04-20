# Food Tracker — Project Context for Claude Code

This document hands off the Food Tracker project from a Claude.ai chat session
to Claude Code. Read this first before making changes. The repository is
named `Box-Tracker`; the app's display name is "Food Tracker" and it uses
`foodtracker` identifiers throughout the code. The repo was previously
called `Jumpstart-Tracker`; it was renamed to remove any derivation from
the JumpstartMD trademark.

---

## Project summary

Food Tracker is a single-purpose PWA: a daily portion tracker for the
JumpstartMD weight-loss program. It's installed to Brady's iPhone home
screen, runs offline, and stores all state locally. It's deployed to
Netlify from a GitHub repo, served at a subdomain or path under
bradyjfrey.com. JumpstartMD is referenced only in documentation (README,
CLAUDE.md); the live app does not mention it.

The app intentionally does almost nothing. It tracks "boxes" of portions
across four categories with a daily allocation:

- Protein: 12 boxes
- Veg Carbs: 3 boxes
- Fruit Carb: 1 box
- Fat: 3 boxes

Tap a box to fill it. The day resets at local midnight. Yesterday is
forgiven and forgotten (from the user's perspective; data is silently
preserved in localStorage but never surfaced).

---

## What this project deliberately is NOT

These are not missing features. They are explicit non-goals. Do not add
them without Brady asking:

- No food logging, calorie counting, or macro tracking
- No notifications, reminders, or nags
- No streaks, progress bars, weekly reports, or achievement systems
- No analytics
- No history UI (history is silently stored but not displayed; the design
  ethos is forgiveness, not surveillance)
- No reset button (midnight rollover handles it; manual reset would
  invite over-tracking)
- No import/export UI (data is in localStorage; advanced users can grab
  it via DevTools)

Note: cross-device sync is a goal, added after initial handoff. An earlier
version of this document listed "no server, no sync, no accounts" as
non-goals; that reflected a prior Claude session's assumptions, not
Brady's actual preferences. Sync is on.

Brady's working hypothesis: if the scale moves the right direction,
adherence is fine. If it doesn't, he knows to look at eating or exercise.
Box history would only matter for diagnosis at that point, and is
preserved silently for that hypothetical case.

---

## File structure

```
Box-Tracker/
├── index.html              App shell — semantic HTML, theme picker, sign-in btn
├── style.css               All three themes via CSS custom properties
├── app.js                  Categories, render, persist, theme, rollover, sync
├── manifest.json           PWA install metadata
├── service-worker.js       Cache-first offline support; skips /api/*
├── favicon.svg             Theme-aware browser tab icon (no PNG variants — iOS
│                           install will use generic icon, intentional)
├── netlify.toml            Cache headers + /api/* redirects to functions
├── package.json            Declares @netlify/blobs dependency
├── netlify/functions/
│   ├── _session.mjs        HMAC-SHA256 cookie sign/verify helpers
│   ├── auth-login.mjs      Starts GitHub OAuth flow
│   ├── auth-callback.mjs   Exchanges code, verifies allow-list, sets cookie
│   ├── auth-logout.mjs     Clears session cookie
│   └── day.mjs             GET/PUT today's state, backed by Netlify Blobs
├── README.md               User-facing documentation
├── LICENSE                 MIT
└── .gitignore
```

---

## Architecture decisions and the reasons behind them

### Themes are pure CSS tokens
Three themes (Swiss, Ration, Instrument) each have a light and dark pair.
All visual difference between themes lives in CSS custom properties,
declared in `style.css`. The data-theme attribute on the .app root selects
the family; data-mode (light/dark) selects the variant. JS only flips
those two attributes.

Why: zero runtime cost, easy to add a fourth theme by adding one block of
tokens, themes can never desync from the rest of the UI.

### The three themes are distinct design languages, not just palettes
Swiss = Inter throughout, white background, structured.
Ration = Fraunces serif, warm cream paper, italic notes, thicker box
borders, AVOID styled as a cream card with amber left bar.
Instrument = Fraunces serif title, JetBrains Mono numerals/portions,
rounded boxes with lifted background, blue counter, AVOID with amber
tint and outline.

Each theme overrides typography, stroke weights, AVOID treatment, and
counter colors via tokens. Layout, density, and structure are constant.

### State model
- localStorage key per day: `foodtracker.day.YYYY-MM-DD` → JSON of
  `{ state: { protein: [...], veg: [...], ... }, updatedAt: ISO string }`.
  Legacy records (no `updatedAt`) are still readable and treated as
  epoch-old for sync-merge purposes.
- localStorage key for theme: `foodtracker.theme` → 'swiss' | 'ration' |
  'instrument'.
- localStorage key for dark-mode override: `foodtracker.mode` → 'light' |
  'dark' | (missing). If the key is absent, mode follows
  `prefers-color-scheme`. Tapping the moon icon in the header sets and
  persists the override; once set, system changes stop affecting the app
  until the key is cleared manually (DevTools → Application → Local
  Storage).

### Cross-device sync
- Auth: GitHub OAuth via Netlify Functions. User clicks "Sign in with
  GitHub" (the upload icon in the header, shown only when sync is
  unauthorized), goes through the OAuth round-trip at
  `/api/auth/login` → `/api/auth/callback`. Callback verifies the
  returned GitHub numeric id matches `ALLOWED_GITHUB_USER_ID` (single-
  user allow-list) and sets a signed httpOnly cookie (`ft_session`,
  30-day TTL). `/api/auth/logout` clears it. Cookie is HMAC-SHA256
  signed with `SESSION_SECRET`; no JWT library.
- Storage: Netlify Blobs, store name `days`, key `${uid}/${date}`,
  value `{ state, updatedAt }`.
- Conflict rule: last-write-wins per day on `updatedAt`. PUT returns
  409 with the server record when the server is newer; client adopts.
- Sync is best-effort: offline / network errors are swallowed; the app
  always works locally. Sync pulls on load and on each
  rollover/focus/visibility tick (once a minute max), and pushes
  debounced 400ms after each toggle.
- Service worker MUST skip `/api/*` — those responses are never cached.

### Required Netlify env vars
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `ALLOWED_GITHUB_USER_ID` — Brady's numeric GitHub id (`curl
  https://api.github.com/users/<username>` → `"id"`)
- `SESSION_SECRET` — 32+ byte random hex (`openssl rand -hex 32`)
- `URL` is provided by Netlify automatically; used to build the
  OAuth redirect URI at runtime so it matches the deployed origin.

### Midnight rollover
Triggered on three signals: window focus, document visibilitychange,
and a 60-second polling interval. The function checks if the YYYY-MM-DD
key has changed; if so, swaps to the new day's state (which will be
empty unless the user already opened the app today on this device).

### Service worker
Cache-first strategy. CACHE_VERSION constant in service-worker.js must
be bumped on every code deployment, otherwise users keep seeing the old
version forever. This is the #1 most common PWA gotcha; do not forget.

### Why no apple-touch-icon
Brady explicitly opted out of PNG icons. The favicon.svg works for
browser tabs and the manifest. iOS home screen install will show a
generic gray fallback, which Brady accepted. An `icons/` directory with
180/192/512 PNG variants was added speculatively at one point and then
deleted at Brady's request; don't re-add it unless asked.

---

## Brady's preferences (apply automatically)

- Direct and efficient communication; clarifying questions when needed
- Contractions are fine
- Serial commas (Oxford)
- Semi-colons preferred over em dashes; never use em dashes
- Chicago Manual of Style for any prose
- Cite sources when making claims about external information
- Brady codes Python (mid-level) and HTML/CSS/JS (expert HTML/CSS,
  mid JS); explain JS choices when non-obvious
- Brady has deuteranopia (red-green colorblindness); all visual outputs
  must use deuteranopia-safe palettes (blues, oranges, grays); never
  rely on red/green to convey signal. Current palettes are compliant;
  preserve this when changing colors.

---

## Customization expected to happen

If the JumpstartMD prescription changes, edit the `CATEGORIES` array at
the top of `app.js`. That's the single source of truth for daily
allocations, names, and portion text. The UI rebuilds from this array.

---

## Deployment workflow

1. `git push` to the main branch on GitHub
2. Netlify auto-deploys on push. Static files publish from root; Netlify
   installs `@netlify/blobs` and bundles `netlify/functions/` automatically.
3. Bump `CACHE_VERSION` in `service-worker.js` if any client code changed,
   otherwise users won't get updates.
4. If you change env-var names or the GitHub OAuth app's callback URL,
   update both in the Netlify dashboard and GitHub's OAuth App settings.

---

## Likely future change requests, in rough order of probability

1. Tune the existing themes after Brady lives with them on his phone
2. Adjust box sizing or tap target if mis-taps happen
3. Add a fourth theme (architecture supports this trivially)
4. Surface history if Brady eventually wants it (deliberately not built)
5. Add fluid tracking as a fifth category (was discussed and skipped)
6. iOS home screen icon (was discussed and skipped, may revisit)

For (4), the data is already being stored. A history view is a JS-only
addition; no schema migration needed.

---

## How to test changes

There's no test suite. For the static app (UI, theming, rollover), a
plain HTTP server is enough:

```bash
python3 -m http.server 8000
# open http://localhost:8000 in a browser
```

Open via http://, not file://. The service worker and
prefers-color-scheme detection both require a real origin.

For anything touching `/api/*` (auth or sync), you need `netlify dev`
to run the functions locally:

```bash
npm install
npx netlify dev
```

This still won't complete the OAuth round-trip against production
GitHub unless you also register a second OAuth App for localhost, or
just test sync on a Netlify deploy preview. Easiest path for a change
that spans the API: push to a branch, let Netlify build a preview URL,
register that URL as a temporary callback in a dev OAuth App, test,
then merge.

For iPhone testing over HTTPS (required for PWA install and for the
session cookie's `Secure` flag), use a Netlify deploy preview URL —
the local-IP trick won't do.

---

## Open questions Brady has not yet decided

None at handoff. Spec is locked. Only iterate on:
- Visual refinement after real-world use
- Bugs encountered on actual iPhone
- Brady-initiated feature requests (not assumed future needs)

---

## Where to find the original design conversation

This project was designed in a multi-turn conversation on Claude.ai
covering: program research from the JumpstartMD PDF, prior-app pain
points, three competing aesthetic directions (ration card, dark
instrument, Swiss utility), iterative refinement of typography and
density, theme system architecture, and final packaging.

Brady can paste relevant excerpts or screenshots from that conversation
if you need historical context for a specific decision.
