# Box-Tracker
Jumpstart’s health program has a poor software tracking system, and competitors have a similar issue: excessive input and distraction. I want less cognitive load, and more daily recording of boxes. Currently the app resets in 24 hours: no history, just forgiveness. Every day is a new day.

A daily portion tracker for the JumpstartMD program. Mobile-first PWA, installable on iPhone home screen, works offline, no accounts, no analytics, no nagging.

> This is a personal tracking tool. It is not medical advice and is not affiliated with JumpstartMD.

## What it does

Tracks your daily box allocation across four categories:
- Protein (12 boxes)
- Veg Carbs (3 boxes)
- Fruit Carb (1 box)
- Fat (3 boxes)

Tap a box to fill it. Tap again to undo. The app forgives missed days and resets at midnight on its own.

## What it deliberately does not do

- Log specific foods, calories, or macros
- Send notifications
- Show streaks, progress charts, or weekly reports
- Sync to a server (your data stays on your device)
- Guilt you about anything

## Themes

Three full design languages, switchable from the icon at the top right of the app:
- **Swiss** — Inter sans, white background, structured and neutral
- **Ration** — Fraunces serif, warm cream paper, friendly and analog
- **Instrument** — Fraunces title with mono numerals, dark cool background, technical and precise

Each theme has matching light and dark modes. By default, light/dark follows your system preference; tap the moon icon in the header to override.

## Customization

Edit `app.js` to change your daily allocation. The `CATEGORIES` constant at the top is the only thing you need to touch:

```js
const CATEGORIES = [
  { key: 'protein', name: 'Protein', count: 12, portion: '...' },
  { key: 'veg',     name: 'Veg Carbs', count: 3, portion: '...' },
  // etc.
];
```

If your prescription changes the totals, update the `count` values. If you want to rename a category or change the portion reference, edit `name` or `portion`. The UI rebuilds automatically.

## Deploy

This repo is set up to deploy directly to Netlify with no build step.

1. Push to GitHub.
2. In Netlify: New site from Git, point at this repo. No build command, publish directory is `.` (root).
3. Optionally set up a subdomain or path under your existing site.

`netlify.toml` handles correct cache headers so the service worker can update cleanly.

To install on iPhone after the site is live: open in Safari, tap Share, tap "Add to Home Screen."

## Updating after deploy

When you change CSS or JS, bump the `CACHE_VERSION` constant in `service-worker.js` (e.g., `'foodtracker-v1'` → `'foodtracker-v2'`). This evicts the old cached files on next visit so users get your changes. Without bumping the version, browsers will keep serving the old files indefinitely.

## Data

State is stored in `localStorage` under keys like `foodtracker.day.2026-04-20`. Theme preference is at `foodtracker.theme`, and any manual dark-mode override at `foodtracker.mode`. There is no export UI; if you ever want your data, open DevTools → Application → Local Storage.

History is preserved silently (every day's final state is kept), but never surfaced in the UI by design. The point is forgiveness, not surveillance.

## License

MIT
