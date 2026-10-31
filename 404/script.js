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

  /* Switches only flip their own look (used by the 404 page's "does nothing" switch) */
  document.addEventListener("click", function (e) {
    var s = e.target.closest("[role=switch]");
    if (s) s.setAttribute("aria-checked", String(s.getAttribute("aria-checked") !== "true"));
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
  var ids = ["top", "about", "projects", "tools", "arcade", "contact"];
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
    document.querySelectorAll(".tabs").forEach(function (group) {
      var tabs = Array.prototype.slice.call(group.querySelectorAll("[role=tab]"));
      function select(t) {
        tabs.forEach(function (x) {
          var on = x === t;
          x.setAttribute("aria-selected", String(on));
          x.tabIndex = on ? 0 : -1;
          $(x.getAttribute("aria-controls")).hidden = !on;
        });
        t.focus();
        document.dispatchEvent(new CustomEvent("tabsel", { detail: t.dataset.t }));
      }
      tabs.forEach(function (t, i) {
        t.addEventListener("click", function () { select(t); });
        t.addEventListener("keydown", function (e) {
          var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
          if (n === null) return;
          e.preventDefault(); select(tabs[(n + tabs.length) % tabs.length]);
        });
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

  /* ---------- 6b. Arcade: Tic-Tac-Toe, Memory, Reaction, Snake, Typing ---------- */
  (function () {
    var rand = function (n) { return Math.floor(Math.random() * n); };
    var num = function (k) { return parseInt(store(k), 10) || 0; };
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = rand(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

    /* ----- Tic-Tac-Toe (minimax AI) ----- */
    (function () {
      var boardEl = $("ttt"); if (!boardEl) return;
      var b, turn, over = false, first = "X", mode = "hard", token = 0, sc = { w: 0, d: 0, l: 0 }, cells = [];
      var stat = $("tstat");

      /*ttt-ai*/
      var L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      function win(bd) {
        for (var i = 0; i < 8; i++) {
          var l = L[i];
          if (bd[l[0]] && bd[l[0]] === bd[l[1]] && bd[l[0]] === bd[l[2]]) return { p: bd[l[0]], l: l };
        }
        return null;
      }
      function mm(bd, p, d) {
        var w = win(bd);
        if (w) return w.p === "O" ? 10 - d : d - 10;
        if (bd.every(Boolean)) return 0;
        var best = p === "O" ? -99 : 99;
        for (var i = 0; i < 9; i++) if (!bd[i]) {
          bd[i] = p;
          var v = mm(bd, p === "O" ? "X" : "O", d + 1);
          bd[i] = "";
          best = p === "O" ? Math.max(best, v) : Math.min(best, v);
        }
        return best;
      }
      function aiPick(bd, md) {
        var e = [], i;
        for (i = 0; i < 9; i++) if (!bd[i]) e.push(i);
        if (md === "easy" && Math.random() < 0.55) return e[rand(e.length)];
        var best = -99, pick = [];
        e.forEach(function (m) {
          bd[m] = "O"; var v = mm(bd, "X", 1); bd[m] = "";
          if (v > best) { best = v; pick = [m]; } else if (v === best) pick.push(m);
        });
        return pick[rand(pick.length)];
      }
      /*end-ttt-ai*/

      for (var k = 0; k < 9; k++) (function (i) {
        var c = document.createElement("button");
        c.type = "button"; c.className = "cell";
        c.setAttribute("aria-label", "Row " + (Math.floor(i / 3) + 1) + ", column " + (i % 3 + 1));
        c.addEventListener("click", function () { play(i); });
        boardEl.appendChild(c); cells.push(c);
      })(k);

      function labels() { $("l1").textContent = mode === "2p" ? "X" : "You"; $("l3").textContent = mode === "2p" ? "O" : "AI"; }
      function scores() { $("sw").textContent = sc.w; $("sd").textContent = sc.d; $("sl").textContent = sc.l; }
      function render(w) {
        cells.forEach(function (c, i) {
          c.textContent = b[i]; c.dataset.m = b[i];
          c.classList.toggle("win", !!w && w.l.indexOf(i) > -1);
        });
      }
      function say() {
        if (over) return;
        stat.textContent = mode === "2p" ? turn + " to play" : turn === "X" ? "Your turn (X)" : "AI is thinking…";
      }
      function check() {
        var w = win(b); render(w);
        if (!w && !b.every(Boolean)) return false;
        over = true;
        if (!w) { sc.d++; stat.textContent = "It's a draw"; }
        else if (mode === "2p") { if (w.p === "X") sc.w++; else sc.l++; stat.textContent = w.p + " wins!"; }
        else if (w.p === "X") { sc.w++; stat.textContent = "You win! 🎉"; }
        else { sc.l++; stat.textContent = "The AI wins. Try again?"; }
        scores();
        return true;
      }
      function aiTurn() {
        var t = token; say();
        setTimeout(function () {
          if (t !== token || over) return;
          b[aiPick(b, mode)] = "O";
          if (!check()) { turn = "X"; say(); }
        }, 380);
      }
      function play(i) {
        if (over || b[i] || (mode !== "2p" && turn !== "X")) return;
        b[i] = turn;
        if (check()) return;
        turn = turn === "X" ? "O" : "X";
        if (mode !== "2p") aiTurn(); else say();
      }
      function reset(flip) {
        token++; b = ["", "", "", "", "", "", "", "", ""]; over = false;
        if (flip) first = first === "X" ? "O" : "X";
        turn = first;
        render(null); labels(); say();
        if (mode !== "2p" && turn === "O") aiTurn();
      }
      $("tmode").addEventListener("click", function (e) {
        var bt = e.target.closest("button"); if (!bt) return;
        mode = bt.dataset.m;
        Array.prototype.forEach.call(this.children, function (x) { x.setAttribute("aria-pressed", String(x === bt)); });
        sc = { w: 0, d: 0, l: 0 }; first = "X"; scores(); reset(false);
      });
      $("tnew").addEventListener("click", function () { reset(over); });
      scores(); reset(false);
    })();

    /* ----- Memory match ----- */
    (function () {
      var grid = $("mem"); if (!grid) return;
      var icons = ["🐍", "⚡", "🔒", "🚀", "🧠", "🔥", "🎯", "💡"];
      var deck, cards, open, moves, matched, lock, best = num("sg-mem"), stat = $("mstat");
      function info(extra) { stat.textContent = "Moves: " + moves + (best ? " · Best: " + best : "") + (extra || ""); }
      function setup() {
        deck = shuffle(icons.concat(icons)); cards = []; open = []; moves = 0; matched = 0; lock = false;
        grid.textContent = "";
        deck.forEach(function (ic, i) {
          var c = document.createElement("button");
          c.type = "button"; c.className = "mc"; c.textContent = "?";
          c.setAttribute("aria-label", "Card " + (i + 1));
          c.addEventListener("click", function () { flip(i); });
          grid.appendChild(c); cards.push(c);
        });
        info();
      }
      function show(i, on) {
        cards[i].classList.toggle("up", on);
        cards[i].textContent = on ? deck[i] : "?";
        cards[i].setAttribute("aria-label", on ? deck[i] : "Card " + (i + 1));
      }
      function flip(i) {
        var c = cards[i];
        if (lock || c.classList.contains("up") || c.classList.contains("done")) return;
        show(i, true); open.push(i);
        if (open.length < 2) return;
        moves++;
        var a = open[0], z = open[1];
        if (deck[a] === deck[z]) {
          [a, z].forEach(function (x) { cards[x].classList.remove("up"); cards[x].classList.add("done"); });
          open = []; matched++;
          if (matched === icons.length) {
            if (!best || moves < best) { best = moves; store("sg-mem", String(best)); info(" · New best! 🎉"); } else info(" · Done!");
            return;
          }
        } else {
          lock = true;
          setTimeout(function () { show(a, false); show(z, false); open = []; lock = false; }, 800);
        }
        info();
      }
      $("mnew").addEventListener("click", setup);
      setup();
    })();

    /* ----- Reaction test ----- */
    (function () {
      var area = $("rarea"); if (!area) return;
      var st = "idle", t0 = 0, tm = 0, times = [], best = num("sg-react"), stat = $("rstat");
      function setState(s, text, cls) { st = s; area.textContent = text; area.className = "rarea" + (cls ? " " + cls : ""); }
      function stats(last) {
        var avg = Math.round(times.reduce(function (a, c) { return a + c; }, 0) / times.length);
        stat.textContent = "Last: " + last + " ms · Average: " + avg + " ms · Best: " + best + " ms";
      }
      function go() { t0 = performance.now(); setState("go", "Click now!", "go"); }
      function hit() {
        if (st === "idle") { setState("wait", "Wait for the colour…", "wait"); tm = setTimeout(go, 1500 + rand(2500)); }
        else if (st === "wait") { clearTimeout(tm); setState("idle", "Too soon! Click to try again"); }
        else if (st === "go") {
          var ms = Math.round(performance.now() - t0);
          times.push(ms);
          if (!best || ms < best) { best = ms; store("sg-react", String(ms)); }
          setState("idle", ms + " ms · click to go again"); stats(ms);
        }
      }
      area.addEventListener("pointerdown", function (e) { e.preventDefault(); hit(); });
      area.addEventListener("click", function (e) { if (e.detail === 0) hit(); });   /* keyboard */
      document.addEventListener("tabsel", function () { clearTimeout(tm); if (st !== "idle") setState("idle", "Click to start"); });
    })();

    /* ----- Snake ----- */
    (function () {
      var cv = $("sc"); if (!cv) return;
      var ctx = cv.getContext("2d"), N = 15, S = cv.width / N, state = "idle", snake, dir, nd, food, score = 0, timer = 0;
      var best = num("sg-snake"), col = "#ffe21a", stat = $("sstat"), btn = $("sgo"), panel = $("p-snake");
      function info() { stat.textContent = "Score: " + score + " · Best: " + best; }
      function place() { do { food = { x: rand(N), y: rand(N) }; } while (snake.some(function (p) { return p.x === food.x && p.y === food.y; })); }
      function reset() { snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }]; dir = { x: 1, y: 0 }; nd = dir; score = 0; place(); }
      function draw(msg) {
        ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = "#141414";
        for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) if ((i + j) % 2) ctx.fillRect(i * S, j * S, S, S);
        ctx.fillStyle = "#f5f5f0"; ctx.beginPath(); ctx.arc(food.x * S + S / 2, food.y * S + S / 2, S * 0.33, 0, 6.2832); ctx.fill();
        ctx.fillStyle = col;
        snake.forEach(function (p, n) { ctx.globalAlpha = n ? 0.85 : 1; ctx.fillRect(p.x * S + 1, p.y * S + 1, S - 2, S - 2); });
        ctx.globalAlpha = 1;
        if (msg) {
          ctx.fillStyle = "rgba(0,0,0,.62)"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.fillStyle = "#fff"; ctx.font = "700 20px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
          ctx.fillText(msg, cv.width / 2, cv.height / 2 + 7);
        }
      }
      function schedule() { clearInterval(timer); timer = setInterval(tick, Math.max(65, 140 - score * 4)); }
      function over() {
        clearInterval(timer); state = "over";
        if (score > best) { best = score; store("sg-snake", String(best)); }
        btn.textContent = "Play again"; info(); draw("Game over");
      }
      function tick() {
        dir = nd;
        var h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N ||
            snake.some(function (p, i) { return i < snake.length - 1 && p.x === h.x && p.y === h.y; })) return over();
        snake.unshift(h);
        if (h.x === food.x && h.y === food.y) { score++; place(); schedule(); } else snake.pop();
        info(); draw();
      }
      function pause() { if (state !== "run") return; clearInterval(timer); state = "pause"; btn.textContent = "Resume"; draw("Paused"); }
      function toggle() {
        if (state === "run") { pause(); return; }
        if (state === "idle" || state === "over") { reset(); col = getComputedStyle(root).getPropertyValue("--y").trim() || col; }
        state = "run"; btn.textContent = "Pause"; info(); draw(); schedule();
      }
      function steer(x, y) { if (state !== "run" || (x === -dir.x && y === -dir.y)) return; nd = { x: x, y: y }; }
      var keys = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };
      panel.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (keys[e.key]) { steer(keys[e.key][0], keys[e.key][1]); e.preventDefault(); }
        else if (e.key === " " && e.target === cv) { toggle(); e.preventDefault(); }
      });
      btn.addEventListener("click", function () { toggle(); cv.focus({ preventScroll: true }); });
      var sx = 0, sy = 0;
      cv.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; });
      cv.addEventListener("pointerup", function (e) {
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0); else steer(0, dy > 0 ? 1 : -1);
      });
      $("dpad").addEventListener("click", function (e) {
        var d = e.target.closest("button"); if (!d) return;
        var m = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[d.dataset.d]; steer(m[0], m[1]);
      });
      document.addEventListener("tabsel", function (e) { if (e.detail !== "snake") pause(); });
      document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
      reset(); info(); draw("Press Start");
    })();

    /* ----- Typing test ----- */
    (function () {
      var tp = $("tp"); if (!tp) return;
      var texts = [
        "A fast website is a polite website, because it respects the time of everyone who visits it.",
        "Small functions, clear names and honest tests will save you more hours than any clever trick.",
        "Every great project starts as a messy experiment that someone refused to throw away.",
        "Hashing a password is easy, but remembering to salt it is what keeps the attackers away.",
        "The best code is the code you never have to write, and the second best is easy to delete."
      ];
      var tin = $("tin"), out = $("twpm"), target = "", spans = [], t0 = 0, done = false, last = -1, best = num("sg-wpm");
      function bestText() { return "Best: " + (best ? best + " WPM" : "–"); }
      function paint(v) {
        spans.forEach(function (sp, i) { sp.className = i < v.length ? (v[i] === target[i] ? "ok" : "bad") : i === v.length ? "cur" : ""; });
      }
      function newText() {
        var i; do { i = rand(texts.length); } while (i === last);
        last = i; target = texts[i]; t0 = 0; done = false; spans = [];
        tp.textContent = "";
        target.split("").forEach(function (ch) { var s = document.createElement("span"); s.textContent = ch; tp.appendChild(s); spans.push(s); });
        tin.value = ""; tin.readOnly = false; paint(""); out.textContent = bestText();
      }
      function finish(v) {
        done = true; tin.readOnly = true;
        var min = (performance.now() - t0) / 60000, ok = 0, i;
        for (i = 0; i < target.length; i++) if (v[i] === target[i]) ok++;
        var wpm = Math.max(1, Math.round(target.length / 5 / min)), acc = Math.round(ok / target.length * 100), note = "";
        if (acc >= 90 && wpm > best) { best = wpm; store("sg-wpm", String(best)); note = " · New best! 🎉"; }
        out.textContent = wpm + " WPM · " + acc + "% accuracy" + note + (acc < 90 ? " (90%+ needed for a best)" : "");
      }
      tin.addEventListener("input", function () {
        if (done) return;
        if (!t0) t0 = performance.now();
        var v = tin.value; paint(v);
        if (v.length >= target.length) finish(v);
      });
      $("wnew").addEventListener("click", function () { newText(); tin.focus(); });
      newText();
    })();
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
