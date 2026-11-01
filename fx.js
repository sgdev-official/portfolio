/* fx.js: lazy-loaded on first user input. Effects, confetti, Konami matrix rain, command palette. */
(function () {
  "use strict";
  var S = window.SG, $ = S.$, R = S.reduce, D = document, root = D.documentElement;
  var fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  function mk(t, c, p) { var e = D.createElement(t); if (c) e.className = c; (p || D.body).appendChild(e); return e; }
  var accent = function (v) { return getComputedStyle(root).getPropertyValue(v).trim(); };

  /* cursor glow */
  if (fine && !R) {
    var g = mk("div", "cglow"), x = 0, y = 0, tx = 0, ty = 0, on = 0;
    var f = function () {
      x += (tx - x) * .18; y += (ty - y) * .18;
      g.style.transform = "translate(" + x + "px," + y + "px)";
      on = Math.abs(tx - x) + Math.abs(ty - y) > .5 ? requestAnimationFrame(f) : 0;
    };
    addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; g.style.opacity = 1; if (!on) on = requestAnimationFrame(f); }, { passive: true });
  }

  /* card spotlight + tilt, magnetic buttons */
  if (fine) {
    var T = ".card,.lcard,.skills li,.status-card", B = ".btn,.mini";
    D.addEventListener("pointermove", function (e) {
      var t = e.target; if (!t.closest) return;
      var c = t.closest(T);
      if (c) {
        var r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        c.style.setProperty("--mx", px * 100 + "%"); c.style.setProperty("--my", py * 100 + "%");
        if (!R && c.matches(".lcard,.card:not(.wide):not(.gh)")) {
          c.classList.add("tilt");
          c.style.setProperty("--ry", (px - .5) * 8 + "deg"); c.style.setProperty("--rx", (.5 - py) * 8 + "deg");
        }
      }
      var b = t.closest(B);
      if (b && !R) { var q = b.getBoundingClientRect(); b.style.translate = (e.clientX - q.left - q.width / 2) * .2 + "px " + (e.clientY - q.top - q.height / 2) * .3 + "px"; }
    }, { passive: true });
    D.addEventListener("pointerout", function (e) {
      var t = e.target.closest && e.target.closest(T + "," + B);
      if (t && !t.contains(e.relatedTarget)) { t.classList.remove("tilt"); t.style.translate = ""; }
    });
  }

  /* click ripple */
  D.addEventListener("pointerdown", function (e) {
    var b = e.target.closest && e.target.closest(".btn,.mini,.tabs button,.cell,.ckeys button,.seg button");
    if (!b || R) return;
    b.classList.add("rip");
    var r = b.getBoundingClientRect(), z = Math.max(r.width, r.height) * 2, s = mk("i", "rp", b);
    s.style.cssText = "width:" + z + "px;height:" + z + "px;left:" + (e.clientX - r.left - z / 2) + "px;top:" + (e.clientY - r.top - z / 2) + "px";
    setTimeout(function () { s.remove(); }, 600);
  });

  /* confetti */
  var cv, cx, P = [], run = 0;
  function step() {
    cx.clearRect(0, 0, cv.width, cv.height);
    P = P.filter(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += .3; p.l--;
      cx.fillStyle = p.c; cx.globalAlpha = Math.min(1, p.l / 30); cx.fillRect(p.x, p.y, p.r + 2, p.r + 2);
      return p.l > 0;
    });
    run = P.length ? requestAnimationFrame(step) : 0;
    if (!run) cx.clearRect(0, 0, cv.width, cv.height);
  }
  S.confetti = function (x, y, n) {
    if (R) return;
    if (!cv) { cv = mk("canvas", "fxc"); cx = cv.getContext("2d"); }
    cv.width = innerWidth; cv.height = innerHeight;
    x = x == null ? innerWidth / 2 : x; y = y == null ? innerHeight / 3 : y;
    var c = accent("--y");
    for (var i = 0; i < (n || 60); i++) P.push({ x: x, y: y, vx: (Math.random() - .5) * 10, vy: Math.random() * -10 - 2, r: Math.random() * 6, c: i % 3 ? c : "#fff", l: 70 + Math.random() * 30 });
    if (!run) run = requestAnimationFrame(step);
  };

  /* beep (used by games) */
  var ac;
  S.beep = function (f, d) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), v = ac.createGain(); d = d || .15;
      o.frequency.value = f; v.gain.value = .08; o.connect(v); v.connect(ac.destination);
      o.start(); v.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d); o.stop(ac.currentTime + d);
    } catch (e) {}
  };

  /* Konami code -> matrix rain */
  S.rain = function () {
    var o = $("rain"); if (o) { o.click(); return; }
    var c = mk("canvas", "fxc rain"), q = c.getContext("2d"), w = c.width = innerWidth, h = c.height = innerHeight, n = Math.floor(w / 16), d = [], i;
    c.id = "rain";
    for (i = 0; i < n; i++) d[i] = Math.random() * h / 16;
    var t = setInterval(function () {
      q.fillStyle = "rgba(0,0,0,.08)"; q.fillRect(0, 0, w, h); q.fillStyle = "#22c55e"; q.font = "14px monospace";
      for (var i = 0; i < n; i++) {
        q.fillText(String.fromCharCode(0x30A0 + Math.random() * 60), i * 16, d[i] * 16);
        if (d[i] * 16 > h && Math.random() > .975) d[i] = 0;
        d[i]++;
      }
    }, 50);
    function off() { clearInterval(t); c.remove(); D.removeEventListener("keydown", k); }
    function k(e) { if (e.key === "Escape") off(); }
    c.addEventListener("click", off); D.addEventListener("keydown", k);
    S.toast("Matrix mode · click or Esc to exit"); S.confetti();
  };
  var seq = "ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a", keys = [];
  D.addEventListener("keydown", function (e) {
    keys.push(e.key.length > 1 ? e.key : e.key.toLowerCase()); keys = keys.slice(-10);
    if (keys.join() === seq) S.rain();
  });

  /* hero particles (paused when off-screen or tab hidden) */
  (function () {
    var h = D.querySelector(".hero"); if (!h || R || !window.IntersectionObserver) return;
    var c = mk("canvas", "pcv", h), q = c.getContext("2d"), W, H, A = [], m = { x: -99, y: -99 }, on = 0, vis = 1, n = 0, rgb = "255,226,26";
    function sz() { W = c.width = h.offsetWidth; H = c.height = h.offsetHeight; }
    sz(); addEventListener("resize", sz);
    for (var i = 0; i < (W < 700 ? 18 : 38); i++) A.push({ x: Math.random() * W, y: Math.random() * H, vx: Math.random() - .5, vy: Math.random() - .5 });
    h.addEventListener("pointermove", function (e) { var r = h.getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top; }, { passive: true });
    function fr() {
      if (!vis || D.hidden) { on = 0; return; }
      if (n++ % 60 === 0) rgb = accent("--yr");
      q.clearRect(0, 0, W, H);
      A.forEach(function (p, i) {
        p.x += p.vx * .4; p.y += p.vy * .4;
        if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
        var dx = p.x - m.x, dy = p.y - m.y; if (dx * dx + dy * dy < 9000) { p.x += dx * .01; p.y += dy * .01; }
        q.fillStyle = "rgba(" + rgb + ",.5)"; q.fillRect(p.x, p.y, 2, 2);
        for (var j = i + 1; j < A.length; j++) {
          var o = A[j], ex = p.x - o.x, ey = p.y - o.y, e = ex * ex + ey * ey;
          if (e < 12000) { q.strokeStyle = "rgba(" + rgb + "," + .25 * (1 - e / 12000) + ")"; q.beginPath(); q.moveTo(p.x, p.y); q.lineTo(o.x, o.y); q.stroke(); }
        }
      });
      on = requestAnimationFrame(fr);
    }
    new IntersectionObserver(function (en) { vis = en[0].isIntersecting; if (vis && !on) on = requestAnimationFrame(fr); }).observe(h);
    D.addEventListener("visibilitychange", function () { if (!D.hidden && vis && !on) on = requestAnimationFrame(fr); });
  })();

  /* command palette (Ctrl/Cmd+K or "/") */
  var go = function (id) { return function () { var e = $(id); if (e) e.scrollIntoView({ behavior: R ? "auto" : "smooth" }); }; };
  var open = function (u) { return function () { window.open(u, "_blank", "noopener"); }; };
  var th = function (h) { return function () { var b = D.querySelector('#dots [data-c="' + h + '"]'); if (b) b.click(); }; };
  var tab = function (t) { return function () { S.load("lab").then(function () { var b = $("t-" + t); if (b) { b.click(); b.scrollIntoView({ block: "center" }); } }); }; };
  var C = [
    ["Go: Home", go("top")], ["Go: About", go("about")], ["Go: Projects", go("projects")], ["Go: Tools", go("tools")], ["Go: Arcade", go("arcade")], ["Go: Contact", go("contact")],
    ["Open: Blog", open("/blog/")], ["Open: Clock", open("https://www.sgdev.qd.je/clock/")], ["Open: Dev Tools", open("https://www.sgdev.is-cool.dev/devtools/")],
    ["Open: Matrix Terminal", open("https://www.sgdev.is-cool.dev/terminal/")], ["Open: GitHub", open("https://github.com/sgdev-official")],
    ["Theme: JS yellow", th("#ffe21a")], ["Theme: HTML red", th("#cd0d0d")], ["Theme: CSS blue", th("#1b66d2")],
    ["Copy email", function () { S.copy("info@sgdev.qd.je"); }], ["Confetti!", function () { S.confetti(); }], ["Matrix rain (Konami)", S.rain],
    ["Tool: JSON formatter", tab("json")], ["Tool: Base64", tab("b64")], ["Tool: UUID generator", tab("uuid")], ["Tool: Colour converter", tab("color")],
    ["Game: 2048", tab("g2048")], ["Game: Simon", tab("simon")], ["Game: Minesweeper", tab("mines")]
  ];
  S.pal = function () {
    var o = $("pal"); if (o) { o.querySelector("input").focus(); return; }
    o = mk("div", "pal"); o.id = "pal";
    o.innerHTML = '<div class="pbox" role="dialog" aria-label="Command palette"><input placeholder="Type a command or maths… (Esc to close)" aria-label="Command"><ul></ul></div>';
    var inp = o.querySelector("input"), ul = o.querySelector("ul"), L = [], i = 0, back = D.activeElement;
    function mark() { Array.prototype.forEach.call(ul.children, function (li, n) { li.classList.toggle("on", n === i); }); }
    function close() { o.remove(); if (back && back.focus) back.focus(); }
    function runIt(c) { close(); c[1](); }
    function draw() {
      var q = inp.value.trim().toLowerCase();
      L = C.filter(function (c) { return !q || c[0].toLowerCase().indexOf(q) > -1; });
      if (/^[\d\s+\-*\/().^%]+$/.test(q) && /[+\-*\/^%]/.test(q)) {
        try { var r = S.fmt(S.ev(q)); L.unshift(["= " + r + "   (Enter to copy)", function () { S.copy(r); }]); } catch (e) {}
      }
      L = L.slice(0, 9); ul.textContent = ""; i = 0;
      L.forEach(function (c) { var li = mk("li", "", ul); li.textContent = c[0]; li.onclick = function () { runIt(c); }; });
      mark();
    }
    inp.addEventListener("input", draw);
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowDown") { i = (i + 1) % (L.length || 1); mark(); }
      else if (e.key === "ArrowUp") { i = (i - 1 + (L.length || 1)) % (L.length || 1); mark(); }
      else if (e.key === "Enter" && L[i]) runIt(L[i]);
      else return;
      e.preventDefault();
    });
    o.addEventListener("pointerdown", function (e) { if (e.target === o) close(); });
    draw(); inp.focus();
  };

  /* headings: quick scramble on hover */
  if (fine && !R) {
    var ch = "abcdefghijklmnopqrstuvwxyz";
    D.querySelectorAll("h2.h2").forEach(function (h) {
      var txt = h.textContent, busy = 0;
      h.addEventListener("pointerenter", function () {
        if (busy) return; busy = 1; var n = 0;
        var t = setInterval(function () {
          h.textContent = txt.split("").map(function (c, i) { return i < n || c === " " || /[^a-z]/i.test(c) ? c : ch[Math.floor(Math.random() * 26)]; }).join("");
          if (++n > txt.length) { clearInterval(t); h.textContent = txt; busy = 0; }
        }, 22);
      });
    });
  }
})();
