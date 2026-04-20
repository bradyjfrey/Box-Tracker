/* =============================================================
   FOODTRACKER — App logic
   ============================================================= */

/* -------- CONFIG -------- */
// Daily allocation. Edit here if your prescription changes.
const CATEGORIES = [
  {
    key: 'protein',
    name: 'Protein',
    count: 12,
    portion: '1 oz meat / fish / seafood · 3 oz tofu · 4 oz yogurt · ¼ cup cottage cheese · 1 oz cheese'
  },
  {
    key: 'veg',
    name: 'Veg Carbs',
    count: 3,
    portion: '1 cup artichokes, broccoli, brussels sprouts, cauliflower, tomatoes.'
  },
  {
    key: 'fruit',
    name: 'Fruit Carb',
    count: 1,
    portion: '½ cup berries or cantaloupe · 1 small apple · 1 cup strawberries · ½ peach.'
  },
  {
    key: 'fat',
    name: 'Fat',
    count: 3,
    portion: '1 tbsp nut butter · 10 almonds · ½ avocado · 20 peanuts · 10 pecans · 6 walnuts.'
  }
];

const TOTAL = CATEGORIES.reduce((s, c) => s + c.count, 0);

const VALID_THEMES = ['swiss', 'ration', 'instrument'];
const DEFAULT_THEME = 'swiss';

const THEME_KEY    = 'foodtracker.theme';
const DAY_KEY      = (date) => `foodtracker.day.${date}`;

/* -------- STATE -------- */
// Today, as a YYYY-MM-DD string in local time
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// State shape: { protein: [0,1,0,...], veg: [...], ... }
function emptyState() {
  const s = {};
  for (const c of CATEGORIES) s[c.key] = new Array(c.count).fill(0);
  return s;
}

// Stored day record: { state, updatedAt } where updatedAt is an ISO string.
// Old records (pre-sync) were just the state object — we tolerate that shape
// on read by treating them as having an epoch updatedAt.
function loadDayRecord(dateKey) {
  try {
    const raw = localStorage.getItem(DAY_KEY(dateKey));
    if (!raw) return { state: emptyState(), updatedAt: '1970-01-01T00:00:00.000Z' };
    const parsed = JSON.parse(raw);

    // New shape
    if (parsed && parsed.state && typeof parsed.updatedAt === 'string') {
      return { state: normalizeState(parsed.state), updatedAt: parsed.updatedAt };
    }
    // Legacy shape: the whole object is the state
    return { state: normalizeState(parsed), updatedAt: '1970-01-01T00:00:00.000Z' };
  } catch (e) {
    return { state: emptyState(), updatedAt: '1970-01-01T00:00:00.000Z' };
  }
}

function normalizeState(raw) {
  const fresh = emptyState();
  if (!raw || typeof raw !== 'object') return fresh;
  for (const c of CATEGORIES) {
    if (Array.isArray(raw[c.key]) && raw[c.key].length === c.count) {
      fresh[c.key] = raw[c.key].map(v => v ? 1 : 0);
    }
  }
  return fresh;
}

function saveDayRecord(dateKey, state, updatedAt) {
  try {
    localStorage.setItem(DAY_KEY(dateKey), JSON.stringify({ state, updatedAt }));
  } catch (e) {
    // localStorage may be unavailable in private mode — fail silently
  }
}

/* -------- DOM REFS -------- */
const app           = document.getElementById('app');
const categoriesEl  = document.getElementById('categories');
const trigger       = document.getElementById('themeTrigger');
const menu          = document.getElementById('themeMenu');
const modeTrigger   = document.getElementById('modeTrigger');
const signInBtn     = document.getElementById('signInBtn');
const dateEl        = document.getElementById('dateText');
const remainingEl   = document.getElementById('remainingText');
const doneSumEl     = document.querySelector('.done-sum');
const denominatorEl = document.querySelector('.denominator');

const MODE_KEY = 'foodtracker.mode';

let currentDate   = todayKey();
let currentRecord = loadDayRecord(currentDate);

/* -------- RENDERING -------- */
function renderCategories() {
  // Build all categories. Box click handlers wired during construction.
  categoriesEl.innerHTML = '';
  for (const c of CATEGORIES) {
    const section = document.createElement('section');
    section.className = 'app-cat';
    section.dataset.cat = c.key;

    section.innerHTML = `
      <div class="app-cat-head">
        <div class="app-cat-name">${c.name}</div>
        <div class="app-cat-count">
          <span class="done">0</span><span class="total">/${c.count}</span>
        </div>
      </div>
      <div class="app-boxes"></div>
      <div class="app-portion">${c.portion}</div>
    `;

    const boxesEl = section.querySelector('.app-boxes');
    for (let i = 0; i < c.count; i++) {
      const b = document.createElement('button');
      b.className = 'app-box';
      b.type = 'button';
      b.setAttribute('aria-label', `${c.name} portion ${i + 1}`);
      b.dataset.cat = c.key;
      b.dataset.idx = String(i);
      b.addEventListener('click', () => toggleBox(c.key, i, b));
      boxesEl.appendChild(b);
    }
    categoriesEl.appendChild(section);
  }
  applyState();
}

function applyState() {
  // Reflect currentRecord.state into DOM
  for (const c of CATEGORIES) {
    const arr = currentRecord.state[c.key];
    const section = categoriesEl.querySelector(`[data-cat="${c.key}"]`);
    const boxes = section.querySelectorAll('.app-box');
    boxes.forEach((b, i) => {
      if (arr[i]) b.classList.add('checked'); else b.classList.remove('checked');
    });
    section.querySelector('.app-cat-count .done').textContent = arr.filter(v => v).length;
  }
  updateTotals();
}

function updateTotals() {
  let done = 0;
  for (const c of CATEGORIES) done += currentRecord.state[c.key].filter(v => v).length;
  doneSumEl.textContent = done;
  denominatorEl.textContent = TOTAL;
  remainingEl.textContent = `${TOTAL - done} remaining`;
}

function toggleBox(catKey, idx, btn) {
  currentRecord.state[catKey][idx] = currentRecord.state[catKey][idx] ? 0 : 1;
  currentRecord.updatedAt = new Date().toISOString();
  btn.classList.toggle('checked');
  const section = categoriesEl.querySelector(`[data-cat="${catKey}"]`);
  section.querySelector('.app-cat-count .done').textContent =
    currentRecord.state[catKey].filter(v => v).length;
  updateTotals();
  saveDayRecord(currentDate, currentRecord.state, currentRecord.updatedAt);
  schedulePush();
}

/* -------- DATE / MIDNIGHT ROLLOVER -------- */
function renderDate() {
  // Format: "Mon 20 Apr 2026" — readable, no comma clutter
  const d = new Date();
  const opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  dateEl.textContent = d.toLocaleDateString(undefined, opts);
}

function checkRollover() {
  // Cheap to call on focus / interval; only acts if the date has changed.
  const newDate = todayKey();
  if (newDate !== currentDate) {
    currentDate = newDate;
    currentRecord = loadDayRecord(currentDate);  // fresh state for the new day
    renderDate();
    applyState();
  }
  // Also a sync opportunity — pull in case another device touched today.
  pullToday();
}

// Rollover triggers: on focus (returning to PWA), on visibilitychange, and a
// belt-and-suspenders interval every minute while the app is open. These also
// drive sync pulls.
window.addEventListener('focus', checkRollover);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkRollover();
});
setInterval(checkRollover, 60 * 1000);

/* -------- THEME -------- */
function getSavedTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return VALID_THEMES.includes(v) ? v : DEFAULT_THEME;
  } catch (e) {
    return DEFAULT_THEME;
  }
}
function setTheme(name) {
  if (!VALID_THEMES.includes(name)) return;
  app.setAttribute('data-theme', name);
  try { localStorage.setItem(THEME_KEY, name); } catch (e) {}
  menu.querySelectorAll('[data-theme-pick]').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.themePick === name);
  });
}

menu.querySelectorAll('[data-theme-pick]').forEach(btn => {
  btn.addEventListener('click', () => {
    setTheme(btn.dataset.themePick);
    closeMenu();
  });
});

function openMenu() {
  menu.setAttribute('data-open', 'true');
  trigger.setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  menu.setAttribute('data-open', 'false');
  trigger.setAttribute('aria-expanded', 'false');
}
trigger.addEventListener('click', (e) => {
  e.stopPropagation();
  if (menu.getAttribute('data-open') === 'true') closeMenu();
  else openMenu();
});
document.addEventListener('click', (e) => {
  if (!menu.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
    closeMenu();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenu();
});

/* -------- LIGHT / DARK MODE --------
   Initial mode comes from saved override if present, else system preference.
   Tapping the moon sets and persists an override; system changes then stop
   affecting the app until the override is cleared (via DevTools). */
const mql = window.matchMedia('(prefers-color-scheme: dark)');

function getSavedMode() {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch (e) {}
  return null;
}

function setMode(mode) {
  app.setAttribute('data-mode', mode);
  modeTrigger.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
}

setMode(getSavedMode() || (mql.matches ? 'dark' : 'light'));

mql.addEventListener('change', e => {
  if (getSavedMode()) return;
  setMode(e.matches ? 'dark' : 'light');
});

modeTrigger.addEventListener('click', () => {
  const next = app.getAttribute('data-mode') === 'dark' ? 'light' : 'dark';
  setMode(next);
  try { localStorage.setItem(MODE_KEY, next); } catch (e) {}
});

/* -------- SYNC --------
   Cross-device sync via /api/day. Auth is a session cookie set by the
   GitHub OAuth flow at /api/auth/*. Conflict rule: last-write-wins per day
   on updatedAt. Sync is best-effort; the app always works locally.

   Triggers:
   - pullToday() on load and on focus/visibility (via checkRollover).
   - pushToday() debounced after each toggle. */

let pushTimer = null;
let pushInFlight = false;
let pendingPush = false;

function showSignIn(show) {
  if (!signInBtn) return;
  signInBtn.hidden = !show;
}

async function pullToday() {
  try {
    const res = await fetch(`/api/day?date=${currentDate}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });

    if (res.status === 401) {
      showSignIn(true);
      return;
    }
    showSignIn(false);

    if (res.status === 404) {
      // Server has nothing for today — push whatever we have locally.
      if (anyChecked(currentRecord.state)) schedulePush(true);
      return;
    }
    if (!res.ok) return;

    const server = await res.json();
    if (!server || !server.state || !server.updatedAt) return;

    if (server.updatedAt > currentRecord.updatedAt) {
      currentRecord = { state: normalizeState(server.state), updatedAt: server.updatedAt };
      saveDayRecord(currentDate, currentRecord.state, currentRecord.updatedAt);
      applyState();
    } else if (server.updatedAt < currentRecord.updatedAt) {
      // Local is newer — push it up.
      schedulePush(true);
    }
  } catch {
    // Offline or network hiccup — stay quiet; local state is still correct.
  }
}

function schedulePush(immediate = false) {
  clearTimeout(pushTimer);
  if (immediate) {
    pushToday();
  } else {
    pushTimer = setTimeout(pushToday, 400);
  }
}

async function pushToday() {
  if (pushInFlight) {
    pendingPush = true;
    return;
  }
  pushInFlight = true;
  try {
    const body = JSON.stringify({ state: currentRecord.state, updatedAt: currentRecord.updatedAt });
    const res = await fetch(`/api/day?date=${currentDate}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    if (res.status === 401) {
      showSignIn(true);
      return;
    }
    showSignIn(false);

    if (res.status === 409) {
      // Server is newer — adopt it.
      const server = await res.json();
      if (server && server.state && server.updatedAt) {
        currentRecord = { state: normalizeState(server.state), updatedAt: server.updatedAt };
        saveDayRecord(currentDate, currentRecord.state, currentRecord.updatedAt);
        applyState();
      }
    }
  } catch {
    // Network error — retry on next interaction or rollover tick.
  } finally {
    pushInFlight = false;
    if (pendingPush) {
      pendingPush = false;
      schedulePush();
    }
  }
}

function anyChecked(state) {
  for (const c of CATEGORIES) {
    if (state[c.key].some(v => v)) return true;
  }
  return false;
}

if (signInBtn) {
  signInBtn.addEventListener('click', () => {
    window.location.href = '/api/auth/login';
  });
}

/* -------- INITIAL RENDER -------- */
renderDate();
renderCategories();
setTheme(getSavedTheme());
pullToday();

/* -------- SERVICE WORKER (offline cache) -------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // service worker registration failed — non-fatal, app still works online
    });
  });
}
