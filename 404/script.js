/* Sgdev 404 page — everything (DOM + logic) is built from JavaScript. No libraries. */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");

  /* ================= helpers ================= */
  var $ = function (id) { return document.getElementById(id); };
  var rand = function (n) { return Math.floor(Math.random() * n); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); };

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  var num = function (k) { return parseInt(store(k), 10) || 0; };
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = rand(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* h("div.cls#id", {attr:..., text:..., on:{click:fn}}, child, child...) */
  function h(sel, props) {
    var m = sel.match(/^([\w-]+)((?:[.#][\w-]+)*)$/), el = document.createElement(m[1]);
    (m[2].match(/[.#][\w-]+/g) || []).forEach(function (p) {
      if (p[0] === "#") el.id = p.slice(1); else el.classList.add(p.slice(1));
    });
    var kids = Array.prototype.slice.call(arguments, 2);
    if (props && (props.nodeType || typeof props === "string" || Array.isArray(props))) { kids.unshift(props); props = null; }
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (k === "text") el.textContent = v;
      else if (k === "on") Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === "dataset") Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false && v != null) el.setAttribute(k, v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (Array.isArray(c)) add(c);
        else if (c != null && c !== false) el.appendChild(c.nodeType ? c : document.createTextNode(c));
      });
    })(kids);
    return el;
  }

  /* ================= toast + clipboard ================= */
  var toastEl = h("div.toast#toast", { role: "status", "aria-live": "polite" }), toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }
  function copy(text) {
    function fallback() {
      var t = h("textarea", { style: "position:fixed;opacity:0" }); t.value = text;
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); toast("Copied"); } catch (e) { toast("Copy failed"); }
      t.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast("Copied"); }, fallback);
    else fallback();
  }
  function copyBtn(srcId) {
    return h("button.mini", { type: "button", text: "Copy", on: { click: function () { var s = $(srcId); if (s && s.dataset.val) copy(s.dataset.val); } } });
  }

  /* ================= tab widget ================= */
  /* defs: [{id, label, build: fn -> element}] */
  function tabWidget(label, defs) {
    var tabs = [], panels = [];
    var list = h("div.tabs", { role: "tablist", "aria-label": label });
    defs.forEach(function (d, i) {
      var t = h("button#t-" + d.id, { role: "tab", "aria-controls": "p-" + d.id, "aria-selected": String(i === 0), tabindex: i ? "-1" : null, text: d.label, dataset: { t: d.id } });
      var p = h("div.panel#p-" + d.id, { role: "tabpanel", "aria-labelledby": "t-" + d.id, hidden: i !== 0 }, d.build());
      tabs.push(t); panels.push(p); list.appendChild(t);
    });
    function select(t) {
      tabs.forEach(function (x, i) {
        var on = x === t;
        x.setAttribute("aria-selected", String(on)); x.tabIndex = on ? 0 : -1; panels[i].hidden = !on;
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
    return h("div.tool", list, panels);
  }

  /* ================= tools ================= */
  function buildCalculator() {
    /* Safe recursive-descent parser. No eval(). */
    function evaluate(src) {
      var s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/π/g, "pi").replace(/\s+/g, "");
      var open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
      while (open-- > 0) s += ")";
      var re = /\d+\.?\d*|\.\d+|sqrt|pi|[-+*\/^%()]/y, tk = [], pos = 0, m;
      while (pos < s.length) { re.lastIndex = pos; m = re.exec(s); if (!m) throw new Error("token"); tk.push(m[0]); pos = re.lastIndex; }
      var i = 0, peek = function () { return tk[i]; };
      function expr() { var v = term(), o; while ((o = peek()) === "+" || o === "-") { i++; var r = term(); v = o === "+" ? v + r : v - r; } return v; }
      function term() { var v = unary(), o; while ((o = peek()) === "*" || o === "/") { i++; var r = unary(); v = o === "*" ? v * r : v / r; } return v; }
      function unary() { var o = peek(); if (o === "-") { i++; return -unary(); } if (o === "+") { i++; return unary(); } return pow(); }
      function pow() { var b = post(); if (peek() === "^") { i++; return Math.pow(b, unary()); } return b; }
      function post() { var v = prim(); while (peek() === "%") { i++; v /= 100; } return v; }
      function prim() {
        var t = tk[i++];
        if (t === undefined) throw new Error("end");
        if (t === "(") { var v = expr(); if (tk[i++] !== ")") throw new Error("paren"); return v; }
        if (t === "sqrt") { if (tk[i++] !== "(") throw new Error("sqrt"); var x = expr(); if (tk[i++] !== ")") throw new Error("paren"); return Math.sqrt(x); }
        if (t === "pi") return Math.PI;
        if (/^[\d.]/.test(t)) return parseFloat(t);
        throw new Error("bad");
      }
      var out = expr();
      if (i !== tk.length) throw new Error("extra");
      return out;
    }
    function fmt(n) { if (typeof n !== "number" || !isFinite(n)) throw new Error("range"); return String(parseFloat(n.toPrecision(12))); }

    var keys = [
      ["C","fn"],["(","fn"],[")","fn"],["⌫","fn","Backspace"],
      ["sqrt(","fn","√"],["^","fn"],["%","fn"],["÷","op"],
      ["7"],["8"],["9"],["×","op"],
      ["4"],["5"],["6"],["−","op"],
      ["1"],["2"],["3"],["+","op"],
      ["π","fn"],["0"],["."],["=","eq"]
    ];
    var exprEl = h("div#cexpr", { text: "0" }), resEl = h("output#cres"), histEl = h("ol.hist#hist");
    var expr = "", fresh = false, hist = [];

    function preview() {
      resEl.textContent = "";
      if (!/[-+×÷^%√]|sqrt|−/.test(expr)) return;
      try { resEl.textContent = "= " + fmt(evaluate(expr)); } catch (e) {}
    }
    function show() { exprEl.textContent = expr || "0"; preview(); }
    function renderHist() {
      histEl.textContent = "";
      if (!hist.length) { histEl.appendChild(h("li.empty", { text: "Your calculations show up here." })); return; }
      hist.forEach(function (x) {
        histEl.appendChild(h("li", { on: { click: function () { expr = x.r; fresh = true; show(); } } }, h("b", { text: x.r }), x.e));
      });
    }
    function press(k) {
      var isOp = /^[+×÷−^%]$/.test(k);
      if (k === "C") { expr = ""; fresh = false; }
      else if (k === "⌫") { expr = /sqrt\($/.test(expr) ? expr.slice(0, -5) : expr.slice(0, -1); fresh = false; }
      else if (k === "=") {
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
    var map = { "*": "×", "/": "÷", "-": "−", p: "π" };
    var box = h("div.calc#calc", {
      tabindex: "0", "aria-label": "Calculator. You can type with your keyboard.",
      on: { keydown: function (e) {
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
      } }
    },
      h("div.cdisp", resEl, exprEl),
      h("div.ckeys", keys.map(function (k) {
        return h("button", { "class": k[1] || null, "aria-label": k[2] && k[2] !== "√" ? k[2] : null, text: k[2] === "√" ? "√" : k[0], on: { click: function () { press(k[0]); } } });
      }))
    );
    renderHist();
    return h("div.calcwrap", box, h("div.histbox", h("h3", { text: "History" }), histEl));
  }

  function buildHash() {
    var out = h("output#hout.mono", { text: "Waiting for input…" });
    var inp = h("textarea#hin", { rows: "4", placeholder: "Hello, Sgdev", on: { input: function () {
      if (!(window.crypto && crypto.subtle)) { out.textContent = "Needs HTTPS to hash in the browser."; return; }
      if (!inp.value) { out.textContent = "Waiting for input…"; out.dataset.val = ""; return; }
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(inp.value)).then(function (b) {
        var hx = Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
        out.textContent = hx; out.dataset.val = hx;
      });
    } } });
    return [h("label", { "for": "hin", text: "Type or paste text" }), inp,
            h("label", { "for": "hout", text: "SHA-256 hash" }), h("div.outrow", out, copyBtn("hout"))];
  }

  function buildPassword() {
    var out = h("output#pout.mono", { text: "–" }), lenV = h("b#plenv", { text: "16" }), strength = h("p.pstr#pstr");
    var len = h("input#plen", { type: "range", min: "8", max: "64", value: "16", on: { input: function () { lenV.textContent = len.value; gen(); } } });
    function chk(id, label) { return h("label.chk", h("input#" + id, { type: "checkbox", checked: true, on: { change: function () { gen(); } } }), " " + label); }
    var cu = chk("pu", "A–Z"), cn = chk("pn", "0–9"), cs = chk("ps", "Symbols");
    function rnd(n) {
      var lim = Math.floor(4294967296 / n) * n, a = new Uint32Array(1);
      do { crypto.getRandomValues(a); } while (a[0] >= lim);
      return a[0] % n;
    }
    function gen() {
      if (!(window.crypto && crypto.getRandomValues)) { out.textContent = "Not supported in this browser."; return; }
      var sets = ["abcdefghijkmnopqrstuvwxyz"];
      if (cu.firstChild.checked) sets.push("ABCDEFGHJKLMNPQRSTUVWXYZ");
      if (cn.firstChild.checked) sets.push("23456789");
      if (cs.firstChild.checked) sets.push("!@#$%^&*-_=+?");
      var n = +len.value, all = sets.join(""), pw = [], i;
      sets.forEach(function (s) { pw.push(s[rnd(s.length)]); });
      while (pw.length < n) pw.push(all[rnd(all.length)]);
      for (i = pw.length - 1; i > 0; i--) { var j = rnd(i + 1), t = pw[i]; pw[i] = pw[j]; pw[j] = t; }
      out.textContent = out.dataset.val = pw.join("");
      var bits = Math.round(n * Math.log(all.length) / Math.LN2);
      strength.textContent = "About " + bits + " bits of entropy · " + (bits < 60 ? "okay for low-risk use" : bits < 90 ? "strong" : "very strong");
    }
    var el = [h("div.outrow", out, copyBtn("pout"), h("button.mini", { type: "button", text: "New", on: { click: gen } })),
              h("div.popts", h("label.rng", "Length ", lenV, len), cu, cn, cs), strength];
    gen();
    return el;
  }

  /* ================= arcade ================= */
  function buildTTT() {
    var b, turn, over = false, first = "X", mode = "hard", token = 0, sc = { w: 0, d: 0, l: 0 }, cells = [];
    var stat = h("p.gstat#tstat", { "aria-live": "polite" });
    var l1 = h("i", { text: "You" }), l3 = h("i", { text: "AI" }), sw = h("b"), sd = h("b"), sl = h("b");
    var L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    function win(bd) {
      for (var i = 0; i < 8; i++) { var l = L[i]; if (bd[l[0]] && bd[l[0]] === bd[l[1]] && bd[l[0]] === bd[l[2]]) return { p: bd[l[0]], l: l }; }
      return null;
    }
    function mm(bd, p, d) {
      var w = win(bd);
      if (w) return w.p === "O" ? 10 - d : d - 10;
      if (bd.every(Boolean)) return 0;
      var best = p === "O" ? -99 : 99;
      for (var i = 0; i < 9; i++) if (!bd[i]) {
        bd[i] = p; var v = mm(bd, p === "O" ? "X" : "O", d + 1); bd[i] = "";
        best = p === "O" ? Math.max(best, v) : Math.min(best, v);
      }
      return best;
    }
    function aiPick() {
      var e = [], i;
      for (i = 0; i < 9; i++) if (!b[i]) e.push(i);
      if (mode === "easy" && Math.random() < 0.55) return e[rand(e.length)];
      var best = -99, pick = [];
      e.forEach(function (m) {
        b[m] = "O"; var v = mm(b, "X", 1); b[m] = "";
        if (v > best) { best = v; pick = [m]; } else if (v === best) pick.push(m);
      });
      return pick[rand(pick.length)];
    }
    var board = h("div.ttt#ttt", { role: "group", "aria-label": "Tic-Tac-Toe board" });
    for (var k = 0; k < 9; k++) (function (i) {
      var c = h("button.cell", { type: "button", "aria-label": "Row " + (Math.floor(i / 3) + 1) + ", column " + (i % 3 + 1), on: { click: function () { play(i); } } });
      board.appendChild(c); cells.push(c);
    })(k);
    function scores() { sw.textContent = sc.w; sd.textContent = sc.d; sl.textContent = sc.l; }
    function render(w) { cells.forEach(function (c, i) { c.textContent = b[i]; c.dataset.m = b[i]; c.classList.toggle("win", !!w && w.l.indexOf(i) > -1); }); }
    function say() { if (!over) stat.textContent = mode === "2p" ? turn + " to play" : turn === "X" ? "Your turn (X)" : "AI is thinking…"; }
    function check() {
      var w = win(b); render(w);
      if (!w && !b.every(Boolean)) return false;
      over = true;
      if (!w) { sc.d++; stat.textContent = "It's a draw"; }
      else if (mode === "2p") { if (w.p === "X") sc.w++; else sc.l++; stat.textContent = w.p + " wins!"; }
      else if (w.p === "X") { sc.w++; stat.textContent = "You win! 🎉"; }
      else { sc.l++; stat.textContent = "The AI wins. Try again?"; }
      scores(); return true;
    }
    function aiTurn() {
      var t = token; say();
      setTimeout(function () { if (t !== token || over) return; b[aiPick()] = "O"; if (!check()) { turn = "X"; say(); } }, 380);
    }
    function play(i) {
      if (over || b[i] || (mode !== "2p" && turn !== "X")) return;
      b[i] = turn;
      if (check()) return;
      turn = turn === "X" ? "O" : "X";
      if (mode !== "2p") aiTurn(); else say();
    }
    function reset(flip) {
      token++; b = ["","","","","","","","",""]; over = false;
      if (flip) first = first === "X" ? "O" : "X";
      turn = first; render(null);
      l1.textContent = mode === "2p" ? "X" : "You"; l3.textContent = mode === "2p" ? "O" : "AI";
      say();
      if (mode !== "2p" && turn === "O") aiTurn();
    }
    var seg = h("div.seg#tmode", { role: "group", "aria-label": "Game mode", on: { click: function (e) {
      var bt = e.target.closest("button"); if (!bt) return;
      mode = bt.dataset.m;
      Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute("aria-pressed", String(x === bt)); });
      sc = { w: 0, d: 0, l: 0 }; first = "X"; scores(); reset(false);
    } } }, [["easy", "Easy"], ["hard", "Unbeatable"], ["2p", "2 players"]].map(function (m) {
      return h("button", { type: "button", "aria-pressed": String(m[0] === "hard"), text: m[1], dataset: { m: m[0] } });
    }));
    var el = h("div.gwrap", board, h("div.gside", stat, seg,
      h("div.score", h("span", sw, l1), h("span", sd, h("i", { text: "Draw" })), h("span", sl, l3)),
      h("button.mini.big", { type: "button", text: "New game", on: { click: function () { reset(over); } } })));
    scores(); reset(false);
    return el;
  }

  function buildMemory() {
    var icons = ["🐍","⚡","🔒","🚀","🧠","🔥","🎯","💡"];
    var deck, cards, open, moves, matched, lock, best = num("sg-mem");
    var stat = h("p.gstat#mstat", { "aria-live": "polite" }), grid = h("div.mem#mem", { role: "group", "aria-label": "Memory cards" });
    function info(x) { stat.textContent = "Moves: " + moves + (best ? " · Best: " + best : "") + (x || ""); }
    function show(i, on) {
      cards[i].classList.toggle("up", on); cards[i].textContent = on ? deck[i] : "?";
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
    function setup() {
      deck = shuffle(icons.concat(icons)); cards = []; open = []; moves = 0; matched = 0; lock = false;
      grid.textContent = "";
      deck.forEach(function (ic, i) {
        var c = h("button.mc", { type: "button", text: "?", "aria-label": "Card " + (i + 1), on: { click: function () { flip(i); } } });
        grid.appendChild(c); cards.push(c);
      });
      info();
    }
    setup();
    return h("div.gwrap", grid, h("div.gside", stat, h("p.hint", { text: "Find all 8 pairs in as few moves as you can." }),
      h("button.mini.big", { type: "button", text: "Shuffle", on: { click: setup } })));
  }

  function buildReaction() {
    var st = "idle", t0 = 0, tm = 0, times = [], best = num("sg-react");
    var area = h("button.rarea#rarea", { type: "button", text: "Click to start" });
    var stat = h("p.gstat#rstat", { "aria-live": "polite", text: "Click the box, wait for it to change colour, then click as fast as you can." });
    function setState(s, text, cls) { st = s; area.textContent = text; area.className = "rarea" + (cls ? " " + cls : ""); }
    function hit() {
      if (st === "idle") { setState("wait", "Wait for the colour…", "wait"); tm = setTimeout(function () { t0 = performance.now(); setState("go", "Click now!", "go"); }, 1500 + rand(2500)); }
      else if (st === "wait") { clearTimeout(tm); setState("idle", "Too soon! Click to try again"); }
      else {
        var ms = Math.round(performance.now() - t0); times.push(ms);
        if (!best || ms < best) { best = ms; store("sg-react", String(ms)); }
        setState("idle", ms + " ms · click to go again");
        var avg = Math.round(times.reduce(function (a, c) { return a + c; }, 0) / times.length);
        stat.textContent = "Last: " + ms + " ms · Average: " + avg + " ms · Best: " + best + " ms";
      }
    }
    area.addEventListener("pointerdown", function (e) { e.preventDefault(); hit(); });
    area.addEventListener("click", function (e) { if (e.detail === 0) hit(); });
    document.addEventListener("tabsel", function () { clearTimeout(tm); if (st !== "idle") setState("idle", "Click to start"); });
    return [area, stat];
  }

  function buildSnake() {
    var cv = h("canvas#sc", { width: "300", height: "300", tabindex: "0", "aria-label": "Snake game. Use the arrow keys or WASD." });
    var ctx = cv.getContext("2d"), N = 15, S = cv.width / N, state = "idle", snake, dir, nd, food, score = 0, timer = 0;
    var best = num("sg-snake"), col = "#ffe21a";
    var stat = h("p.gstat#sstat", { "aria-live": "off" }), btn = h("button.mini.big#sgo", { type: "button", text: "Start" });
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
      var hd = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (hd.x < 0 || hd.y < 0 || hd.x >= N || hd.y >= N ||
          snake.some(function (p, i) { return i < snake.length - 1 && p.x === hd.x && p.y === hd.y; })) return over();
      snake.unshift(hd);
      if (hd.x === food.x && hd.y === food.y) { score++; place(); schedule(); } else snake.pop();
      info(); draw();
    }
    function pause() { if (state !== "run") return; clearInterval(timer); state = "pause"; btn.textContent = "Resume"; draw("Paused"); }
    function toggle() {
      if (state === "run") { pause(); return; }
      if (state === "idle" || state === "over") { reset(); col = getComputedStyle(root).getPropertyValue("--y").trim() || col; }
      state = "run"; btn.textContent = "Pause"; info(); draw(); schedule();
    }
    function steer(x, y) { if (state !== "run" || (x === -dir.x && y === -dir.y)) return; nd = { x: x, y: y }; }
    var keys = { ArrowUp: [0,-1], w: [0,-1], W: [0,-1], ArrowDown: [0,1], s: [0,1], S: [0,1], ArrowLeft: [-1,0], a: [-1,0], A: [-1,0], ArrowRight: [1,0], d: [1,0], D: [1,0] };
    var sx = 0, sy = 0;
    cv.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; });
    cv.addEventListener("pointerup", function (e) {
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0); else steer(0, dy > 0 ? 1 : -1);
    });
    btn.addEventListener("click", function () { toggle(); cv.focus({ preventScroll: true }); });
    var pad = h("div.dpad#dpad", { on: { click: function (e) {
      var d = e.target.closest("button"); if (!d) return;
      var m = { u: [0,-1], d: [0,1], l: [-1,0], r: [1,0] }[d.dataset.d]; steer(m[0], m[1]);
    } } }, [["u","↑","Up"],["l","←","Left"],["d","↓","Down"],["r","→","Right"]].map(function (d) {
      return h("button", { type: "button", "aria-label": d[2], text: d[1], dataset: { d: d[0] } });
    }));
    var el = h("div.gwrap", { on: { keydown: function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (keys[e.key]) { steer(keys[e.key][0], keys[e.key][1]); e.preventDefault(); }
      else if (e.key === " " && e.target === cv) { toggle(); e.preventDefault(); }
    } } }, cv, h("div.gside", stat, btn,
      h("p.hint", { text: "Arrow keys or WASD to steer, Space to pause. On a phone, swipe on the board or use the pad." }), pad));
    document.addEventListener("tabsel", function (e) { if (e.detail !== "snake") pause(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    reset(); info(); draw("Press Start");
    return el;
  }

  function buildTyping() {
    var texts = [
      "A fast website is a polite website, because it respects the time of everyone who visits it.",
      "Small functions, clear names and honest tests will save you more hours than any clever trick.",
      "Every great project starts as a messy experiment that someone refused to throw away.",
      "Hashing a password is easy, but remembering to salt it is what keeps the attackers away.",
      "The best code is the code you never have to write, and the second best is easy to delete."
    ];
    var target = "", spans = [], t0 = 0, done = false, last = -1, best = num("sg-wpm");
    var tp = h("p.tprompt#tp"), out = h("p.gstat#twpm", { "aria-live": "polite" });
    var tin = h("textarea#tin", { rows: "2", placeholder: "Start typing to begin the timer…", spellcheck: "false", autocomplete: "off", autocapitalize: "off", "aria-label": "Type the text shown above" });
    function paint(v) { spans.forEach(function (sp, i) { sp.className = i < v.length ? (v[i] === target[i] ? "ok" : "bad") : i === v.length ? "cur" : ""; }); }
    function newText() {
      var i; do { i = rand(texts.length); } while (i === last);
      last = i; target = texts[i]; t0 = 0; done = false;
      spans = target.split("").map(function (ch) { return h("span", { text: ch }); });
      tp.textContent = ""; spans.forEach(function (s) { tp.appendChild(s); });
      tin.value = ""; tin.readOnly = false; paint(""); out.textContent = "Best: " + (best ? best + " WPM" : "–");
    }
    function finish(v) {
      done = true; tin.readOnly = true;
      var min = (performance.now() - t0) / 60000, ok = 0, i, note = "";
      for (i = 0; i < target.length; i++) if (v[i] === target[i]) ok++;
      var wpm = Math.max(1, Math.round(target.length / 5 / min)), acc = Math.round(ok / target.length * 100);
      if (acc >= 90 && wpm > best) { best = wpm; store("sg-wpm", String(best)); note = " · New best! 🎉"; }
      out.textContent = wpm + " WPM · " + acc + "% accuracy" + note + (acc < 90 ? " (90%+ needed for a best)" : "");
    }
    tin.addEventListener("input", function () {
      if (done) return;
      if (!t0) t0 = performance.now();
      paint(tin.value); if (tin.value.length >= target.length) finish(tin.value);
    });
    newText();
    return [tp, tin, h("div.outrow.trow", out, h("button.mini", { type: "button", text: "New text", on: { click: function () { newText(); tin.focus(); } } }))];
  }

  /* ================= page layout ================= */
  function buildPage() {
    var burger = h("button.burger#burger", { "aria-label": "Open menu", "aria-expanded": "false", "aria-controls": "menu" }, h("i"), h("i"), h("i"));
    var navLinks = [
      ["404", "#top", "top"], ["Home", "/"], ["Tools", "#tools", "tools"], ["Arcade", "#arcade", "arcade"], ["Contact", "/#contact"]
    ].map(function (l) { return h("a.nb", { href: l[1], dataset: l[2] ? { s: l[2] } : null, text: l[0] }); });
    navLinks.push(h("a.nb.nb-hot", { href: "/blog/", target: "_blank", rel: "noopener", text: "Blog" }));
    var menu = h("nav#menu", { "aria-label": "Main" }, navLinks);
    function setMenu(open) {
      menu.classList.toggle("show", open); burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    burger.addEventListener("click", function () { setMenu(burger.getAttribute("aria-expanded") !== "true"); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

    var header = h("header.nav-wrap", h("div.nav",
      h("a.brand", { href: "/", "aria-label": "Sgdev home" }, h("img", { src: "/s.png", alt: "", width: "36", height: "36" }), h("span", { text: "Sgdev" })),
      burger, menu));

    var sw = h("button.switch", { type: "button", role: "switch", "aria-checked": "false", "aria-label": "Fix this page (does nothing)",
      on: { click: function () { sw.setAttribute("aria-checked", String(sw.getAttribute("aria-checked") !== "true")); } } }, h("i"));

    var hero = h("section.hero.nf.wrap",
      h("div.hero-text",
        h("span.open", h("i"), "Error 404"),
        h("div.nfrow", h("span.code", { "aria-hidden": "true", text: "404" }),
          h("img.walrus-big", { src: "walrus.webp", alt: "Friendly blue walrus mascot", width: "480", height: "689", decoding: "async" })),
        h("h1", { text: "This page swam away." }),
        h("p.lead", { text: "The page you wanted isn't here. It may have moved or never existed. While you're lost, use the tools or play a game below." }),
        h("div.cta",
          h("a.btn", { href: "/", text: "Back to home" }),
          h("a.btn.ghost", { href: "#arcade", text: "Play a game" }),
          h("a.btn.ghost", { href: "#tools", text: "Open the tools" }))),
      h("aside.status-card", { "aria-label": "Page repair panel" },
        h("h2", { text: "Repair panel" }), h("p", { text: "Flip the switch to fix this page." }),
        h("div.srow.sw", h("span", "Fix this page", h("small", { text: "It does nothing. Honest." })), sw),
        h("p.spinhint", { text: "Status: still 404" })));

    var tools = h("section.wrap#tools", h("h2.h2", { text: "Tools & toys" }),
      h("p.sub", { text: "Small utilities that run fully in your browser. Nothing you type here is sent anywhere." }),
      tabWidget("Tools", [
        { id: "calc", label: "Calculator", build: buildCalculator },
        { id: "hash", label: "SHA-256", build: buildHash },
        { id: "pass", label: "Password", build: buildPassword }
      ]));

    var arcade = h("section.wrap#arcade", h("h2.h2", { text: "Arcade" }),
      h("p.sub", { text: "Five quick games written in plain JavaScript. Your scores are saved in your browser only." }),
      tabWidget("Games", [
        { id: "ttt", label: "Tic-Tac-Toe", build: buildTTT },
        { id: "mem", label: "Memory", build: buildMemory },
        { id: "react", label: "Reaction", build: buildReaction },
        { id: "snake", label: "Snake", build: buildSnake },
        { id: "type", label: "Typing", build: buildTyping }
      ]));

    var footer = h("footer", h("div.wrap",
      h("div.frow", h("span", { text: "© " + new Date().getFullYear() + " Shubhomoy (Sgdev)" }),
        h("span", h("a", { href: "https://sgdev.qd.je", text: "sgdev.qd.je" }), " · info@sgdev.qd.je")),
      h("div.frow", h("span"),
        h("span", h("a", { href: "https://sgdev.is-cool.dev", text: "sgdev.is-cool.dev" }), " · info@sgdev.is-cool.dev"))));

    var progress = h("div.progress#progress", { "aria-hidden": "true" });
    var upBtn = h("button#up", { type: "button", "aria-label": "Back to top", text: "↑" });
    var dots = h("span.dots#dots", { role: "group", "aria-label": "Accent colour" });
    var dock = h("div.dock#dock", { "aria-label": "Page controls" }, dots, upBtn);

    document.body.append(progress, header, h("main#top", hero, tools, arcade), footer, dock, toastEl);
    return { progress: progress, up: upBtn, dots: dots, nav: navLinks };
  }

  var ui = buildPage();

  /* ================= scroll: active nav, progress, back-to-top, reveal ================= */
  var links = {};
  ui.nav.forEach(function (a) { if (a.dataset.s) links[a.dataset.s] = a; });
  var ids = ["top", "tools", "arcade"], ticking = false;
  function onScroll() {
    ticking = false;
    var sy = window.scrollY, y = sy + window.innerHeight * 0.35, current = "top";
    ids.forEach(function (id) { var el = $(id); if (el && el.offsetTop <= y) current = id; });
    Object.keys(links).forEach(function (id) { links[id].classList.toggle("active", id === current); });
    var max = root.scrollHeight - window.innerHeight;
    ui.progress.style.transform = "scaleX(" + (max > 0 ? Math.min(1, sy / max) : 0) + ")";
    ui.up.style.visibility = sy > 400 ? "visible" : "hidden";
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  ui.up.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); });
  onScroll();

  var items = document.querySelectorAll(".status-card, .tool");
  items.forEach(function (el) { el.classList.add("rv"); });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else items.forEach(function (el) { el.classList.add("in"); });

  /* ================= accent picker (idle) ================= */
  idle(function () {
    var colors = [["#ffe21a","Yellow"],["#22d3ee","Cyan"],["#4ade80","Green"],["#f472b6","Pink"],["#fb923c","Orange"]];
    function apply(hex) {
      root.style.setProperty("--y", hex);
      root.style.setProperty("--yr", parseInt(hex.slice(1, 3), 16) + "," + parseInt(hex.slice(3, 5), 16) + "," + parseInt(hex.slice(5, 7), 16));
      Array.prototype.forEach.call(ui.dots.children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.c === hex)); });
    }
    colors.forEach(function (c) {
      ui.dots.appendChild(h("button", { type: "button", style: "background:" + c[0], "aria-label": c[1] + " accent", dataset: { c: c[0] },
        on: { click: function () { apply(c[0]); store("sg-accent", c[0]); } } }));
    });
    apply((store("sg-accent") || "#ffe21a").toLowerCase());
  });

  /* ================= hash that matches no section → real 404 page ================= */
  var hsh = location.hash.slice(1);
  if (hsh && !$(hsh)) location.replace("/404.html");
})();
