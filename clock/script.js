'use strict';
// ===== palette: only two colours =====
const Y = '#ffe21a', K = '#000000', TAU = Math.PI * 2;
const pad = (n, l = 2) => String(n).padStart(l, '0');
const DEF = { inv: false, h24: true, smooth: true, roman: false, sound: true, tab: 'world', alarms: [] };
const S = Object.assign({}, DEF);
try { Object.assign(S, JSON.parse(localStorage.getItem('chrono') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('chrono', JSON.stringify(S)); } catch (e) {} };

// ===== tiny DOM builder =====
function h(tag, o = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in o) {
    if (k === 'style') Object.assign(e.style, o[k]);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), o[k]);
    else if (k in e) e[k] = o[k];
    else e.setAttribute(k, o[k]);
  }
  for (const c of kids.flat()) e.append(c);
  return e;
}

// ===== styling, written entirely in JS =====
const RULES = {
  '*': { boxSizing: 'border-box' },
  'html,body': { margin: 0, minHeight: '100%' },
  body: {
    background: 'var(--bg)', color: 'var(--fg)',
    font: '15px/1.45 "Space Grotesk",system-ui,sans-serif',
    paddingTop: 'env(safe-area-inset-top,0px)',
    paddingBottom: 'env(safe-area-inset-bottom,0px)',
  },
  '.app': {
    display: 'grid', gridTemplateColumns: 'minmax(300px,1fr) minmax(320px,1fr)',
    gap: '28px', maxWidth: '1180px', margin: '0 auto', padding: '24px',
  },
  '@media (max-width:820px)': '.app{grid-template-columns:1fr;padding:14px}',
  '.left': { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' },
  canvas: { width: '100%', maxWidth: '560px', aspectRatio: '1', display: 'block' },
  '.digital': { textAlign: 'center', width: '100%' },
  '.big': {
    fontFamily: '"Space Mono",ui-monospace,monospace', fontWeight: 700,
    fontSize: 'clamp(40px,9vw,76px)', letterSpacing: '-0.04em', lineHeight: 1,
  },
  '.big small': { fontSize: '0.38em', marginLeft: '8px', letterSpacing: 0 },
  '.date': { fontSize: '18px', marginTop: '8px' },
  '.meta': { opacity: 0.7, fontSize: '13px', marginTop: '4px' },
  '.tabs': { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' },
  button: {
    font: 'inherit', color: 'var(--fg)', background: 'transparent', cursor: 'pointer',
    border: '2px solid var(--fg)', borderRadius: '999px', padding: '7px 16px',
  },
  'button:hover,button.on': { background: 'var(--fg)', color: 'var(--bg)' },
  'button:focus-visible,input:focus-visible,select:focus-visible': { outline: '3px dashed var(--fg)', outlineOffset: '3px' },
  input: {
    font: 'inherit', color: 'var(--fg)', background: 'var(--bg)', colorScheme: 'dark',
    border: '2px solid var(--fg)', borderRadius: '10px', padding: '7px 10px', width: '110px',
  },
  '.panel': { border: '2px solid var(--fg)', borderRadius: '22px', padding: '20px', minHeight: '420px' },
  '.row': {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid color-mix(in srgb,var(--fg) 30%,transparent)',
  },
  '.row:last-child': { borderBottom: 0 },
  '.mono': { fontFamily: '"Space Mono",ui-monospace,monospace', fontVariantNumeric: 'tabular-nums' },
  '.huge': { fontSize: 'clamp(34px,7vw,56px)', fontWeight: 700, textAlign: 'center', margin: '8px 0 16px' },
  '.btns': { display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', margin: '10px 0' },
  '.bar': { height: '12px', border: '2px solid var(--fg)', borderRadius: '8px', overflow: 'hidden', margin: '5px 0 12px' },
  '.bar i': { display: 'block', height: '100%', background: 'var(--fg)' },
  '.cal': { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', textAlign: 'center', margin: '12px 0' },
  '.cal b': { opacity: 0.6, fontWeight: 400, fontSize: '12px' },
  '.cal span': { padding: '6px 0', borderRadius: '8px' },
  '.cal span.today': { background: 'var(--fg)', color: 'var(--bg)', fontWeight: 700 },
  '.dot': { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--fg)', marginRight: '8px' },
  '.dot.day': { background: 'var(--fg)' },
  '.ring': {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9, textAlign: 'center',
    background: 'var(--fg)', color: 'var(--bg)', padding: 'calc(14px + env(safe-area-inset-top,0px)) 14px 14px',
    fontWeight: 700, display: 'none',
  },
  '.ring button': { color: 'var(--bg)', borderColor: 'var(--bg)', margin: '0 4px' },
  '.ring button:hover': { background: 'var(--bg)', color: 'var(--fg)' },
  '.ring.go': { display: 'block', animation: 'flash 0.8s steps(2) infinite' },
  '@keyframes flash': '50%{background:var(--bg);color:var(--fg)}',
  '@media (prefers-reduced-motion:reduce)': '.ring.go{animation:none}',
};
function buildCSS() {
  const kebab = s => s.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
  let out = '@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=Space+Mono:wght@400;700&display=swap");';
  for (const sel in RULES) {
    const v = RULES[sel];
    if (typeof v === 'string') { out += sel + '{' + v + '}'; continue; }
    out += sel + '{';
    for (const p in v) out += kebab(p) + ':' + v[p] + ';';
    out += '}';
  }
  return out;
}
document.head.append(h('style', { textContent: buildCSS() }));
function applyTheme() {
  const r = document.documentElement.style;
  r.setProperty('--fg', S.inv ? K : Y);
  r.setProperty('--bg', S.inv ? Y : K);
  r.colorScheme = 'dark';
}
applyTheme();

// ===== sound =====
let actx = null;
function beep(freq = 880, dur = 0.15) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch (e) {}
}

// ===== astronomy and calendar helpers =====
const SYN = 29.530588853, REF = Date.UTC(2000, 0, 6, 18, 14);
const moonPhase = d => (((d - REF) / 864e5 / SYN) % 1 + 1) % 1;
const MOONS = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
const moonName = p => MOONS[Math.floor(p * 8 + 0.5) % 8];
const illum = p => (1 - Math.cos(p * TAU)) / 2;
const isoWeek = d => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
};
const dayOfYear = d => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

// ===== layout =====
const cv = h('canvas', { role: 'img', 'aria-label': 'Analog clock with moon phase and sub-dials' });
const bigEl = h('div', { className: 'big mono' });
const dateEl = h('div', { className: 'date' });
const metaEl = h('div', { className: 'meta' });
const ring = h('div', { className: 'ring', role: 'alert' });
const tabsEl = h('div', { className: 'tabs', role: 'tablist' });
const panel = h('div', { className: 'panel' });
document.body.append(ring, h('div', { className: 'app' },
  h('div', { className: 'left' }, cv, h('div', { className: 'digital' }, bigEl, dateEl, metaEl)),
  h('div', { className: 'right' }, tabsEl, panel)));
const ctx = cv.getContext('2d');
let Z = 560, dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  Z = Math.max(260, Math.floor(cv.getBoundingClientRect().width));
  cv.width = Z * dpr; cv.height = Z * dpr;
}
window.addEventListener('resize', resize);

// ===== analog drawing =====
function pt(cx, cy, r, a) { return [cx + Math.cos(a - Math.PI / 2) * r, cy + Math.sin(a - Math.PI / 2) * r]; }
function line(c, x1, y1, x2, y2, w) {
  c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
function label(c, t, x, y, size, bold) {
  c.font = (bold ? '700 ' : '400 ') + size + 'px "Space Mono",monospace';
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x, y);
}
function subdial(c, cx, cy, r, n, labels, val, fg, bg) {
  c.strokeStyle = fg; c.fillStyle = fg;
  c.lineWidth = r * 0.05; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, p1 = pt(cx, cy, r * 0.88, a), p2 = pt(cx, cy, r * 0.74, a);
    line(c, p1[0], p1[1], p2[0], p2[1], r * 0.03);
  }
  labels.forEach(([i, t]) => { const p = pt(cx, cy, r * 0.5, i / n * TAU); label(c, t, p[0], p[1], r * 0.26, false); });
  const e = pt(cx, cy, r * 0.8, val / n * TAU), t = pt(cx, cy, -r * 0.18, val / n * TAU);
  c.lineCap = 'round'; line(c, t[0], t[1], e[0], e[1], r * 0.06);
  c.beginPath(); c.arc(cx, cy, r * 0.09, 0, TAU); c.fill();
}
function drawMoon(c, x, y, r, p, fg, bg) {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  c.fillStyle = bg; c.fillRect(x - r, y - r, r * 2, r * 2);
  const k = Math.cos(p * TAU), dir = p < 0.5 ? 1 : -1;
  c.fillStyle = fg; c.beginPath();
  c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, dir < 0);
  c.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, dir === 1 ? k > 0 : k < 0);
  c.fill(); c.restore();
  c.strokeStyle = fg; c.lineWidth = r * 0.08; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
}
function drawClock(d) {
  const fg = S.inv ? K : Y, bg = S.inv ? Y : K, c = ctx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, Z, Z); c.fillStyle = bg; c.fillRect(0, 0, Z, Z);
  const cx = Z / 2, cy = Z / 2, R = Z / 2 * 0.95;
  const ms = d.getMilliseconds(), sec = d.getSeconds() + (S.smooth ? ms / 1000 : 0);
  const min = d.getMinutes() + sec / 60, hr = d.getHours() % 12 + min / 60;
  c.strokeStyle = fg; c.fillStyle = fg; c.lineCap = 'butt';
  c.lineWidth = R * 0.035; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
  c.lineWidth = R * 0.01; c.beginPath(); c.arc(cx, cy, R * 0.93, 0, TAU); c.stroke();
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0, a = i / 60 * TAU;
    const p1 = pt(cx, cy, R * 0.9, a), p2 = pt(cx, cy, R * (big ? 0.82 : 0.86), a);
    line(c, p1[0], p1[1], p2[0], p2[1], big ? R * 0.025 : R * 0.008);
  }
  for (let i = 0; i < 12; i++) {
    const p = pt(cx, cy, R * 0.72, i / 12 * TAU);
    label(c, S.roman ? ROMAN[i] : String(i || 12), p[0], p[1], R * (S.roman ? 0.09 : 0.11), true);
  }
  // sub-dials: 24h (top), weekday (left), month (right), moon (bottom)
  const sr = R * 0.17, off = R * 0.38;
  subdial(c, cx, cy - off, sr, 24, [[0, '0'], [6, '6'], [12, '12'], [18, '18']], d.getHours() + d.getMinutes() / 60, fg, bg);
  subdial(c, cx - off, cy, sr, 7, 'SMTWTFS'.split('').map((t, i) => [i, t]), d.getDay() + d.getHours() / 24, fg, bg);
  subdial(c, cx + off, cy, sr, 12, 'JFMAMJJASOND'.split('').map((t, i) => [i, t]).filter(x => x[0] % 3 === 0), d.getMonth() + d.getDate() / 31, fg, bg);
  const p = moonPhase(d.getTime());
  drawMoon(c, cx, cy + off, sr * 0.82, p, fg, bg);
  c.fillStyle = fg; label(c, pad(d.getDate()), cx + R * 0.0, cy + off + sr * 1.45, R * 0.075, true);
  // seconds trail
  for (let i = 0; i < 24; i++) {
    c.globalAlpha = (1 - i / 24) * 0.5; c.strokeStyle = fg; c.lineWidth = R * 0.02;
    const a = (sec - i * 0.4) / 60 * TAU - Math.PI / 2;
    c.beginPath(); c.arc(cx, cy, R * 0.97, a - 0.03, a); c.stroke();
  }
  c.globalAlpha = 1; c.strokeStyle = fg; c.fillStyle = fg; c.lineCap = 'round';
  let a = hr / 12 * TAU, p1 = pt(cx, cy, R * 0.5, a), p2 = pt(cx, cy, -R * 0.1, a);
  line(c, p2[0], p2[1], p1[0], p1[1], R * 0.055);
  c.strokeStyle = bg; line(c, p2[0], p2[1], p1[0], p1[1], R * 0.02); c.strokeStyle = fg;
  a = min / 60 * TAU; p1 = pt(cx, cy, R * 0.76, a); p2 = pt(cx, cy, -R * 0.1, a);
  line(c, p2[0], p2[1], p1[0], p1[1], R * 0.04);
  c.strokeStyle = bg; line(c, p2[0], p2[1], p1[0], p1[1], R * 0.012); c.strokeStyle = fg;
  a = sec / 60 * TAU; p1 = pt(cx, cy, R * 0.88, a); p2 = pt(cx, cy, -R * 0.2, a);
  line(c, p2[0], p2[1], p1[0], p1[1], R * 0.012);
  const dp = pt(cx, cy, R * 0.6, a); c.beginPath(); c.arc(dp[0], dp[1], R * 0.03, 0, TAU); c.fill();
  c.beginPath(); c.arc(cx, cy, R * 0.045, 0, TAU); c.fill();
  c.fillStyle = bg; c.beginPath(); c.arc(cx, cy, R * 0.016, 0, TAU); c.fill();
}

// ===== digital readout =====
function fmtTime(d) {
  let hh = d.getHours(), ap = '';
  if (!S.h24) { ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12; }
  return [pad(hh), pad(d.getMinutes()), pad(d.getSeconds()), ap];
}
function updateDigital(d) {
  const [hh, mm, ss, ap] = fmtTime(d);
  const colon = d.getMilliseconds() < 500 ? ':' : ' ';
  bigEl.textContent = hh + colon + mm;
  bigEl.append(h('small', {}, ':' + ss + (ap ? ' ' + ap : '')));
  dateEl.textContent = DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  const p = moonPhase(d.getTime());
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-';
  metaEl.textContent = moonName(p) + ' ' + Math.round(illum(p) * 100) + '% lit  |  day ' + dayOfYear(d) +
    '  |  week ' + isoWeek(d) + '  |  UTC' + sign + pad(Math.floor(Math.abs(off) / 60)) + ':' + pad(Math.abs(off) % 60);
  document.title = hh + ':' + mm + ' ' + (ap || '') + ' Chrono';
}

// ===== views =====
const views = {};
const ZONES = [
  ['Kolkata', 'Asia/Kolkata'], ['UTC', 'UTC'], ['London', 'Europe/London'], ['New York', 'America/New_York'],
  ['Los Angeles', 'America/Los_Angeles'], ['Dubai', 'Asia/Dubai'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'],
];
views.world = (() => {
  let rows = [], fmts = [], key = '';
  const mk = (z, hour12) => new Intl.DateTimeFormat('en-GB', {
    timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12, weekday: 'short', day: 'numeric',
  });
  return {
    build(root) {
      rows = ZONES.map(([n]) => {
        const t = h('span', { className: 'mono' }), s = h('span', { className: 'dot' });
        const info = h('span', { style: { opacity: 0.7, fontSize: '12px', marginLeft: '8px' } });
        root.append(h('div', { className: 'row' }, h('span', {}, s, n, info), t));
        return { t, s, info };
      });
      key = '';
    },
    tick(d) {
      const k = String(S.h24);
      if (k !== key) { fmts = ZONES.map(z => mk(z[1], !S.h24)); key = k; }
      fmts.forEach((f, i) => {
        const parts = Object.fromEntries(f.formatToParts(d).map(p => [p.type, p.value]));
        const hr = parseInt(parts.hour, 10) + (parts.dayPeriod && parts.dayPeriod.toLowerCase() === 'pm' && parseInt(parts.hour, 10) < 12 ? 12 : 0);
        const day = hr >= 6 && hr < 18;
        rows[i].t.textContent = parts.hour + ':' + parts.minute + ':' + parts.second + (parts.dayPeriod ? ' ' + parts.dayPeriod.toUpperCase() : '');
        rows[i].s.className = 'dot' + (day ? ' day' : '');
        rows[i].info.textContent = parts.weekday + ' ' + parts.day;
      });
    },
  };
})();

views.stopwatch = (() => {
  const W = { run: false, base: 0, start: 0, laps: [] };
  let disp, list, startBtn;
  const elapsed = () => W.base + (W.run ? performance.now() - W.start : 0);
  const fmt = ms => {
    const t = Math.floor(ms / 10), c = t % 100, s = Math.floor(t / 100) % 60, m = Math.floor(t / 6000) % 60, hh = Math.floor(t / 360000);
    return (hh ? hh + ':' : '') + pad(m) + ':' + pad(s) + '.' + pad(c);
  };
  function toggle() {
    if (W.run) { W.base += performance.now() - W.start; W.run = false; }
    else { W.start = performance.now(); W.run = true; }
    startBtn.textContent = W.run ? 'Pause' : 'Start'; beep(660, 0.06);
  }
  function lap() {
    if (!W.run && !W.base) return;
    const total = elapsed(), prev = W.laps.length ? W.laps[0].total : 0;
    W.laps.unshift({ total, split: total - prev }); drawLaps();
  }
  function reset() { W.run = false; W.base = 0; W.laps = []; startBtn.textContent = 'Start'; drawLaps(); }
  function drawLaps() {
    list.textContent = '';
    const sp = W.laps.map(l => l.split), best = Math.min(...sp), worst = Math.max(...sp);
    W.laps.forEach((l, i) => {
      const tag = W.laps.length > 2 ? (l.split === best ? ' fastest' : l.split === worst ? ' slowest' : '') : '';
      list.append(h('div', { className: 'row' },
        h('span', {}, 'Lap ' + (W.laps.length - i) + tag),
        h('span', { className: 'mono' }, fmt(l.split) + '  ' + fmt(l.total))));
    });
  }
  return {
    toggle, lap, reset,
    build(root) {
      disp = h('div', { className: 'huge mono' }, fmt(elapsed()));
      startBtn = h('button', { onclick: toggle }, W.run ? 'Pause' : 'Start');
      list = h('div', { style: { maxHeight: '240px', overflow: 'auto' } });
      root.append(disp, h('div', { className: 'btns' }, startBtn, h('button', { onclick: lap }, 'Lap'), h('button', { onclick: reset }, 'Reset')), list);
      drawLaps();
    },
    tick() { disp.textContent = fmt(elapsed()); },
  };
})();

views.timer = (() => {
  const T = { total: 300000, left: 300000, run: false, end: 0 };
  let disp, bar, mIn, sIn, goBtn;
  const fmt = ms => { const s = Math.ceil(ms / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
  function set(ms) { T.total = ms; T.left = ms; T.run = false; goBtn.textContent = 'Start'; mIn.value = Math.floor(ms / 60000); sIn.value = Math.floor(ms / 1000) % 60; }
  function toggle() {
    if (T.run) { T.left = T.end - Date.now(); T.run = false; }
    else {
      if (T.left <= 0) T.left = T.total;
      T.end = Date.now() + T.left; T.run = true;
    }
    goBtn.textContent = T.run ? 'Pause' : 'Start'; beep(660, 0.06);
  }
  function apply() { set(Math.max(1000, (+mIn.value || 0) * 60000 + (+sIn.value || 0) * 1000)); }
  return {
    build(root) {
      disp = h('div', { className: 'huge mono' }, fmt(T.left));
      bar = h('i', {}); mIn = h('input', { type: 'number', min: 0, max: 999, style: { width: '80px' }, onchange: apply, ariaLabel: 'Minutes' });
      sIn = h('input', { type: 'number', min: 0, max: 59, style: { width: '80px' }, onchange: apply, ariaLabel: 'Seconds' });
      goBtn = h('button', { onclick: toggle }, T.run ? 'Pause' : 'Start');
      const presets = [1, 5, 10, 25, 45].map(m => h('button', { onclick: () => set(m * 60000) }, m + ' min'));
      root.append(disp, h('div', { className: 'bar' }, bar),
        h('div', { className: 'btns' }, mIn, 'min', sIn, 'sec'),
        h('div', { className: 'btns' }, goBtn, h('button', { onclick: () => set(T.total) }, 'Reset')),
        h('div', { className: 'btns' }, presets));
      mIn.value = Math.floor(T.total / 60000); sIn.value = Math.floor(T.total / 1000) % 60;
    },
    tick() {
      if (T.run) {
        T.left = T.end - Date.now();
        if (T.left <= 0) { T.left = 0; T.run = false; goBtn.textContent = 'Start'; startRing('Timer finished', null); }
      }
      disp.textContent = fmt(T.left); bar.style.width = (T.total ? 100 * T.left / T.total : 0) + '%';
    },
  };
})();

// ===== alarms =====
let ringTimer = null, lastFire = '';
function startRing(msg, alarm) {
  ring.textContent = '';
  ring.append(msg + '  ',
    h('button', { onclick: stopRing }, 'Dismiss'),
    alarm ? h('button', { onclick: () => snooze(alarm) }, 'Snooze 5 min') : '');
  ring.classList.add('go'); clearInterval(ringTimer);
  ringTimer = setInterval(() => { beep(988, 0.12); setTimeout(() => beep(740, 0.12), 160); }, 900);
}
function stopRing() { clearInterval(ringTimer); ring.classList.remove('go'); }
function snooze(a) {
  const d = new Date(Date.now() + 5 * 60000);
  S.alarms.push({ time: pad(d.getHours()) + ':' + pad(d.getMinutes()), label: 'Snoozed', on: true, once: true });
  save(); stopRing(); if (S.tab === 'alarm') renderTab();
}
function checkAlarms(d) {
  const t = pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (d.getSeconds() !== 0 || lastFire === t + d.getDate()) return;
  S.alarms.forEach(a => {
    if (a.on && a.time === t) {
      lastFire = t + d.getDate(); startRing((a.label || 'Alarm') + ' ' + a.time, a);
      if (a.once) a.on = false;
    }
  });
  save();
}
views.alarm = {
  build(root) {
    const tIn = h('input', { type: 'time', value: '07:00', ariaLabel: 'Alarm time' });
    const lIn = h('input', { type: 'text', placeholder: 'Label', style: { width: '150px' }, ariaLabel: 'Alarm label' });
    const list = h('div');
    const draw = () => {
      list.textContent = '';
      if (!S.alarms.length) list.append(h('p', { className: 'meta' }, 'No alarms yet. Pick a time and press Add.'));
      S.alarms.forEach((a, i) => list.append(h('div', { className: 'row' },
        h('span', {}, h('b', { className: 'mono' }, a.time), '  ' + (a.label || '')),
        h('span', {},
          h('button', { className: a.on ? 'on' : '', onclick: () => { a.on = !a.on; save(); draw(); } }, a.on ? 'On' : 'Off'), ' ',
          h('button', { onclick: () => { S.alarms.splice(i, 1); save(); draw(); } }, 'Delete')))));
    };
    root.append(h('div', { className: 'btns' }, tIn, lIn,
      h('button', { onclick: () => { S.alarms.push({ time: tIn.value, label: lIn.value, on: true }); save(); draw(); } }, 'Add')), list);
    draw();
  },
  tick() {},
};

// ===== calendar =====
views.calendar = (() => {
  let bars = [], info;
  const prog = (a, b, n) => Math.max(0, Math.min(100, 100 * (n - a) / (b - a)));
  return {
    build(root) {
      const d = new Date(), y = d.getFullYear(), m = d.getMonth();
      const first = new Date(y, m, 1).getDay(), len = new Date(y, m + 1, 0).getDate();
      const grid = h('div', { className: 'cal' }, 'SMTWTFS'.split('').map(x => h('b', {}, x)));
      for (let i = 0; i < first; i++) grid.append(h('span'));
      for (let i = 1; i <= len; i++) grid.append(h('span', { className: i === d.getDate() ? 'today' : '' }, String(i)));
      info = h('p', { className: 'meta' });
      bars = ['Day', 'Month', 'Year'].map(n => {
        const i = h('i'); root.append(); return { n, i, w: h('div', {}, h('span', {}, n), h('div', { className: 'bar' }, i)) };
      });
      root.append(h('h3', { style: { margin: 0 } }, MONTHS[m] + ' ' + y), grid, info, bars.map(b => b.w));
    },
    tick(d) {
      const y = d.getFullYear(), n = d.getTime();
      const vals = [prog(new Date(y, d.getMonth(), d.getDate()), new Date(y, d.getMonth(), d.getDate() + 1), n),
        prog(new Date(y, d.getMonth(), 1), new Date(y, d.getMonth() + 1, 1), n),
        prog(new Date(y, 0, 1), new Date(y + 1, 0, 1), n)];
      bars.forEach((b, i) => { b.i.style.width = vals[i] + '%'; });
      info.textContent = 'Day ' + dayOfYear(d) + ' of ' + (dayOfYear(new Date(y, 11, 31))) + ', ISO week ' + isoWeek(d) +
        ', ' + Math.round(vals[2] * 100) / 100 + '% of the year gone';
    },
  };
})();

// ===== settings =====
views.settings = {
  build(root) {
    const opts = [
      ['h24', '24-hour time'], ['smooth', 'Smooth seconds hand'], ['roman', 'Roman numerals'],
      ['inv', 'Invert colours (black on yellow)'], ['sound', 'Sound for alarms and timer'],
    ];
    opts.forEach(([k, t]) => {
      const b = h('button', {}, '');
      const paint = () => { b.textContent = S[k] ? 'On' : 'Off'; b.className = S[k] ? 'on' : ''; b.setAttribute('aria-pressed', S[k]); };
      b.onclick = () => { S[k] = !S[k]; save(); applyTheme(); paint(); };
      paint(); root.append(h('div', { className: 'row' }, h('span', {}, t), b));
    });
    root.append(h('div', { className: 'row' }, h('span', {}, 'Fullscreen'),
      h('button', { onclick: toggleFS }, 'Toggle')));
    root.append(h('p', { className: 'meta' },
      'Keys: 1-6 switch tabs, H 12/24h, I invert, F fullscreen, Space start/pause, L lap, Esc stop alarm.'));
  },
  tick() {},
};
function toggleFS() {
  try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {}
}

// ===== tabs =====
const TABS = [['world', 'World'], ['stopwatch', 'Stopwatch'], ['timer', 'Timer'], ['alarm', 'Alarms'], ['calendar', 'Calendar'], ['settings', 'Settings']];
function renderTabs() {
  tabsEl.textContent = '';
  TABS.forEach(([k, t], i) => tabsEl.append(h('button', {
    className: S.tab === k ? 'on' : '', role: 'tab', title: 'Key ' + (i + 1),
    onclick: () => { S.tab = k; save(); renderTab(); },
  }, t)));
}
function renderTab() {
  if (!views[S.tab]) S.tab = 'world';
  renderTabs(); panel.textContent = ''; views[S.tab].build(panel); views[S.tab].tick(new Date());
}

// ===== keyboard =====
addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase(), n = parseInt(k, 10);
  if (n >= 1 && n <= TABS.length) { S.tab = TABS[n - 1][0]; save(); renderTab(); }
  else if (k === 'h') { S.h24 = !S.h24; save(); if (S.tab === 'settings') renderTab(); }
  else if (k === 'i') { S.inv = !S.inv; save(); applyTheme(); if (S.tab === 'settings') renderTab(); }
  else if (k === 'f') toggleFS();
  else if (k === 'escape') stopRing();
  else if (S.tab === 'stopwatch' && k === ' ') { e.preventDefault(); views.stopwatch.toggle(); }
  else if (S.tab === 'stopwatch' && k === 'l') views.stopwatch.lap();
});

// ===== main loop =====
let lastSec = -1, lastText = 0;
function frame() {
  const d = new Date();
  if (S.smooth || d.getSeconds() !== lastSec) drawClock(d);
  if (d.getSeconds() !== lastSec) { lastSec = d.getSeconds(); checkAlarms(d); }
  const now = performance.now();
  if (now - lastText > 90) { lastText = now; updateDigital(d); views[S.tab].tick(d); }
  requestAnimationFrame(frame);
}
resize(); renderTab(); frame();
