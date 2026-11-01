/* lab.js: lazy-loaded when Tools/Arcade approach the viewport. Adds extra tools + games as tabs. */
(function () {
  "use strict";
  var S = window.SG, $ = S.$, D = document, root = D.documentElement;
  var rand = function (n) { return Math.floor(Math.random() * n); };
  function el(t, c, p, x) { var e = D.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; if (p) p.appendChild(e); return e; }
  function B(p, t, f) { var b = el("button", "mini", p, t); b.type = "button"; b.style.padding = "10px 16px"; b.onclick = f; return b; }
  function add(group, key, title) {
    var b = el("button", "", group.querySelector(".tabs"), title);
    b.setAttribute("role", "tab"); b.id = "t-" + key; b.setAttribute("aria-controls", "p-" + key); b.setAttribute("aria-selected", "false"); b.tabIndex = -1; b.dataset.t = key;
    var p = el("div", "panel", group); p.id = "p-" + key; p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", "t-" + key); p.hidden = true;
    return p;
  }
  var TL = $("p-calc").closest(".tool"), GM = $("p-ttt").closest(".tool");

  /* ---------- Tools ---------- */
  (function () { /* JSON */
    var p = add(TL, "json", "JSON"), i = el("textarea", "", p), r = el("div", "outrow", p), o = el("output", "mono pre", p);
    i.rows = 5; i.placeholder = '{"hello":"world"}';
    function run(sp) { try { o.textContent = JSON.stringify(JSON.parse(i.value), null, sp); o.style.color = ""; } catch (e) { o.textContent = e.message; o.style.color = "#fca5a5"; } }
    B(r, "Format", function () { run(2); }); B(r, "Minify", function () { run(0); }); B(r, "Copy", function () { S.copy(o.textContent); });
  })();
  (function () { /* Base64 */
    var p = add(TL, "b64", "Base64"), i = el("textarea", "", p), r = el("div", "outrow", p), o = el("output", "mono pre", p);
    i.rows = 4; i.placeholder = "Text or Base64";
    B(r, "Encode", function () { try { o.textContent = btoa(String.fromCharCode.apply(null, new TextEncoder().encode(i.value))); } catch (e) { o.textContent = "Error"; } });
    B(r, "Decode", function () { try { o.textContent = new TextDecoder().decode(Uint8Array.from(atob(i.value.trim()), function (c) { return c.charCodeAt(0); })); } catch (e) { o.textContent = "Not valid Base64"; } });
    B(r, "Copy", function () { S.copy(o.textContent); });
  })();
  (function () { /* UUID */
    var p = add(TL, "uuid", "UUID"), r = el("div", "outrow", p), o = el("output", "mono pre", p);
    var u = function () { return crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) { return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16); }); };
    function g() { o.textContent = [1, 2, 3, 4, 5].map(u).join("\n"); }
    B(r, "Generate 5", g); B(r, "Copy", function () { S.copy(o.textContent); }); g();
  })();
  (function () { /* Colour */
    var p = add(TL, "color", "Colour"), r = el("div", "outrow", p), c = el("input", "", r), o = el("output", "mono pre", p);
    c.type = "color"; c.value = "#ffe21a"; c.style.cssText = "width:64px;height:48px;border:0;background:none;cursor:pointer";
    function up() {
      var h = c.value, R = parseInt(h.slice(1, 3), 16), G = parseInt(h.slice(3, 5), 16), Bl = parseInt(h.slice(5, 7), 16);
      var r1 = R / 255, g1 = G / 255, b1 = Bl / 255, mx = Math.max(r1, g1, b1), mn = Math.min(r1, g1, b1), l = (mx + mn) / 2, d = mx - mn, hh = 0, s = 0;
      if (d) { s = d / (1 - Math.abs(2 * l - 1)); hh = mx === r1 ? ((g1 - b1) / d + 6) % 6 : mx === g1 ? (b1 - r1) / d + 2 : (r1 - g1) / d + 4; hh *= 60; }
      o.textContent = h + "\nrgb(" + R + ", " + G + ", " + Bl + ")\nhsl(" + Math.round(hh) + ", " + Math.round(s * 100) + "%, " + Math.round(l * 100) + "%)";
    }
    c.addEventListener("input", up); B(r, "Copy", function () { S.copy(o.textContent); }); up();
  })();

  /* ---------- Games ---------- */
  (function () { /* 2048 */
    var p = add(GM, "g2048", "2048"), w = el("div", "gwrap", p), bd = el("div", "g48", w), sd = el("div", "gside", w), st = el("p", "gstat", sd);
    var g, sc, best = +S.store("sg-2048") || 0;
    function put() { var e = []; g.forEach(function (v, i) { if (!v) e.push(i); }); if (e.length) g[e[rand(e.length)]] = Math.random() < .9 ? 2 : 4; }
    function draw() {
      var rgb = getComputedStyle(root).getPropertyValue("--yr").trim(); bd.textContent = "";
      g.forEach(function (v) {
        var c = el("div", "t48", bd, v || "");
        if (v) { var a = Math.min(1, .12 + Math.log(v) / Math.LN2 / 12); c.style.background = "rgba(" + rgb + "," + a + ")"; c.style.color = a > .5 ? "var(--on)" : ""; }
      });
      st.textContent = "Score " + sc + " · Best " + best;
    }
    function init() { g = Array(16).fill(0); sc = 0; put(); put(); draw(); }
    function line(a) { var r = a.filter(Boolean), o = []; for (var i = 0; i < r.length; i++) { if (r[i] === r[i + 1]) { o.push(r[i] * 2); sc += r[i] * 2; i++; } else o.push(r[i]); } while (o.length < 4) o.push(0); return o; }
    function mv(d) {
      var ng = g.slice(), i, j, a;
      for (i = 0; i < 4; i++) {
        a = []; for (j = 0; j < 4; j++) a.push(d < 2 ? g[i * 4 + j] : g[j * 4 + i]);
        if (d % 2) a.reverse(); a = line(a); if (d % 2) a.reverse();
        for (j = 0; j < 4; j++) ng[d < 2 ? i * 4 + j : j * 4 + i] = a[j];
      }
      if (ng.join() !== g.join()) {
        g = ng; put(); if (sc > best) { best = sc; S.store("sg-2048", String(best)); }
        draw(); if (g.indexOf(2048) > -1 && S.confetti) S.confetti();
      }
    }
    D.addEventListener("keydown", function (e) {
      if (p.hidden) return;
      var d = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 }[e.key];
      if (d == null) return; e.preventDefault(); mv(d);
    });
    var sx = 0, sy = 0;
    bd.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; });
    bd.addEventListener("pointerup", function (e) {
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      mv(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 0) : (dy > 0 ? 3 : 2));
    });
    B(sd, "New game", init); el("p", "hint", sd, "Arrow keys or swipe. Merge tiles to reach 2048."); init();
  })();

  (function () { /* Simon */
    var p = add(GM, "simon", "Simon"), w = el("div", "gwrap", p), bd = el("div", "simon", w), sd = el("div", "gside", w), st = el("p", "gstat", sd, "Press Start");
    var seq = [], k = 0, busy = 1, best = +S.store("sg-simon") || 0, F = [262, 330, 392, 523], bs = [];
    function fl(i) { bs[i].classList.add("lit"); if (S.beep) S.beep(F[i], .2); setTimeout(function () { bs[i].classList.remove("lit"); }, 260); }
    function nx() {
      seq.push(rand(4)); k = 0; busy = 1; st.textContent = "Round " + seq.length + " · Best " + best;
      seq.forEach(function (v, n) { setTimeout(function () { fl(v); }, n * 500 + 300); });
      setTimeout(function () { busy = 0; }, seq.length * 500 + 300);
    }
    function over() { busy = 1; var s = seq.length - 1; if (s > best) { best = s; S.store("sg-simon", String(s)); } st.textContent = "Game over · reached " + s + " · Best " + best; }
    for (var i = 0; i < 4; i++) (function (i) {
      var b = el("button", "sb s" + i, bd); b.type = "button"; b.setAttribute("aria-label", "Pad " + (i + 1));
      b.onclick = function () { if (busy) return; fl(i); if (i !== seq[k]) return over(); if (++k === seq.length) { busy = 1; setTimeout(nx, 700); } };
      bs.push(b);
    })(i);
    B(sd, "Start", function () { seq = []; nx(); }); el("p", "hint", sd, "Watch the pattern, then repeat it.");
  })();

  (function () { /* Minesweeper 9x9 */
    var p = add(GM, "mines", "Mines"), w = el("div", "gwrap", p), bd = el("div", "mines", w), sd = el("div", "gside", w), st = el("p", "gstat", sd);
    var N = 9, M = 10, c, over, left, first, fm = 0;
    function nb(i) { var r = [], x = i % N, y = (i / N) | 0; for (var dy = -1; dy < 2; dy++) for (var dx = -1; dx < 2; dx++) { var a = x + dx, b = y + dy; if ((dx || dy) && a >= 0 && b >= 0 && a < N && b < N) r.push(b * N + a); } return r; }
    function seed(s) { var k = 0, ex = nb(s); while (k < M) { var i = rand(81); if (i !== s && !c[i].m && ex.indexOf(i) < 0) { c[i].m = 1; k++; } } c.forEach(function (q, i) { q.n = nb(i).filter(function (j) { return c[j].m; }).length; }); }
    function flag(i) { if (over || c[i].o) return; c[i].f = !c[i].f; c[i].b.textContent = c[i].f ? "🚩" : ""; }
    function open(i) { var q = c[i]; if (q.o || q.f) return; q.o = 1; q.b.classList.add("op"); left--; q.b.textContent = q.n || ""; if (!q.n) nb(i).forEach(open); }
    function hit(i) {
      if (over) return; if (fm) return flag(i);
      if (first) { seed(i); first = 0; }
      var q = c[i]; if (q.f || q.o) return;
      if (q.m) { over = 1; c.forEach(function (z) { if (z.m) z.b.textContent = "💣"; }); q.b.classList.add("bad"); st.textContent = "Boom! Try again"; return; }
      open(i); if (left <= 0) { over = 1; st.textContent = "You win! 🎉"; if (S.confetti) S.confetti(); }
    }
    function init() {
      bd.textContent = ""; c = []; over = 0; first = 1; left = N * N - M; st.textContent = "Mines: " + M;
      for (var i = 0; i < 81; i++) (function (i) {
        var b = el("button", "ms", bd); b.type = "button"; b.setAttribute("aria-label", "Cell " + (i + 1));
        b.onclick = function () { hit(i); }; b.oncontextmenu = function (e) { e.preventDefault(); flag(i); };
        c.push({ b: b, m: 0, o: 0, f: 0, n: 0 });
      })(i);
    }
    B(sd, "New game", init);
    B(sd, "Flag mode: off", function () { fm = !fm; this.textContent = "Flag mode: " + (fm ? "on" : "off"); });
    el("p", "hint", sd, "Click to open. Right-click or use flag mode to mark mines."); init();
  })();
})();
