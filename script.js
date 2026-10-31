/* Shubhomoy (Sgdev) portfolio — script.js
   Core:   mobile menu, active nav, scroll progress, scroll reveal
   Extras: fidget spinner, live GitHub stats (lazy), calculator, SHA-256, password generator,
           typed roles, accent picker, copy buttons, back-to-top
   No libraries. Everything non-critical starts when the browser is idle. */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");

  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); };

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---------- Toast + clipboard ---------- */
  var toastEl = $("toast"), toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }
  function copy(text) {
    function fallback() {
      var t = document.createElement("textarea");
      t.value = text; t.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); toast("Copied"); } catch (e) { toast("Copy failed"); }
      document.body.removeChild(t);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast("Copied"); }, fallback);
    } else fallback();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy],[data-copy-from]");
    if (!b) return;
    if (b.dataset.copy) copy(b.dataset.copy);
    else {
      var src = $(b.dataset.copyFrom);
      if (src && src.dataset.val) copy(src.dataset.val);
    }
  });

  /* ---------- 1. Mobile menu ---------- */
  var burger = $("burger"), menu = $("menu");
  function setMenu(open) {
    menu.classList.toggle("show", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  burger.addEventListener("click", function () { setMenu(burger.getAttribute("aria-expanded") !== "true"); });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  /* ---------- 2. Active nav + scroll progress (one throttled handler) ---------- */
  var links = {};
  document.querySelectorAll(".nb[data-s]").forEach(function (a) { links[a.dataset.s] = a; });
  var ids = ["top", "about", "projects", "tools", "contact"];
  var bar = $("progress"), upBtn = $("up"), ticking = false;
  function onScroll() {
    ticking = false;
    var sy = window.scrollY, y = sy + window.innerHeight * 0.35, current = "top";
    ids.forEach(function (id) {
      var el = $(id);
      if (el && el.offsetTop <= y) current = id;
    });
    Object.keys(links).forEach(function (id) { links[id].classList.toggle("active", id === current); });
    var max = root.scrollHeight - window.innerHeight;
    bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, sy / max) : 0) + ")";
    upBtn.style.visibility = sy > 400 ? "visible" : "hidden";
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  upBtn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); });
  onScroll();

  /* ---------- 3. Scroll reveal ---------- */
  var items = document.querySelectorAll(".card, .skills li, .contact, .status-card, .tool");
  items.forEach(function (el) { el.classList.add("rv"); });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- 4. Fidget spinner ---------- */
  (function () {
    var btn = $("spinner"); if (!btn) return;
    var svg = btn.querySelector("svg"), rpmEl = $("rpm"), bestEl = $("best");
    var angle = 0, vel = 0, last = 0, raf = 0;      /* degrees, degrees per millisecond */
    var dragging = false, moved = 0, lastA = 0, lastT = 0, pid = null;
    var best = parseInt(store("sg-spin-best"), 10) || 0, MAX = 6;
    bestEl.textContent = best;

    function ang(e) {
      var r = btn.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    }
    function rpm() { return Math.round(Math.abs(vel) * 166.67); }
    function paint() {
      svg.style.transform = "rotate(" + angle + "deg)";
      var r = rpm();
      rpmEl.textContent = r;
      btn.classList.toggle("fast", r > 250);
      if (r > best) { best = r; bestEl.textContent = best; store("sg-spin-best", String(best)); }
    }
    function loop(t) {
      var dt = Math.min(40, t - last || 16); last = t;
      if (!dragging) {
        angle = (angle + vel * dt) % 360;
        vel *= Math.exp(-0.00065 * dt);
        if (Math.abs(vel) < 0.012) { vel = 0; paint(); raf = 0; return; }
      }
      paint();
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
    function kick() { vel = Math.max(-MAX, Math.min(MAX, (vel >= 0 ? 1 : -1) * (Math.abs(vel) + 1.3))); start(); }

    btn.addEventListener("pointerdown", function (e) {
      dragging = true; moved = 0; pid = e.pointerId;
      try { btn.setPointerCapture(pid); } catch (err) {}
      lastA = ang(e); lastT = performance.now(); vel = 0; start();
    });
    btn.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var a = ang(e), t = performance.now(), d = a - lastA;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      angle += d; moved += Math.abs(d);
      var dt = Math.max(1, t - lastT);
      vel = Math.max(-MAX, Math.min(MAX, vel * 0.6 + (d / dt) * 0.4));
      lastA = a; lastT = t;
    });
    function up(e) {
      if (!dragging) return;
      dragging = false;
      try { btn.releasePointerCapture(pid); } catch (err) {}
      if (performance.now() - lastT > 80) vel = 0;   /* held still before release: no fling */
      if (moved < 6) kick();                          /* a tap gives it a push */
      start();
    }
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("click", function (e) { if (e.detail === 0) kick(); });  /* keyboard: Enter / Space */
  })();

  /* ---------- 5. Calculator ---------- */
  var calcApi = (function () {
    /* Safe recursive-descent parser. No eval(). */
    function evaluate(src) {
      var s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/π/g, "pi").replace(/\s+/g, "");
      var open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
      while (open-- > 0) s += ")";
      var re = /\d+\.?\d*|\.\d+|sqrt|pi|[-+*\/^%()]/y, tk = [], pos = 0, m;
      while (pos < s.length) {
        re.lastIndex = pos; m = re.exec(s);
        if (!m) throw new Error("token");
        tk.push(m[0]); pos = re.lastIndex;
      }
      var i = 0;
      function peek() { return tk[i]; }
      function expr() { var v = term(), o; while ((o = peek()) === "+" || o === "-") { i++; var r = term(); v = o === "+" ? v + r : v - r; } return v; }
      function term() { var v = unary(), o; while ((o = peek()) === "*" || o === "/") { i++; var r = unary(); v = o === "*" ? v * r : v / r; } return v; }
      function unary() {
        var o = peek();
        if (o === "-") { i++; return -unary(); }
        if (o === "+") { i++; return unary(); }
        return pow();
      }
      function pow() { var b = post(); if (peek() === "^") { i++; return Math.pow(b, unary()); } return b; }
      function post() { var v = prim(); while (peek() === "%") { i++; v /= 100; } return v; }
      function prim() {
        var t = tk[i++];
        if (t === undefined) throw new Error("end");
        if (t === "(") { var v = expr(); if (tk[i++] !== ")") throw new Error("paren"); return v; }
        if (t === "sqrt") {
          if (tk[i++] !== "(") throw new Error("sqrt");
          var x = expr(); if (tk[i++] !== ")") throw new Error("paren");
          return Math.sqrt(x);
        }
        if (t === "pi") return Math.PI;
        if (/^[\d.]/.test(t)) return parseFloat(t);
        throw new Error("bad");
      }
      var out = expr();
      if (i !== tk.length) throw new Error("extra");
      return out;
    }
    function fmt(n) {
      if (typeof n !== "number" || !isFinite(n)) throw new Error("range");
      return String(parseFloat(n.toPrecision(12)));
    }

    var exprEl = $("cexpr"), resEl = $("cres"), histEl = $("hist"), box = $("calc");
    var expr = "", fresh = false, hist = [];
    if (!exprEl) return { evaluate: evaluate, fmt: fmt };

    function preview() {
      resEl.textContent = "";
      if (!/[-+×÷^%√]|sqrt|−/.test(expr)) return;
      try { resEl.textContent = "= " + fmt(evaluate(expr)); } catch (e) {}
    }
    function show() { exprEl.textContent = expr || "0"; preview(); }
    function renderHist() {
      histEl.textContent = "";
      if (!hist.length) {
        var li = document.createElement("li"); li.className = "empty"; li.textContent = "Your calculations show up here.";
        histEl.appendChild(li); return;
      }
      hist.forEach(function (h) {
        var li = document.createElement("li"), b = document.createElement("b");
        b.textContent = h.r; li.appendChild(b); li.appendChild(document.createTextNode(h.e));
        li.addEventListener("click", function () { expr = h.r; fresh = true; show(); });
        histEl.appendChild(li);
      });
    }
    function press(k) {
      var isOp = /^[+×÷−^%]$/.test(k);
      if (k === "C") { expr = ""; fresh = false; }
      else if (k === "⌫") {
        if (/sqrt\($/.test(expr)) expr = expr.slice(0, -5); else expr = expr.slice(0, -1);
        fresh = false;
      } else if (k === "=") {
        if (!expr) return;
        try {
          var r = fmt(evaluate(expr));
          hist.unshift({ e: expr + " =", r: r }); hist = hist.slice(0, 6); renderHist();
          expr = r; fresh = true; show(); resEl.textContent = ""; return;
        } catch (e) { resEl.textContent = "Can't calculate that"; return; }
      } else {
        if (fresh && !isOp) expr = "";
        fresh = false;
        if (isOp && !expr && k !== "−") return;
        if (/^[+×÷−^]$/.test(k) && /[+×÷−^]$/.test(expr)) expr = expr.slice(0, -1);
        if (expr.length < 60) expr += k;
      }
      show();
    }
    $("ckeys").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (b) press(b.dataset.k);
    });
    var map = { "*": "×", "/": "÷", "-": "−", "p": "π" };
    box.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key;
      if (/^[0-9.+^%()]$/.test(k)) press(k);
      else if (map[k]) press(map[k]);
      else if (k === "Enter" || k === "=") press("=");
      else if (k === "Backspace") press("⌫");
      else if (k === "Escape" || k === "c" || k === "C") press("C");
      else if (k === "s") press("sqrt(");
      else return;
      e.preventDefault();
    });
    show();
    return { evaluate: evaluate, fmt: fmt };
  })();

  /* ---------- 6. Tabs, SHA-256, password generator ---------- */
  (function () {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tabs [role=tab]"));
    function select(t) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute("aria-selected", String(on));
        x.tabIndex = on ? 0 : -1;
        $(x.getAttribute("aria-controls")).hidden = !on;
      });
      t.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
        if (n === null) return;
        e.preventDefault(); select(tabs[(n + tabs.length) % tabs.length]);
      });
    });

    /* SHA-256 */
    var hin = $("hin"), hout = $("hout");
    function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
    if (hin) hin.addEventListener("input", function () {
      if (!(window.crypto && crypto.subtle)) { hout.textContent = "Needs HTTPS to hash in the browser."; return; }
      if (!hin.value) { hout.textContent = "Waiting for input…"; hout.dataset.val = ""; return; }
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(hin.value)).then(function (b) {
        var h = hex(b); hout.textContent = h; hout.dataset.val = h;
      });
    });

    /* Password generator (crypto.getRandomValues + rejection sampling) */
    var pout = $("pout"), plen = $("plen");
    function rnd(n) {
      var lim = Math.floor(4294967296 / n) * n, a = new Uint32Array(1);
      do { crypto.getRandomValues(a); } while (a[0] >= lim);
      return a[0] % n;
    }
    function gen() {
      if (!(window.crypto && crypto.getRandomValues)) { pout.textContent = "Not supported in this browser."; return; }
      var sets = ["abcdefghijkmnopqrstuvwxyz"];
      if ($("pu").checked) sets.push("ABCDEFGHJKLMNPQRSTUVWXYZ");
      if ($("pn").checked) sets.push("23456789");
      if ($("ps").checked) sets.push("!@#$%^&*-_=+?");
      var len = +plen.value, all = sets.join(""), out = [], i;
      sets.forEach(function (s) { out.push(s[rnd(s.length)]); });   /* at least one of each chosen type */
      while (out.length < len) out.push(all[rnd(all.length)]);
      for (i = out.length - 1; i > 0; i--) { var j = rnd(i + 1), t = out[i]; out[i] = out[j]; out[j] = t; }
      var pw = out.join("");
      pout.textContent = pw; pout.dataset.val = pw;
      var bits = Math.round(len * Math.log(all.length) / Math.LN2);
      $("pstr").textContent = "About " + bits + " bits of entropy · " + (bits < 60 ? "okay for low-risk use" : bits < 90 ? "strong" : "very strong");
    }
    if (pout) {
      $("pgen").addEventListener("click", gen);
      plen.addEventListener("input", function () { $("plenv").textContent = plen.value; gen(); });
      ["pu", "pn", "ps"].forEach(function (id) { $(id).addEventListener("change", gen); });
      gen();
    }
  })();

  /* ---------- 7. Idle work: typed roles, accent picker, live GitHub ---------- */
  idle(function () {
    /* Typed roles */
    var typed = $("typed");
    if (typed && !reduce) {
      var words = ["FastAPI backends", "AI chat tools", "captcha & security systems", "RF telemetry research", "fast static sites"];
      var wi = 0, ci = words[0].length, del = true;
      (function tick() {
        var w = words[wi], d = 70;
        if (del) {
          ci--; d = 35;
          if (ci <= 0) { del = false; wi = (wi + 1) % words.length; ci = 0; d = 300; }
        } else {
          ci++; d = 75;
          if (ci >= words[wi].length) { del = true; d = 1700; }
        }
        typed.textContent = words[wi].slice(0, ci) || "\u00a0";
        setTimeout(tick, d);
      })();
    }

    /* Accent picker */
    var dots = $("dots");
    if (dots) {
      var colors = [["#ffe21a", "Yellow"], ["#22d3ee", "Cyan"], ["#4ade80", "Green"], ["#f472b6", "Pink"], ["#fb923c", "Orange"]];
      var cur = (store("sg-accent") || "#ffe21a").toLowerCase();
      var apply = function (hex) {
        var rs = root.style;
        rs.setProperty("--y", hex);
        rs.setProperty("--yr", parseInt(hex.slice(1, 3), 16) + "," + parseInt(hex.slice(3, 5), 16) + "," + parseInt(hex.slice(5, 7), 16));
        Array.prototype.forEach.call(dots.children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.c === hex)); });
      };
      colors.forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button"; b.dataset.c = c[0]; b.style.background = c[0];
        b.setAttribute("aria-label", c[1] + " accent");
        b.addEventListener("click", function () { apply(c[0]); store("sg-accent", c[0]); });
        dots.appendChild(b);
      });
      apply(cur);
    }

    /* GitHub live stats: fetched only when the card is near the screen, cached for 1 hour */
    var box = $("gh"); if (!box) return;
    var U = "sgdev-official", K = "sg-gh", note = $("ghnote"), done = false;
    function countUp(el, to) {
      if (reduce || !to) { el.textContent = to; return; }
      var t0 = performance.now();
      (function step(t) {
        var p = Math.min(1, (t - t0) / 700);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }
    function paint(d) {
      box.querySelectorAll("[data-k]").forEach(function (b) { countUp(b, d.u[b.dataset.k] || 0); });
      var ul = $("repos"); ul.textContent = "";
      d.r.forEach(function (r) {
        var li = document.createElement("li"), a = document.createElement("a"),
            b = document.createElement("b"), s = document.createElement("span"), sm = document.createElement("small");
        a.href = r.url; a.target = "_blank"; a.rel = "noopener";
        b.textContent = r.name;
        s.textContent = r.desc || "No description yet.";
        sm.textContent = [r.lang, "★ " + r.stars].filter(Boolean).join(" · ");
        a.appendChild(b); a.appendChild(s); a.appendChild(sm); li.appendChild(a); ul.appendChild(li);
      });
    }
    function load() {
      if (done) return; done = true;
      try {
        var c = JSON.parse(store(K));
        if (c && Date.now() - c.t < 36e5) { paint(c.d); return; }
      } catch (e) {}
      var api = "https://api.github.com/users/" + U;
      function j(r) { if (!r.ok) throw new Error("http"); return r.json(); }
      Promise.all([fetch(api).then(j), fetch(api + "/repos?sort=pushed&per_page=4").then(j)]).then(function (res) {
        var d = {
          u: { public_repos: res[0].public_repos, followers: res[0].followers, following: res[0].following },
          r: res[1].filter(function (r) { return !r.fork; }).slice(0, 4).map(function (r) {
            return { name: r.name, url: r.html_url, desc: r.description, lang: r.language, stars: r.stargazers_count };
          })
        };
        store(K, JSON.stringify({ t: Date.now(), d: d }));
        paint(d);
      }).catch(function () { note.textContent = "Live stats are unavailable right now. The GitHub link below still works."; });
    }
    if ("IntersectionObserver" in window) {
      var gio = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { load(); gio.disconnect(); }
      }, { rootMargin: "300px" });
      gio.observe(box);
    } else load();
  });
})();
