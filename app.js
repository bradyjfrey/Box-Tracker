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

function loadDayState(dateKey) {
  try {
    const raw = localStorage.getItem(DAY_KEY(dateKey));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    // Validate shape; reset if mismatched (e.g., schema changed)
    const fresh = emptyState();
    for (const c of CATEGORIES) {
      if (Array.isArray(parsed[c.key]) && parsed[c.key].length === c.count) {
        fresh[c.key] = parsed[c.key].map(v => v ? 1 : 0);
      }
    }
    return fresh;
  } catch (e) {
    return emptyState();
  }
}

function saveDayState(dateKey, state) {
  try {
    localStorage.setItem(DAY_KEY(dateKey), JSON.stringify(state));
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
const dateEl        = document.getElementById('dateText');
const remainingEl   = document.getElementById('remainingText');
const doneSumEl     = document.querySelector('.done-sum');
const denominatorEl = document.querySelector('.denominator');

const MODE_KEY = 'foodtracker.mode';

let currentDate  = todayKey();
let currentState = loadDayState(currentDate);

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
  // Reflect currentState into DOM
  for (const c of CATEGORIES) {
    const arr = currentState[c.key];
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
  for (const c of CATEGORIES) done += currentState[c.key].filter(v => v).length;
  doneSumEl.textContent = done;
  denominatorEl.textContent = TOTAL;
  remainingEl.textContent = `${TOTAL - done} remaining`;
}

function toggleBox(catKey, idx, btn) {
  currentState[catKey][idx] = currentState[catKey][idx] ? 0 : 1;
  btn.classList.toggle('checked');
  // update just this category's count + global
  const section = categoriesEl.querySelector(`[data-cat="${catKey}"]`);
  section.querySelector('.app-cat-count .done').textContent =
    currentState[catKey].filter(v => v).length;
  updateTotals();
  saveDayState(currentDate, currentState);
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
    currentState = loadDayState(currentDate);  // fresh state for the new day
    renderDate();
    applyState();
  }
}

// Rollover triggers: on focus (returning to PWA), on visibilitychange, and a
// belt-and-suspenders interval every minute while the app is open.
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

/* -------- INITIAL RENDER -------- */
renderDate();
renderCategories();
setTheme(getSavedTheme());

/* -------- SERVICE WORKER (offline cache) -------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // service worker registration failed — non-fatal, app still works online
    });
  });
}
