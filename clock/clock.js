/* Chrono Complication v2 - plain ES5 so older phones and browsers can run it. */
(function () {
'use strict';
var Y = '#ffe21a', K = '#000000', TAU = Math.PI * 2;
function pad(n, l) { n = String(n); l = l || 2; while (n.length < l) n = '0' + n; return n; }
function ext(a, b) { for (var k in b) if (b.hasOwnProperty(k)) a[k] = b[k]; return a; }
var DEF = { inv: false, h24: true, smooth: true, roman: false, sound: true, chime: false, tab: 'world', alarms: [], target: '' };
var S = ext({}, DEF);
try { ext(S, JSON.parse(localStorage.getItem('chrono2') || '{}')); } catch (e) {}
function save() { try { localStorage.setItem('chrono2', JSON.stringify(S)); } catch (e) {} }
var tnow = (window.performance && window.performance.now) ? function () { return window.performance.now(); } : function () { return +new Date(); };
var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame ||
  function (f) { return setTimeout(f, 40); };

// ===== tiny DOM helpers =====
function on(e, t, f) { if (e.addEventListener) e.addEventListener(t, f, false); else e.attachEvent('on' + t, f); }
function add(p, k) {
  if (k === null || k === undefined || k === false) return;
  if (k instanceof Array) { for (var i = 0; i < k.length; i++) add(p, k[i]); return; }
  p.appendChild(typeof k === 'object' ? k : document.createTextNode(String(k)));
}
function h(tag, o) {
  var e = document.createElement(tag); o = o || {};
  for (var k in o) {
    if (!o.hasOwnProperty(k)) continue;
    var v = o[k];
    if (k === 'style') ext(e.style, v);
    else if (k.indexOf('on') === 0) on(e, k.slice(2), v);
    else if (k in e) { try { e[k] = v; } catch (x) {} }
    else e.setAttribute(k, v);
  }
  for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
  return e;
}
function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }

// ===== styling, all written in JS (no CSS variables, no grid: works on old browsers) =====
var RULES = [
  ['html,body', 'margin:0;padding:0;min-height:100%'],
  ['*', '-webkit-box-sizing:border-box;box-sizing:border-box'],
  ['body', 'background:@B;color:@F;font:15px/1.45 "Trebuchet MS",Arial,sans-serif;-webkit-text-size-adjust:100%;' +
    'padding-top:constant(safe-area-inset-top);padding-top:env(safe-area-inset-top);' +
    'padding-bottom:constant(safe-area-inset-bottom);padding-bottom:env(safe-area-inset-bottom)'],
  ['.app', 'max-width:1180px;margin:0 auto;padding:16px;overflow:hidden'],
  ['.left,.right', 'display:inline-block;vertical-align:top;width:49%;padding:0 1%'],
  ['.left', 'text-align:center'],
  ['@media (max-width:820px)', '.left,.right{display:block;width:100%;padding:0}.right{margin-top:20px}'],
  ['canvas', 'display:block;margin:0 auto;max-width:100%'],
  ['.big', 'font:bold 52px/1 "Courier New",monospace;letter-spacing:-2px;margin-top:14px'],
  ['@media (min-width:480px)', '.big{font-size:68px}'],
  ['.big small', 'font-size:22px;letter-spacing:0;margin-left:6px'],
  ['.date', 'font-size:18px;margin-top:8px'],
  ['.meta', 'opacity:.75;font-size:13px;margin-top:4px'],
  ['.tabs', 'margin-bottom:10px'],
  ['button', 'font:inherit;color:@F;background:transparent;border:2px solid @F;border-radius:999px;padding:6px 13px;margin:3px;cursor:pointer;-webkit-appearance:none'],
  ['button:hover,button.on', 'background:@F;color:@B'],
  ['input', 'font:inherit;color:@F;background:@B;border:2px solid @F;border-radius:10px;padding:7px 10px;width:120px;margin:3px'],
  ['.panel', 'border:2px solid @F;border-radius:22px;padding:16px;min-height:380px'],
  ['.row', 'padding:9px 0;border-bottom:1px dotted @F;overflow:hidden'],
  ['.fl', 'float:left'], ['.fr', 'float:right'],
  ['.mono', 'font-family:"Courier New",monospace'],
  ['.huge', 'font:bold 44px/1.1 "Courier New",monospace;text-align:center;margin:8px 0 14px'],
  ['.btns', 'text-align:center;margin:8px 0'],
  ['.bar', 'height:12px;border:2px solid @F;border-radius:8px;overflow:hidden;margin:5px 0 12px'],
  ['.bar i', 'display:block;height:100%;background:@F'],
  ['.mini', 'margin:16px auto 0;max-width:340px;border:2px solid @F;border-radius:18px;padding:10px'],
  ['.hd', 'overflow:hidden;line-height:34px;font-weight:bold;text-align:center'],
  ['.hd button', 'padding:1px 12px;margin:0'],
  ['.cell', 'display:inline-block;width:14.28%;text-align:center;padding:6px 0;border-radius:8px;font-size:14px;cursor:pointer;border:2px solid transparent'],
  ['.cell.h', 'opacity:.6;font-size:11px;cursor:default'],
  ['.cell.we', 'opacity:.7'],
  ['.cell.today', 'background:@F;color:@B;font-weight:bold;opacity:1'],
  ['.cell.sel', 'border-color:@F'],
  ['.dot', 'display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid @F;margin-right:8px'],
  ['.dot.day', 'background:@F'],
  ['.ring', 'position:fixed;top:0;left:0;right:0;z-index:9;text-align:center;background:@F;color:@B;padding:14px;font-weight:bold;display:none'],
  ['.ring.inv', 'background:@B;color:@F'],
  ['.ring button', 'color:@B;border-color:@B'],
  ['.ring.inv button', 'color:@F;border-color:@F'],
  ['.note', 'background:@F;color:@B;padding:6px 10px;font-size:13px;text-align:center']
];
var styleEl = document.createElement('style'); styleEl.type = 'text/css';
document.getElementsByTagName('head')[0].appendChild(styleEl);
function buildCSS() {
  var fg = S.inv ? K : Y, bg = S.inv ? Y : K, out = '';
  for (var i = 0; i < RULES.length; i++) out += RULES[i][0] + '{' + RULES[i][1] + '}';
  return out.replace(/@F/g, fg).replace(/@B/g, bg);
}
function applyTheme() {
  var t = buildCSS();
  if (styleEl.styleSheet) styleEl.styleSheet.cssText = t; else styleEl.textContent = t;
  document.body.style.background = S.inv ? Y : K;
  document.body.style.color = S.inv ? K : Y;
}

// ===== sound =====
var actx = null;
function beep(freq, dur) {
  if (!S.sound) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = actx || new AC();
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = 'square'; o.frequency.value = freq || 880;
    g.gain.value = 0.06;
    o.connect(g); g.connect(actx.destination);
    o.start ? o.start(0) : o.noteOn(0);
    setTimeout(function () { try { o.stop ? o.stop(0) : o.noteOff(0); } catch (e) {} }, (dur || 0.15) * 1000);
  } catch (e) {}
}

// ===== astronomy and calendar helpers =====
var SYN = 29.530588853, REF = Date.UTC(2000, 0, 6, 18, 14);
function moonPhase(t) { return (((t - REF) / 864e5 / SYN) % 1 + 1) % 1; }
var MOONS = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
function moonName(p) { return MOONS[Math.floor(p * 8 + 0.5) % 8]; }
function illum(p) { return (1 - Math.cos(p * TAU)) / 2; }
function isoWeek(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}
function dayOfYear(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); }
var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
function dateStr(d) { return DAYS[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(); }

// ===== layout =====
var test = document.createElement('canvas');
if (!(test.getContext && test.getContext('2d'))) throw new Error('canvas is not supported');
var cv = h('canvas', { 'aria-label': 'Analog clock with moon phase and sub-dials' });
var bigEl = h('div', { className: 'big mono' });
var dateEl = h('div', { className: 'date' });
var metaEl = h('div', { className: 'meta' });
var miniEl = h('div', { className: 'mini' });
var miniInfo = h('div', { className: 'meta', style: { textAlign: 'center' } });
var ring = h('div', { className: 'ring' });
var tabsEl = h('div', { className: 'tabs' });
var panel = h('div', { className: 'panel' });
applyTheme();
document.body.appendChild(ring);
document.body.appendChild(h('div', { className: 'app' },
  h('div', { className: 'left' }, cv, h('div', {}, bigEl, dateEl, metaEl), miniEl, miniInfo),
  h('div', { className: 'right' }, tabsEl, panel)));
var ctx = cv.getContext('2d'), Z = 320, dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  var w = cv.parentNode.clientWidth || 320;
  Z = Math.max(240, Math.min(560, w));
  cv.width = Math.floor(Z * dpr); cv.height = Math.floor(Z * dpr);
  cv.style.width = Z + 'px'; cv.style.height = Z + 'px';
}
on(window, 'resize', resize);

// ===== analog drawing =====
function pt(cx, cy, r, a) { return [cx + Math.cos(a - Math.PI / 2) * r, cy + Math.sin(a - Math.PI / 2) * r]; }
function line(c, x1, y1, x2, y2, w) { c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function label(c, t, x, y, size, bold) {
  c.font = (bold ? 'bold ' : '') + size + 'px "Courier New",monospace';
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x, y);
}
function subdial(c, cx, cy, r, n, labels, val, fg) {
  c.strokeStyle = fg; c.fillStyle = fg; c.lineCap = 'butt';
  c.lineWidth = r * 0.05; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
  var i, a, p1, p2;
  for (i = 0; i < n; i++) {
    a = i / n * TAU; p1 = pt(cx, cy, r * 0.88, a); p2 = pt(cx, cy, r * 0.74, a);
    line(c, p1[0], p1[1], p2[0], p2[1], r * 0.03);
  }
  for (i = 0; i < labels.length; i++) {
    p1 = pt(cx, cy, r * 0.5, labels[i][0] / n * TAU); label(c, labels[i][1], p1[0], p1[1], r * 0.26, false);
  }
  a = val / n * TAU; p1 = pt(cx, cy, r * 0.8, a); p2 = pt(cx, cy, -r * 0.18, a);
  c.lineCap = 'round'; line(c, p2[0], p2[1], p1[0], p1[1], r * 0.06);
  c.beginPath(); c.arc(cx, cy, r * 0.09, 0, TAU); c.fill();
}
function drawMoon(c, x, y, r, p, fg, bg) {
  var k = Math.cos(p * TAU), dir = p < 0.5 ? 1 : -1;
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  c.fillStyle = bg; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.fillStyle = fg; c.beginPath();
  c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, dir < 0);
  c.save(); c.translate(x, y); c.scale(Math.max(Math.abs(k), 0.0001), 1);
  c.arc(0, 0, r, Math.PI / 2, -Math.PI / 2, dir === 1 ? k > 0 : k < 0);
  c.restore(); c.fill(); c.restore();
  c.strokeStyle = fg; c.lineWidth = r * 0.08; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
}
function drawClock(d) {
  var fg = S.inv ? K : Y, bg = S.inv ? Y : K, c = ctx, i, a, p1, p2;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, Z, Z); c.fillStyle = bg; c.fillRect(0, 0, Z, Z);
  var cx = Z / 2, cy = Z / 2, R = Z / 2 * 0.95;
  var sec = d.getSeconds() + (S.smooth ? d.getMilliseconds() / 1000 : 0);
  var min = d.getMinutes() + sec / 60, hr = d.getHours() % 12 + min / 60;
  c.strokeStyle = fg; c.fillStyle = fg; c.lineCap = 'butt';
  c.lineWidth = R * 0.035; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
  c.lineWidth = R * 0.01; c.beginPath(); c.arc(cx, cy, R * 0.93, 0, TAU); c.stroke();
  for (i = 0; i < 60; i++) {
    var big = i % 5 === 0; a = i / 60 * TAU;
    p1 = pt(cx, cy, R * 0.9, a); p2 = pt(cx, cy, R * (big ? 0.82 : 0.86), a);
    line(c, p1[0], p1[1], p2[0], p2[1], big ? R * 0.025 : R * 0.008);
  }
  for (i = 0; i < 12; i++) {
    p1 = pt(cx, cy, R * 0.72, i / 12 * TAU);
    label(c, S.roman ? ROMAN[i] : String(i || 12), p1[0], p1[1], R * (S.roman ? 0.09 : 0.11), true);
  }
  var sr = R * 0.17, off = R * 0.38, wl = [], ml = [], w = 'SMTWTFS', m = 'JFMAMJJASOND';
  for (i = 0; i < 7; i++) wl.push([i, w.charAt(i)]);
  for (i = 0; i < 12; i += 3) ml.push([i, m.charAt(i)]);
  subdial(c, cx, cy - off, sr, 24, [[0, '0'], [6, '6'], [12, '12'], [18, '18']], d.getHours() + d.getMinutes() / 60, fg);
  subdial(c, cx - off, cy, sr, 7, wl, d.getDay() + d.getHours() / 24, fg);
  subdial(c, cx + off, cy, sr, 12, ml, d.getMonth() + d.getDate() / 31, fg);
  drawMoon(c, cx, cy + off, sr * 0.82, moonPhase(d.getTime()), fg, bg);
  c.fillStyle = fg; label(c, pad(d.getDate()), cx, cy + off + sr * 1.45, R * 0.075, true);
  for (i = 0; i < 24; i++) {
    c.globalAlpha = (1 - i / 24) * 0.5; c.strokeStyle = fg; c.lineWidth = R * 0.02;
    a = (sec - i * 0.4) / 60 * TAU - Math.PI / 2;
    c.beginPath(); c.arc(cx, cy, R * 0.97, a - 0.03, a, false); c.stroke();
  }
  c.globalAlpha = 1; c.strokeStyle = fg; c.fillStyle = fg; c.lineCap = 'round';
  a = hr / 12 * TAU; p1 = pt(cx, cy, R * 0.5, a); p2 = pt(cx, cy, -R * 0.1, a);
  line(c, p2[0], p2[1], p1[0], p1[1], R * 0.055);
  c.strokeStyle = bg; line(c, p2[0], p2[1], p1[0], p1[1], R * 0.02); c.strokeStyle = fg;
  a = min / 60 * TAU; p1 = pt(cx, cy, R * 0.76, a); p2 = pt(cx, cy, -R * 0.1, a);
  line(c, p2[0], p2[1], p1[0], p1[1], R * 0.04);
  c.strokeStyle = bg; line(c, p2[0], p2[1], p1[0], p1[1], R * 0.012); c.strokeStyle = fg;
  a = sec / 60 * TAU; p1 = pt(cx, cy, R * 0.88, a); p2 = pt(cx, cy, -R * 0.2, a);
  line(c, p2[0], p2[1], p1[0], p1[1], R * 0.012);
  p1 = pt(cx, cy, R * 0.6, a); c.beginPath(); c.arc(p1[0], p1[1], R * 0.03, 0, TAU); c.fill();
  c.beginPath(); c.arc(cx, cy, R * 0.045, 0, TAU); c.fill();
  c.fillStyle = bg; c.beginPath(); c.arc(cx, cy, R * 0.016, 0, TAU); c.fill();
}

// ===== digital readout =====
function fmtTime(d) {
  var hh = d.getHours(), ap = '';
  if (!S.h24) { ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12; }
  return [pad(hh), pad(d.getMinutes()), pad(d.getSeconds()), ap];
}
function updateDigital(d) {
  var f = fmtTime(d), colon = d.getMilliseconds() < 500 ? ':' : ' ';
  clear(bigEl);
  bigEl.appendChild(document.createTextNode(f[0] + colon + f[1]));
  bigEl.appendChild(h('small', {}, ':' + f[2] + (f[3] ? ' ' + f[3] : '')));
  dateEl.firstChild ? dateEl.firstChild.nodeValue = DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear()
    : dateEl.appendChild(document.createTextNode(' '));
  var p = moonPhase(d.getTime()), off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-';
  metaEl.textContent = moonName(p) + ' ' + Math.round(illum(p) * 100) + '% lit | day ' + dayOfYear(d) +
    ' | week ' + isoWeek(d) + ' | UTC' + sign + pad(Math.floor(Math.abs(off) / 60)) + ':' + pad(Math.abs(off) % 60);
  document.title = f[0] + ':' + f[1] + (f[3] ? ' ' + f[3] : '') + ' Chrono';
}

// ===== mini calendar (under the digital time) =====
var mini = { y: 0, m: 0, sel: null };
function stepMonth(n) {
  mini.m += n;
  if (mini.m < 0) { mini.m = 11; mini.y--; } else if (mini.m > 11) { mini.m = 0; mini.y++; }
  drawMini();
}
function showToday() { var t = new Date(); mini.y = t.getFullYear(); mini.m = t.getMonth(); mini.sel = [mini.y, mini.m, t.getDate()]; drawMini(); }
function miniText() {
  var s = mini.sel; if (!s) return;
  var d = new Date(s[0], s[1], s[2]), t = new Date();
  var diff = Math.round((Date.UTC(s[0], s[1], s[2]) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
  var rel = diff === 0 ? 'today' : diff > 0 ? 'in ' + diff + ' day' + (diff > 1 ? 's' : '') : (-diff) + ' day' + (diff < -1 ? 's' : '') + ' ago';
  miniInfo.textContent = dateStr(d) + ' | ' + rel + ' | day ' + dayOfYear(d) + ' | week ' + isoWeek(d);
}
function drawMini() {
  var t = new Date(), i, first = new Date(mini.y, mini.m, 1).getDay(), len = new Date(mini.y, mini.m + 1, 0).getDate();
  clear(miniEl);
  miniEl.appendChild(h('div', { className: 'hd' },
    h('button', { className: 'fl', 'aria-label': 'Previous month', onclick: function () { stepMonth(-1); } }, '<'),
    h('button', { className: 'fr', 'aria-label': 'Next month', onclick: function () { stepMonth(1); } }, '>'),
    MONTHS[mini.m] + ' ' + mini.y));
  for (i = 0; i < 7; i++) miniEl.appendChild(h('span', { className: 'cell h' }, 'SMTWTFS'.charAt(i)));
  for (i = 0; i < first; i++) miniEl.appendChild(h('span', { className: 'cell h' }, '\u00a0'));
  for (i = 1; i <= len; i++) (function (day) {
    var wd = (first + day - 1) % 7, cls = 'cell';
    if (wd === 0 || wd === 6) cls += ' we';
    if (mini.y === t.getFullYear() && mini.m === t.getMonth() && day === t.getDate()) cls += ' today';
    if (mini.sel && mini.sel[0] === mini.y && mini.sel[1] === mini.m && mini.sel[2] === day) cls += ' sel';
    miniEl.appendChild(h('span', { className: cls, onclick: function () { mini.sel = [mini.y, mini.m, day]; drawMini(); } }, String(day)));
  })(i);
  miniEl.appendChild(h('div', { className: 'btns', style: { marginBottom: 0 } }, h('button', { onclick: showToday }, 'Today')));
  miniText();
}

// ===== views =====
var views = {};
var ZONES = [['Kolkata', 'Asia/Kolkata', 330], ['UTC', 'UTC', 0], ['London', 'Europe/London', 0], ['New York', 'America/New_York', -300],
  ['Los Angeles', 'America/Los_Angeles', -480], ['Dubai', 'Asia/Dubai', 240], ['Tokyo', 'Asia/Tokyo', 540], ['Sydney', 'Australia/Sydney', 660]];
var tzOK = null;
function zoneParts(z, d) {
  if (tzOK !== false) {
    try {
      var s = d.toLocaleString('en-US', { timeZone: z[1], hour12: false });
      var m = /(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/.exec(s);
      if (m) { tzOK = true; return { y: +m[3], mo: +m[1], d: +m[2], h: +m[4] % 24, mi: +m[5], s: +m[6] }; }
    } catch (e) {}
    tzOK = false;
  }
  var t = new Date(d.getTime() + z[2] * 60000);
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds() };
}
views.world = (function () {
  var rows = [];
  return {
    build: function (root) {
      rows = [];
      for (var i = 0; i < ZONES.length; i++) {
        var t = h('span', { className: 'fr mono' }), s = h('span', { className: 'dot' }), inf = h('span', { style: { opacity: 0.7, fontSize: '12px', marginLeft: '8px' } });
        root.appendChild(h('div', { className: 'row' }, t, s, ZONES[i][0], inf));
        rows.push({ t: t, s: s, i: inf });
      }
      if (tzOK === false) root.appendChild(h('p', { className: 'meta' }, 'This browser has no time zone data. Fixed offsets are used and daylight saving is ignored.'));
    },
    tick: function (d) {
      for (var i = 0; i < ZONES.length; i++) {
        var p = zoneParts(ZONES[i], d), hh = p.h, ap = '';
        if (!S.h24) { ap = hh >= 12 ? ' PM' : ' AM'; hh = hh % 12 || 12; }
        rows[i].t.textContent = pad(hh) + ':' + pad(p.mi) + ':' + pad(p.s) + ap;
        rows[i].s.className = 'dot' + (p.h >= 6 && p.h < 18 ? ' day' : '');
        rows[i].i.textContent = DAYS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()].slice(0, 3) + ' ' + p.d;
      }
    }
  };
})();

views.stopwatch = (function () {
  var W = { run: false, base: 0, start: 0, laps: [] }, disp, list, startBtn;
  function elapsed() { return W.base + (W.run ? tnow() - W.start : 0); }
  function fmt(ms) {
    var t = Math.floor(ms / 10), c = t % 100, s = Math.floor(t / 100) % 60, m = Math.floor(t / 6000) % 60, hh = Math.floor(t / 360000);
    return (hh ? hh + ':' : '') + pad(m) + ':' + pad(s) + '.' + pad(c);
  }
  function drawLaps() {
    clear(list);
    var i, best = 1e12, worst = 0;
    for (i = 0; i < W.laps.length; i++) { best = Math.min(best, W.laps[i].split); worst = Math.max(worst, W.laps[i].split); }
    for (i = 0; i < W.laps.length; i++) {
      var l = W.laps[i], tag = '';
      if (W.laps.length > 2) tag = l.split === best ? ' (fastest)' : l.split === worst ? ' (slowest)' : '';
      list.appendChild(h('div', { className: 'row' }, h('span', { className: 'fr mono' }, fmt(l.split) + '  ' + fmt(l.total)), 'Lap ' + (W.laps.length - i) + tag));
    }
  }
  function toggle() {
    if (W.run) { W.base += tnow() - W.start; W.run = false; } else { W.start = tnow(); W.run = true; }
    if (startBtn) startBtn.textContent = W.run ? 'Pause' : 'Start';
    beep(660, 0.06);
  }
  function lap() {
    if (!W.run && !W.base) return;
    var total = elapsed(), prev = W.laps.length ? W.laps[0].total : 0;
    W.laps.unshift({ total: total, split: total - prev }); drawLaps();
  }
  function reset() { W.run = false; W.base = 0; W.laps = []; startBtn.textContent = 'Start'; drawLaps(); }
  return {
    toggle: toggle, lap: lap,
    build: function (root) {
      disp = h('div', { className: 'huge' }, fmt(elapsed()));
      startBtn = h('button', { onclick: toggle }, W.run ? 'Pause' : 'Start');
      list = h('div', { style: { maxHeight: '240px', overflow: 'auto' } });
      root.appendChild(disp);
      root.appendChild(h('div', { className: 'btns' }, startBtn, h('button', { onclick: lap }, 'Lap'), h('button', { onclick: reset }, 'Reset')));
      root.appendChild(list); drawLaps();
    },
    tick: function () { disp.textContent = fmt(elapsed()); }
  };
})();

// ===== alarm ringing =====
var ringTimer = null, blinkTimer = null, lastFire = '';
function startRing(msg, alarm) {
  clear(ring);
  add(ring, [msg + '  ', h('button', { onclick: stopRing }, 'Dismiss'),
    alarm ? h('button', { onclick: function () { snooze(); } }, 'Snooze 5 min') : '']);
  ring.style.display = 'block'; clearInterval(ringTimer); clearInterval(blinkTimer);
  ringTimer = setInterval(function () { beep(988, 0.12); setTimeout(function () { beep(740, 0.12); }, 160); }, 900);
  blinkTimer = setInterval(function () { ring.className = ring.className === 'ring' ? 'ring inv' : 'ring'; }, 450);
}
function stopRing() { clearInterval(ringTimer); clearInterval(blinkTimer); ring.style.display = 'none'; ring.className = 'ring'; }
function snooze() {
  var d = new Date(new Date().getTime() + 5 * 60000);
  S.alarms.push({ time: pad(d.getHours()) + ':' + pad(d.getMinutes()), label: 'Snoozed', on: true, once: true });
  save(); stopRing(); if (S.tab === 'alarm') renderTab();
}
function checkAlarms(d) {
  var t = pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (d.getSeconds() !== 0) return;
  if (S.chime && d.getMinutes() === 0) { beep(1040, 0.1); setTimeout(function () { beep(1040, 0.1); }, 220); }
  if (lastFire === t + d.getDate()) return;
  for (var i = 0; i < S.alarms.length; i++) {
    var a = S.alarms[i];
    if (a.on && a.time === t) { lastFire = t + d.getDate(); startRing((a.label || 'Alarm') + ' ' + a.time, a); if (a.once) a.on = false; }
  }
  save();
}
views.timer = (function () {
  var T = { total: 300000, left: 300000, run: false, end: 0 }, disp, bar, mIn, sIn, goBtn;
  function fmt(ms) { var s = Math.ceil(ms / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
  function set(ms) {
    T.total = ms; T.left = ms; T.run = false; goBtn.textContent = 'Start';
    mIn.value = Math.floor(ms / 60000); sIn.value = Math.floor(ms / 1000) % 60;
  }
  function toggle() {
    if (T.run) { T.left = T.end - new Date().getTime(); T.run = false; }
    else { if (T.left <= 0) T.left = T.total; T.end = new Date().getTime() + T.left; T.run = true; }
    if (goBtn) goBtn.textContent = T.run ? 'Pause' : 'Start';
    beep(660, 0.06);
  }
  function apply() { set(Math.max(1000, (+mIn.value || 0) * 60000 + (+sIn.value || 0) * 1000)); }
  return {
    toggle: toggle,
    build: function (root) {
      disp = h('div', { className: 'huge' }, fmt(T.left)); bar = h('i');
      mIn = h('input', { type: 'number', onchange: apply, style: { width: '80px' } });
      sIn = h('input', { type: 'number', onchange: apply, style: { width: '80px' } });
      goBtn = h('button', { onclick: toggle }, T.run ? 'Pause' : 'Start');
      var pre = [], ms = [1, 5, 10, 25, 45];
      for (var i = 0; i < ms.length; i++) (function (m) { pre.push(h('button', { onclick: function () { set(m * 60000); } }, m + ' min')); })(ms[i]);
      root.appendChild(disp); root.appendChild(h('div', { className: 'bar' }, bar));
      root.appendChild(h('div', { className: 'btns' }, mIn, 'min', sIn, 'sec'));
      root.appendChild(h('div', { className: 'btns' }, goBtn, h('button', { onclick: function () { set(T.total); } }, 'Reset')));
      root.appendChild(h('div', { className: 'btns' }, pre));
      mIn.value = Math.floor(T.total / 60000); sIn.value = Math.floor(T.total / 1000) % 60;
    },
    tick: function () {
      if (T.run) {
        T.left = T.end - new Date().getTime();
        if (T.left <= 0) { T.left = 0; T.run = false; goBtn.textContent = 'Start'; startRing('Timer finished', null); }
      }
      disp.textContent = fmt(T.left); bar.style.width = (T.total ? 100 * T.left / T.total : 0) + '%';
    }
  };
})();

views.alarm = {
  build: function (root) {
    var tIn = h('input', { type: 'time', value: '07:00', placeholder: 'HH:MM' });
    var lIn = h('input', { type: 'text', placeholder: 'Label', style: { width: '150px' } });
    var list = h('div'), msg = h('p', { className: 'meta' });
    function draw() {
      clear(list);
      if (!S.alarms.length) list.appendChild(h('p', { className: 'meta' }, 'No alarms yet. Pick a time and press Add.'));
      for (var i = 0; i < S.alarms.length; i++) (function (a, n) {
        list.appendChild(h('div', { className: 'row' },
          h('span', { className: 'fr' },
            h('button', { className: a.on ? 'on' : '', onclick: function () { a.on = !a.on; save(); draw(); } }, a.on ? 'On' : 'Off'),
            h('button', { onclick: function () { S.alarms.splice(n, 1); save(); draw(); } }, 'Delete')),
          h('b', { className: 'mono' }, a.time), '  ' + (a.label || '')));
      })(S.alarms[i], i);
    }
    root.appendChild(h('div', { className: 'btns' }, tIn, lIn, h('button', { onclick: function () {
      var m = /^(\d{1,2}):(\d{2})$/.exec(tIn.value);
      if (!m || +m[1] > 23 || +m[2] > 59) { msg.textContent = 'Enter the time as HH:MM, for example 07:30.'; return; }
      msg.textContent = ''; S.alarms.push({ time: pad(m[1]) + ':' + m[2], label: lIn.value, on: true }); save(); draw();
    } }, 'Add')));
    root.appendChild(msg); root.appendChild(list); draw();
  },
  tick: function () {}
};

views.pomodoro = (function () {
  var LEN = { focus: 25, short: 5, long: 15 }, NAME = { focus: 'Focus', short: 'Short break', long: 'Long break' };
  var P = { phase: 'focus', left: 25 * 60000, run: false, end: 0, done: 0 }, disp, bar, name, cnt, goBtn;
  function fmt(ms) { var s = Math.ceil(ms / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
  function setPhase(ph) { P.phase = ph; P.left = LEN[ph] * 60000; P.run = false; if (goBtn) goBtn.textContent = 'Start'; }
  function next() {
    if (P.phase === 'focus') { P.done++; setPhase(P.done % 4 === 0 ? 'long' : 'short'); } else setPhase('focus');
  }
  function toggle() {
    if (P.run) { P.left = P.end - new Date().getTime(); P.run = false; }
    else { P.end = new Date().getTime() + P.left; P.run = true; }
    if (goBtn) goBtn.textContent = P.run ? 'Pause' : 'Start';
    beep(660, 0.06);
  }
  return {
    toggle: toggle,
    build: function (root) {
      name = h('div', { className: 'huge', style: { fontSize: '22px', margin: 0 } });
      disp = h('div', { className: 'huge' }); bar = h('i'); cnt = h('p', { className: 'meta', style: { textAlign: 'center' } });
      goBtn = h('button', { onclick: toggle }, P.run ? 'Pause' : 'Start');
      root.appendChild(name); root.appendChild(disp); root.appendChild(h('div', { className: 'bar' }, bar));
      root.appendChild(h('div', { className: 'btns' }, goBtn,
        h('button', { onclick: next }, 'Skip'),
        h('button', { onclick: function () { setPhase(P.phase); } }, 'Reset'),
        h('button', { onclick: function () { P.done = 0; setPhase('focus'); } }, 'Restart cycle')));
      root.appendChild(cnt);
      root.appendChild(h('p', { className: 'meta' }, 'Four focus sessions of 25 minutes, with 5 minute breaks and a 15 minute break after the fourth.'));
    },
    tick: function () {
      if (P.run) {
        P.left = P.end - new Date().getTime();
        if (P.left <= 0) { var was = P.phase; next(); startRing(was === 'focus' ? 'Focus done. Time for a break.' : 'Break over. Back to focus.', null); }
      }
      name.textContent = NAME[P.phase]; disp.textContent = fmt(P.left);
      bar.style.width = (100 * P.left / (LEN[P.phase] * 60000)) + '%';
      cnt.textContent = 'Focus sessions finished: ' + P.done;
    }
  };
})();

views.countdown = (function () {
  var out, msg, inp;
  function parse(s) { var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function target() {
    var t = parse(S.target);
    if (t) return t;
    var n = new Date(); return new Date(n.getFullYear() + 1, 0, 1);
  }
  return {
    build: function (root) {
      out = h('div', { className: 'huge', style: { fontSize: '34px' } }); msg = h('p', { className: 'meta', style: { textAlign: 'center' } });
      inp = h('input', { type: 'date', value: S.target, placeholder: 'YYYY-MM-DD' });
      root.appendChild(h('div', { className: 'btns' }, inp, h('button', { onclick: function () {
        if (!parse(inp.value)) { msg.textContent = 'Enter a date as YYYY-MM-DD, for example 2027-01-01.'; return; }
        S.target = inp.value; save(); msg.textContent = '';
      } }, 'Set date'), h('button', { onclick: function () { S.target = ''; inp.value = ''; save(); } }, 'New Year')));
      root.appendChild(out); root.appendChild(msg);
    },
    tick: function (d) {
      var t = target(), diff = t.getTime() - d.getTime();
      if (diff <= 0) { out.textContent = 'Date reached'; msg.textContent = dateStr(t); return; }
      var s = Math.floor(diff / 1000);
      out.textContent = Math.floor(s / 86400) + 'd ' + pad(Math.floor(s / 3600) % 24) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
      if (!/not|Enter/.test(msg.textContent)) msg.textContent = 'Until ' + dateStr(t) + (S.target ? '' : ' (next New Year)');
    }
  };
})();

views.progress = (function () {
  var bars = [], info, moon;
  function frac(a, b, n) { return Math.max(0, Math.min(100, 100 * (n - a) / (b - a))); }
  return {
    build: function (root) {
      bars = []; var names = ['Day', 'Week', 'Month', 'Year', 'Moon cycle'];
      for (var i = 0; i < names.length; i++) {
        var b = h('i'), lb = h('span', { className: 'fr mono' });
        root.appendChild(h('div', {}, lb, names[i], h('div', { className: 'bar' }, b))); bars.push({ b: b, l: lb });
      }
      info = h('p', { className: 'meta' }); moon = h('p', { className: 'meta' });
      root.appendChild(info); root.appendChild(moon);
    },
    tick: function (d) {
      var y = d.getFullYear(), mo = d.getMonth(), da = d.getDate(), n = d.getTime(), wd = (d.getDay() + 6) % 7;
      var v = [frac(new Date(y, mo, da), new Date(y, mo, da + 1), n), frac(new Date(y, mo, da - wd), new Date(y, mo, da - wd + 7), n),
        frac(new Date(y, mo, 1), new Date(y, mo + 1, 1), n), frac(new Date(y, 0, 1), new Date(y + 1, 0, 1), n), moonPhase(n) * 100];
      for (var i = 0; i < 5; i++) { bars[i].b.style.width = v[i] + '%'; bars[i].l.textContent = v[i].toFixed(2) + '%'; }
      var leap = new Date(y, 1, 29).getMonth() === 1, total = leap ? 366 : 365;
      info.textContent = 'Day ' + dayOfYear(d) + ' of ' + total + ', ' + (total - dayOfYear(d)) + ' days left. ISO week ' + isoWeek(d) + '. ' + (leap ? 'Leap year.' : 'Not a leap year.');
      var p = moonPhase(n), full = new Date(n + ((0.5 - p + 1) % 1) * SYN * 864e5), nw = new Date(n + ((1 - p) % 1 || 1) * SYN * 864e5);
      moon.textContent = moonName(p) + ', ' + Math.round(illum(p) * 100) + '% lit. Next full moon about ' + dateStr(full) + ', next new moon about ' + dateStr(nw) + '.';
    }
  };
})();

function toggleFS() {
  var d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
  } catch (e) {}
}
views.settings = {
  build: function (root) {
    var opts = [['h24', '24-hour time'], ['smooth', 'Smooth seconds hand'], ['roman', 'Roman numerals'],
      ['inv', 'Invert colours (black on yellow)'], ['sound', 'Sound for alarms and timers'], ['chime', 'Chime on the hour']];
    for (var i = 0; i < opts.length; i++) (function (k, t) {
      var b = h('button', { className: 'fr' });
      function paint() { b.textContent = S[k] ? 'On' : 'Off'; b.className = 'fr' + (S[k] ? ' on' : ''); }
      b.onclick = function () { S[k] = !S[k]; save(); applyTheme(); paint(); };
      paint(); root.appendChild(h('div', { className: 'row' }, b, t));
    })(opts[i][0], opts[i][1]);
    root.appendChild(h('div', { className: 'row' }, h('button', { className: 'fr', onclick: toggleFS }, 'Toggle'), 'Fullscreen'));
    root.appendChild(h('div', { className: 'row' }, h('button', { className: 'fr', onclick: function () {
      S.alarms = []; S.target = ''; S.inv = false; S.h24 = true; S.smooth = true; S.roman = false; S.chime = false; save(); applyTheme(); renderTab();
    } }, 'Reset'), 'Reset all saved settings'));
    root.appendChild(h('p', { className: 'meta' }, 'Keys: 1-8 switch tabs, H 12/24h, I invert, F fullscreen, Space start or pause, L lap, Esc stop alarm.'));
  },
  tick: function () {}
};

// ===== tabs =====
var TABS = [['world', 'World'], ['stopwatch', 'Stopwatch'], ['timer', 'Timer'], ['alarm', 'Alarms'],
  ['pomodoro', 'Pomodoro'], ['countdown', 'Countdown'], ['progress', 'Progress'], ['settings', 'Settings']];
function renderTabs() {
  clear(tabsEl);
  for (var i = 0; i < TABS.length; i++) (function (k, t, n) {
    tabsEl.appendChild(h('button', { className: S.tab === k ? 'on' : '', title: 'Key ' + (n + 1), onclick: function () { S.tab = k; save(); renderTab(); } }, t));
  })(TABS[i][0], TABS[i][1], i);
}
function renderTab() {
  if (!views[S.tab]) S.tab = 'world';
  renderTabs(); clear(panel); views[S.tab].build(panel); views[S.tab].tick(new Date());
}

// ===== keyboard =====
on(document, 'keydown', function (e) {
  e = e || window.event;
  var tg = (e.target || e.srcElement || {}).tagName || '';
  if (/INPUT|TEXTAREA|SELECT/.test(tg) || e.metaKey || e.ctrlKey) return;
  var code = e.keyCode || e.which, k = e.key ? String(e.key).toLowerCase() : String.fromCharCode(code).toLowerCase();
  if (code === 32) k = 'space'; if (code === 27) k = 'escape';
  var n = parseInt(k, 10);
  if (n >= 1 && n <= TABS.length) { S.tab = TABS[n - 1][0]; save(); renderTab(); }
  else if (k === 'h') { S.h24 = !S.h24; save(); if (S.tab === 'settings') renderTab(); }
  else if (k === 'i') { S.inv = !S.inv; save(); applyTheme(); if (S.tab === 'settings') renderTab(); }
  else if (k === 'f') toggleFS();
  else if (k === 'escape') stopRing();
  else if (k === 'space' && views[S.tab].toggle) { if (e.preventDefault) e.preventDefault(); views[S.tab].toggle(); }
  else if (k === 'l' && S.tab === 'stopwatch') views.stopwatch.lap();
});

// ===== main loop =====
var lastSec = -1, lastText = 0, lastDay = -1;
function frame() {
  try {
    var d = new Date();
    if (S.smooth || d.getSeconds() !== lastSec) drawClock(d);
    if (d.getDate() !== lastDay) { lastDay = d.getDate(); if (!mini.sel) showToday(); else drawMini(); }
    if (d.getSeconds() !== lastSec) { lastSec = d.getSeconds(); checkAlarms(d); }
    var t = tnow();
    if (t - lastText > 90) { lastText = t; updateDigital(d); views[S.tab].tick(d); }
  } catch (err) {
    if (window.ChronoBasic) window.ChronoBasic.show('Full clock stopped (' + (err && err.message) + '). Showing the basic clock.');
    return;
  }
  raf(frame);
}
try {
  resize(); showToday(); renderTab(); frame();
  window.ChronoOK = true;
  if (window.ChronoBasic) window.ChronoBasic.hide();
} catch (err) {
  if (window.ChronoBasic) window.ChronoBasic.show('Full clock could not start (' + (err && err.message) + '). Showing the basic clock.');
}
})();
