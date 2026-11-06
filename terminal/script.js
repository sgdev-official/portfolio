/* sgdev terminal — a Linux-style shell for the portfolio. Pure JavaScript (it builds its own DOM and CSS).
   Palette: #ffe21a yellow · #cd0d0d red · #3fff1a green · #000000 black.  Mount point: <div id="term"></div> */
(function () {
  "use strict";
  var mount = document.getElementById("term");
  if (!mount) return;

  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var C = { g: "#3fff1a", y: "#ffe21a", r: "#cd0d0d", k: "#000000" };
  var THEMES = { green: C.g, yellow: C.y, red: C.r };
  var started = Date.now();

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function el(tag, cls, txt, par) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; if (par) par.appendChild(e); return e; }
  function rand(n) { return Math.floor(Math.random() * n); }
  function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
  function san(s) { return String(s).replace(/[\[\]]/g, ""); }

  /* ---------- styles (injected) ---------- */
  var css = [
    ".tw{--t:#3fff1a;border:1px solid #1f1f1f;border-radius:14px;overflow:hidden;background:#000;box-shadow:0 24px 60px -28px var(--t);font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace;color:var(--t)}",
    ".tb{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#0b0b0b;border-bottom:1px solid #1f1f1f}",
    ".tb i{width:12px;height:12px;border-radius:50%}",
    ".tb .tt{margin-left:8px;font-size:12.5px;color:#8a8a82;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}",
    ".st{position:relative;height:clamp(380px,62vh,540px);cursor:text}",
    ".tcv{position:absolute;inset:0;width:100%;height:100%;opacity:.28;pointer-events:none}",
    ".ts{position:absolute;inset:0;overflow:auto;padding:14px 16px;scrollbar-width:thin;scrollbar-color:var(--t) #000}",
    ".tl{white-space:pre-wrap;word-break:break-word;text-shadow:0 0 6px #000,0 0 2px #000}",
    ".tl a{text-decoration:underline;text-underline-offset:3px}",
    ".cg{color:var(--t)}.cy{color:#ffe21a}.cr{color:#cd0d0d;font-weight:700}.cd{color:#7d8a78}.cb{color:#fff;font-weight:700}",
    ".tf{display:flex;gap:6px;align-items:center;margin-top:2px}",
    ".tp{white-space:pre;flex:none}",
    ".ti{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#fff;font:inherit;caret-color:var(--t);padding:0;text-shadow:0 0 6px #000}",
    ".tc{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;background:#0b0b0b;border-top:1px solid #1f1f1f}",
    ".tc button{padding:5px 12px;border:1px solid #2a2a2a;border-radius:8px;background:#000;color:var(--t);font:600 12.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;cursor:pointer}",
    ".tc button:hover{border-color:var(--t);background:#0d0d0d}",
    ".tc button:focus-visible,.ti:focus-visible{outline:2px solid #ffe21a;outline-offset:2px}",
    "@media (max-width:600px){.tw{font-size:12.5px}.ts{padding:12px}}"
  ].join("");
  el("style", null, css, document.head);

  /* ---------- section heading (JS-made) ---------- */
  var h = document.createElement("h2"); h.className = "h2"; h.textContent = "Terminal";
  var sub = document.createElement("p"); sub.className = "sub";
  sub.textContent = "A Linux-style shell written in plain JavaScript. Type help, press Tab to complete, or tap a command below. Nothing you type leaves your browser.";
  mount.parentNode.insertBefore(h, mount); mount.parentNode.insertBefore(sub, mount);

  /* ---------- window ---------- */
  var win = el("div", "tw", null, mount);
  var bar = el("div", "tb", null, win);
  [C.r, C.y, C.g].forEach(function (c) { el("i", null, null, bar).style.background = c; });
  el("span", "tt", "sgdev — sgsh — 80×24", bar);
  var st = el("div", "st", null, win);
  var cv = el("canvas", "tcv", null, st);
  cv.setAttribute("aria-hidden", "true");
  var scr = el("div", "ts", null, st);
  scr.setAttribute("role", "log"); scr.setAttribute("aria-live", "polite");
  var out = el("div", null, null, scr);
  var row = el("div", "tf", null, scr);
  var pr = el("span", "tp", null, row);
  var inp = el("input", "ti", null, row);
  inp.type = "text"; inp.spellcheck = false; inp.autocomplete = "off";
  inp.setAttribute("autocapitalize", "off"); inp.setAttribute("autocorrect", "off");
  inp.setAttribute("enterkeyhint", "go"); inp.setAttribute("aria-label", "Terminal command");
  var chips = el("div", "tc", null, win);

  /* ---------- rendering ---------- */
  function fill(d, m) {
    var cls = "";
    String(m).split(/(\[[gyrdb]\]|\[\/\])/).forEach(function (p) {
      var t = /^\[([gyrdb])\]$/.exec(p);
      if (t) { cls = "c" + t[1]; return; }
      if (p === "[/]") { cls = ""; return; }
      if (!p) return;
      p.split(/(https?:\/\/[^\s)]+|[\w.-]+@[\w.-]+\.\w+)/).forEach(function (s, i) {
        if (!s) return;
        if (i % 2) {
          var a = el("a", cls, s, d);
          a.href = (s.indexOf("http") === 0 ? "" : "mailto:") + s;
          a.target = "_blank"; a.rel = "noopener";
        } else el("span", cls, s, d);
      });
    });
  }
  function toEnd() { scr.scrollTop = scr.scrollHeight; }
  function line(m) {
    var d = el("div", "tl", null, out);
    if (m === "" || m == null) d.textContent = "\u00a0"; else fill(d, m);
    while (out.childNodes.length > 400) out.removeChild(out.firstChild);
    toEnd(); return d;
  }
  function raw(t, cls) { var d = el("div", "tl", null, out); el("span", cls || "", t, d); toEnd(); }

  /* ---------- filesystem ---------- */
  var dirs = ["projects", "links"];
  var files = {
    "about.txt":
      "[y]Shubhomoy (Sgdev)[/] — full-stack & AI developer\n" +
      "I build fast, secure software for the modern web with Python, FastAPI, Flask and edge hosting.\n" +
      "Every project started as an experiment and grew into something people can use: a captcha engine,\n" +
      "an AI chat app, and RF network case studies. I care about performance, clean code and simplicity,\n" +
      "and I'm open to technical discussions and API integrations.",
    "skills.txt":
      "[y]Backend[/]              Python, FastAPI and Flask on Render and Vercel serverless\n" +
      "[y]Frontend[/]             semantic HTML, modern CSS, vanilla JavaScript\n" +
      "[y]Security & Research[/]  HMAC and SHA-256 hashing, network telemetry, RF metrics analysis\n" +
      "[y]Deployment & DNS[/]     Vercel, Hurricane Electric DNS, GitHub Actions, hybrid mail routing",
    "contact.txt":
      "[y]Email[/]   info@sgdev.qd.je\n" +
      "[y]Email[/]   info@sgdev.is-cool.dev\n" +
      "[y]GitHub[/]  https://github.com/sgdev-official\n" +
      "[d]Email is the fastest way to reach me.[/]",
    "README.md":
      "[y]sgdev terminal[/] — a tiny shell running in your browser.\n" +
      "Start with [g]help[/]. Try [g]about[/], [g]projects[/], [g]calc 2*(3+4)[/] or [g]matrix fast[/].",
    "projects/s-captcha.txt":
      "[y]S-Captcha[/] [d](maintenance)[/]\nA captcha system that needs no database. Invisible checks, text challenges and an image honeypot,\nwith rate limiting on hashed IP addresses.\nStack: Python, FastAPI, SHA-256   →  open captcha",
    "projects/sai.txt":
      "[y]SAI[/] [d](in development)[/]\nA chat app for quick answers, code help and developer support. Features are still being added.\nStack: AI, web app   →  open sai",
    "projects/research-blog.txt":
      "[y]Research Blog[/] [d](active)[/]\nIndependent write-ups on Windows MAS HWID, C2R Office and 5G NSA network telemetry.\n→  open blog",
    "projects/clock.txt":
      "[y]Clock[/] [d](live)[/]\nA live clock tool for the browser, built with plain HTML, CSS and JavaScript.\n→  open clock",
    "projects/devtools.txt":
      "[y]Dev Tools[/] [d](live)[/]\nHandy developer utilities that run right in the browser.\n→  open devtools",
    "links/github.txt": "https://github.com/sgdev-official",
    "links/sourceforge.txt": "https://sourceforge.net/u/sgdev/profile/",
    "links/blog.txt": "/blog/"
  };
  var URLS = {
    github: "https://github.com/sgdev-official", sourceforge: "https://sourceforge.net/u/sgdev/profile/",
    blog: "/blog/", clock: "/clock/",
    devtools: "/devtools/", captcha: "https://scaptua.duckdns.org",
    sai: "https://sai-official.duckdns.org", mail: "mailto:info@sgdev.qd.je"
  };
  var cwd = "";

  function resolve(p) {
    var base = cwd ? cwd.split("/") : [];
    p = String(p || "").replace(/^~\/?/, function () { base = []; return ""; });
    p.split("/").forEach(function (s) {
      if (!s || s === ".") return;
      if (s === "..") base.pop(); else base.push(s);
    });
    return base.join("/");
  }
  function isDir(p) { return p === "" || dirs.indexOf(p) > -1; }
  function entries(dir) {
    var pre = dir ? dir + "/" : "", seen = {}, res = [];
    Object.keys(files).forEach(function (k) {
      if (k.indexOf(pre) !== 0) return;
      var rest = k.slice(pre.length), n = rest.split("/")[0];
      if (!n || seen[n]) return;
      seen[n] = 1; res.push({ n: n, d: rest.indexOf("/") > -1 });
    });
    if (!dir) dirs.forEach(function (d) { if (!seen[d]) res.push({ n: d, d: true }); });
    return res.sort(function (a, b) { return a.d === b.d ? (a.n < b.n ? -1 : 1) : a.d ? -1 : 1; });
  }

  /* ---------- helpers for tools ---------- */
  function calc(src) {
    var s = src.toLowerCase().replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
    var o = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
    while (o-- > 0) s += ")";
    var tk = s.match(/\d+\.?\d*|\.\d+|sqrt|pi|[-+*\/^%()]/g) || [];
    if (!tk.length || tk.join("") !== s) throw new Error("invalid expression");
    var i = 0;
    function pk() { return tk[i]; }
    function ex() { var v = tm(), p; while ((p = pk()) === "+" || p === "-") { i++; var r = tm(); v = p === "+" ? v + r : v - r; } return v; }
    function tm() { var v = un(), p; while ((p = pk()) === "*" || p === "/") { i++; var r = un(); v = p === "*" ? v * r : v / r; } return v; }
    function un() { var p = pk(); if (p === "-") { i++; return -un(); } if (p === "+") { i++; return un(); } return pw(); }
    function pw() { var b = po(); if (pk() === "^") { i++; return Math.pow(b, un()); } return b; }
    function po() { var v = pr2(); while (pk() === "%") { i++; v /= 100; } return v; }
    function pr2() {
      var t = tk[i++];
      if (t === undefined) throw new Error("unexpected end");
      if (t === "(") { var v = ex(); if (tk[i++] !== ")") throw new Error("missing )"); return v; }
      if (t === "sqrt") { if (tk[i++] !== "(") throw new Error("use sqrt(x)"); var x = ex(); if (tk[i++] !== ")") throw new Error("missing )"); return Math.sqrt(x); }
      if (t === "pi") return Math.PI;
      if (/^[\d.]/.test(t)) return parseFloat(t);
      throw new Error("bad token");
    }
    var r = ex();
    if (i !== tk.length || typeof r !== "number" || !isFinite(r)) throw new Error("can't calculate that");
    return String(parseFloat(r.toPrecision(12)));
  }
  function rnd(n) {
    var lim = Math.floor(4294967296 / n) * n, a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % n;
  }
  function need(a, u) { if (!a) throw new Error("usage: " + u); return a; }
  function up() { var s = Math.floor((Date.now() - started) / 1000); return Math.floor(s / 60) + "m " + (s % 60) + "s"; }

  /* ---------- theme + matrix rain ---------- */
  var color = THEMES[store("sg-term-theme")] || C.g;
  function setTheme(n) { color = THEMES[n]; win.style.setProperty("--t", color); store("sg-term-theme", n); }
  win.style.setProperty("--t", color);

  var cx = cv.getContext("2d"), FS = 15, W = 0, H = 0, drops = [], on = !reduce, speed = 1, vis = false, raf = 0, lastT = 0;
  var glyphs = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>/{}=+*";
  function size() {
    W = st.clientWidth; H = st.clientHeight;
    var d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
    cx.fillStyle = "#000"; cx.fillRect(0, 0, W, H);
    drops = []; for (var i = 0, n = Math.ceil(W / FS); i < n; i++) drops.push(-rand(40));
  }
  function frame(t) {
    raf = 0;
    if (!on || !vis || document.hidden) return;
    raf = requestAnimationFrame(frame);
    if (t - lastT < 45) return;
    lastT = t;
    cx.fillStyle = "rgba(0,0,0,.09)"; cx.fillRect(0, 0, W, H);
    cx.font = FS + "px monospace"; cx.fillStyle = color;
    for (var i = 0; i < drops.length; i++) {
      var y = drops[i] * FS;
      if (y > 0) cx.fillText(glyphs.charAt(rand(glyphs.length)), i * FS, y);
      if (y > H && Math.random() > 0.975) drops[i] = 0; else drops[i] += speed;
    }
  }
  function kick() { if (on && vis && !raf) raf = requestAnimationFrame(frame); }
  function setRain(v) { on = v; if (!v) { cx.fillStyle = "#000"; cx.fillRect(0, 0, W, H); } else kick(); }
  size();
  var rt = 0;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(size, 150); });
  document.addEventListener("visibilitychange", kick);

  /* ---------- commands ---------- */
  var HELP = [
    ["Info", [["about", "who I am"], ["skills", "what I work with"], ["projects", "things I've built"], ["contact", "how to reach me"], ["links", "all my links"], ["neofetch", "system card"]]],
    ["Files", [["ls", "list files"], ["cd <dir>", "change directory"], ["cat <file>", "read a file"], ["pwd", "where am I"], ["open <name>", "github, blog, clock, devtools, captcha, sai, mail"]]],
    ["Tools", [["calc <expr>", "2*(3+4), sqrt(81), 5%, pi"], ["sha256 <text>", "hash some text"], ["passgen [len]", "strong random password"], ["uuid", "random UUID"], ["base64 enc|dec <t>", "encode or decode"], ["hex <text>", "text to hex"], ["rev|upper|lower <t>", "text helpers"]]],
    ["System", [["theme <name>", "green, yellow or red"], ["matrix [on|off|fast|slow]", "code rain"], ["clear", "clear the screen (Ctrl+L)"], ["history", "past commands"], ["date, uptime, uname, echo", "the usual"]]]
  ];
  var LOGO = ["  ____   ____ ", " / ___| / ___|", " \\___ \\| |  _ ", "  ___) | |_| |", " |____/ \\____|"];
  var FORTUNES = ["It works on my machine — so ship the machine.", "A bug fixed at 3 a.m. is a feature at 9 a.m.", "Read the error message. Then read it again, slowly.", "Make it work, make it right, make it fast. In that order.", "Delete code today, thank yourself tomorrow."];

  function banner() {
    var L = {
      S: [" ____  ", "/ ___| ", "\\___ \\ ", " ___) |", "|____/ "],
      G: ["  ____ ", " / ___|", "| |  _ ", "| |_| |", " \\____|"],
      D: [" ____  ", "|  _ \\ ", "| | | |", "| |_| |", "|____/ "],
      E: [" _____ ", "| ____|", "|  _|  ", "| |___ ", "|_____|"],
      V: ["__     __", "\\ \\   / /", " \\ \\ / / ", "  \\ V /  ", "   \\_/   "]
    };
    for (var r = 0; r < 5; r++) {
      var s = ""; "SGDEV".split("").forEach(function (c) { s += L[c][r] + " "; });
      line("[g]" + s + "[/]");
    }
  }
  function openUrl(k) {
    var u = URLS[k]; if (!u) throw new Error("unknown target '" + san(k) + "' (try: " + Object.keys(URLS).join(", ") + ")");
    line("[d]opening[/] " + u);
    if (u.indexOf("mailto:") === 0) location.href = u; else window.open(u, "_blank", "noopener");
  }
  function cat(path) {
    var p = resolve(path);
    if (isDir(p)) throw new Error(san(path) + ": Is a directory");
    if (!files.hasOwnProperty(p)) throw new Error(san(path) + ": No such file or directory");
    line(files[p]);
  }

  var cmds = {
    help: function () {
      HELP.forEach(function (g) {
        line("[y]" + g[0] + "[/]");
        g[1].forEach(function (c) { line("  [g]" + pad(c[0], 27) + "[/][d]" + c[1] + "[/]"); });
        line("");
      });
      line("[d]Tip: Tab completes, ↑/↓ browse history, Ctrl+C cancels.[/]");
    },
    about: function () { cat("~/about.txt"); },
    skills: function () { cat("~/skills.txt"); },
    contact: function () { cat("~/contact.txt"); },
    whoami: function () { line("visitor  [d]— say hi with[/] [g]contact[/]"); },
    projects: function () {
      line("[y]S-Captcha[/]       [d]maintenance[/]     captcha system with no database");
      line("[y]SAI[/]             [d]in development[/]  AI chat app for developers");
      line("[y]Research Blog[/]   [d]active[/]          Windows MAS HWID, C2R Office, 5G NSA telemetry");
      line("[y]Clock[/]           [d]live[/]            browser clock tool");
      line("[y]Dev Tools[/]       [d]live[/]            developer utilities");
      line("");
      line("[d]Details:[/] cat projects/<name>.txt   [d]Visit:[/] open <name>");
    },
    links: function () {
      Object.keys(URLS).forEach(function (k) { if (k !== "mail") line("[y]" + pad(k, 12) + "[/]" + URLS[k]); });
    },
    tools: function () { cmds.help(); },
    ls: function (a) {
      var t = a.filter(function (x) { return x[0] !== "-"; })[0], p = t ? resolve(t) : cwd;
      if (!isDir(p)) { if (files.hasOwnProperty(p)) { line(san(t)); return; } throw new Error("cannot access '" + san(t) + "': No such file or directory"); }
      var e = entries(p), d = el("div", "tl", null, out);
      e.forEach(function (x) { el("span", x.d ? "cy" : "", x.n + (x.d ? "/" : "") + "   ", d); });
      toEnd();
    },
    cd: function (a) {
      var p = a[0] ? resolve(a[0]) : "";
      if (!isDir(p)) throw new Error(san(a[0]) + ": " + (files.hasOwnProperty(p) ? "Not a directory" : "No such file or directory"));
      cwd = p;
    },
    pwd: function () { line("/home/visitor" + (cwd ? "/" + cwd : "")); },
    cat: function (a) { need(a.length, "cat <file>"); a.forEach(cat); },
    open: function (a) { openUrl(need(a[0], "open <name>").toLowerCase()); },
    clear: function () { out.textContent = ""; },
    echo: function (a, rest) { raw(rest); },
    date: function () { raw(new Date().toString()); },
    uptime: function () { line("up " + up() + ",  1 user,  load average: 0.00, 0.00, 0.00"); },
    uname: function () { line("SgdevOS 1.0 sgdev.qd.je vanilla-js x86_64 GNU/Browser"); },
    history: function () { hist.forEach(function (c, i) { raw(pad(i + 1, 4) + c); }); },
    neofetch: function () {
      var info = [
        "[g]visitor[/]@[g]sgdev[/]", "[d]-------------[/]",
        "[y]OS[/]       SgdevOS 1.0 (browser)", "[y]Shell[/]    sgsh", "[y]Kernel[/]   vanilla-js",
        "[y]Uptime[/]   " + up(), "[y]Stack[/]    Python · FastAPI · JS", "[y]Theme[/]    " + Object.keys(THEMES).filter(function (k) { return THEMES[k] === color; })[0]
      ];
      for (var i = 0; i < Math.max(info.length, LOGO.length); i++)
        line("[g]" + pad(LOGO[i] || "", 17) + "[/]" + (info[i] || ""));
    },
    theme: function (a) {
      var n = (a[0] || "").toLowerCase();
      if (!THEMES[n]) { line("themes: green, yellow, red   [d]usage: theme <name>[/]"); return; }
      setTheme(n); line("theme set to " + n);
    },
    matrix: function (a) {
      var m = (a[0] || "").toLowerCase();
      if (m === "off") setRain(false); else if (m === "on") setRain(true);
      else if (m === "fast") { speed = 2; setRain(true); } else if (m === "slow") { speed = 0.5; setRain(true); }
      else if (m) throw new Error("usage: matrix [on|off|fast|slow]");
      else setRain(!on);
      line("matrix rain: " + (on ? "on" : "off") + (on ? " (speed " + speed + ")" : ""));
    },
    calc: function (a, rest) { line("[y]=[/] " + calc(need(rest, "calc <expression>"))); },
    sha256: function (a, rest) {
      need(rest, "sha256 <text>");
      if (!(window.crypto && crypto.subtle)) throw new Error("needs HTTPS");
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(rest)).then(function (b) {
        line("[g]" + Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("") + "[/]");
      });
    },
    passgen: function (a) {
      var n = Math.max(8, Math.min(64, parseInt(a[0], 10) || 16));
      if (!(window.crypto && crypto.getRandomValues)) throw new Error("not supported");
      var sets = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%^&*-_=+?"], all = sets.join(""), o = [], i;
      sets.forEach(function (s) { o.push(s[rnd(s.length)]); });
      while (o.length < n) o.push(all[rnd(all.length)]);
      for (i = o.length - 1; i > 0; i--) { var j = rnd(i + 1), t = o[i]; o[i] = o[j]; o[j] = t; }
      raw(o.join(""), "cy");
      line("[d]" + Math.round(n * Math.log(all.length) / Math.LN2) + " bits of entropy[/]");
    },
    uuid: function () {
      var u = window.crypto && crypto.randomUUID ? crypto.randomUUID() :
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = rand(16); return (c === "x" ? r : (r & 3) | 8).toString(16); });
      raw(u, "cy");
    },
    base64: function (a, rest) {
      var m = (a[0] || "").toLowerCase(), t = rest.slice(a[0] ? a[0].length : 0).trim();
      if ((m !== "enc" && m !== "dec") || !t) throw new Error("usage: base64 enc|dec <text>");
      try { raw(m === "enc" ? btoa(unescape(encodeURIComponent(t))) : decodeURIComponent(escape(atob(t))), "cy"); }
      catch (e) { throw new Error("invalid base64 input"); }
    },
    hex: function (a, rest) {
      var b = new TextEncoder().encode(need(rest, "hex <text>"));
      raw(Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(" "), "cy");
    },
    rev: function (a, rest) { raw(Array.from(need(rest, "rev <text>")).reverse().join("")); },
    upper: function (a, rest) { raw(need(rest, "upper <text>").toUpperCase()); },
    lower: function (a, rest) { raw(need(rest, "lower <text>").toLowerCase()); },
    banner: banner,
    fortune: function () { line("[y]" + FORTUNES[rand(FORTUNES.length)] + "[/]"); },
    sudo: function () { line("[r]visitor is not in the sudoers file. This incident will be reported.[/]"); },
    rm: function () { line("[r]rm: permission denied. Nice try.[/]"); },
    exit: function () { line("[d]logout[/]"); line("…just kidding, this tab stays open."); }
  };

  /* ---------- shell ---------- */
  var hist = [], hi = 0;
  function pm() { return "[g]visitor@sgdev[/][b]:[/][y]" + (cwd ? "~/" + cwd : "~") + "[/][b]$[/] "; }
  function updatePrompt() { pr.textContent = ""; fill(pr, pm()); }
  function echo(t) { var d = el("div", "tl", null, out); fill(d, pm()); el("span", "cb", t, d); toEnd(); }

  function run(text) {
    var s = text.trim();
    echo(text);
    if (!s) return;
    hist.push(s); hi = hist.length;
    var a = [];
    s.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, function (m, x, y, z) { a.push(x != null ? x : y != null ? y : z); return m; });
    var name = a.shift().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(cmds, name)) {
      line("[r]bash: " + san(name) + ": command not found[/]  [d]try[/] [y]help[/]");
      return;
    }
    try {
      var sp = s.search(/\s/), r = cmds[name](a, sp < 0 ? "" : s.slice(sp + 1).trim());
      if (r && r.then) return r["catch"](function (e) { line("[r]" + name + ": " + san(e.message) + "[/]"); });
    } catch (e) { line("[r]" + name + ": " + san(e && e.message || "error") + "[/]"); }
  }
  function exec(t) { var r = run(t); updatePrompt(); toEnd(); return r; }

  function complete() {
    var v = inp.value, parts = v.split(/\s+/), last = parts[parts.length - 1], pool;
    if (parts.length < 2) pool = Object.keys(cmds);
    else if (parts[0].toLowerCase() === "open") pool = Object.keys(URLS);
    else if (parts[0].toLowerCase() === "theme") pool = Object.keys(THEMES);
    else {
      var slash = last.lastIndexOf("/"), base = slash > -1 ? last.slice(0, slash + 1) : "";
      pool = entries(resolve(base)).map(function (x) { return base + x.n + (x.d ? "/" : ""); });
    }
    var m = pool.filter(function (x) { return x.indexOf(last) === 0; });
    if (m.length === 1) { parts[parts.length - 1] = m[0]; inp.value = parts.join(" ") + (parts.length < 2 ? " " : ""); }
    else if (m.length > 1) { echo(v); line("[d]" + m.join("   ") + "[/]"); }
  }

  inp.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "Enter") {
      e.preventDefault(); var v = inp.value; inp.value = ""; exec(v);
    } else if (k === "Tab") { e.preventDefault(); complete(); }
    else if (k === "ArrowUp") { e.preventDefault(); if (hi > 0) inp.value = hist[--hi]; setTimeout(function () { inp.setSelectionRange(inp.value.length, inp.value.length); }, 0); }
    else if (k === "ArrowDown") { e.preventDefault(); inp.value = hi < hist.length - 1 ? hist[++hi] : (hi = hist.length, ""); }
    else if (e.ctrlKey && (k === "l" || k === "L")) { e.preventDefault(); out.textContent = ""; }
    else if (e.ctrlKey && (k === "c" || k === "C") && inp.selectionEnd === inp.selectionStart) { e.preventDefault(); echo(inp.value + "^C"); inp.value = ""; }
    else if (e.ctrlKey && (k === "u" || k === "U")) { e.preventDefault(); inp.value = ""; }
  });
  st.addEventListener("click", function () {
    var sel = window.getSelection && window.getSelection().toString();
    if (!sel) inp.focus({ preventScroll: true });
  });
  ["help", "about", "skills", "projects", "tools", "contact", "neofetch", "matrix"].forEach(function (c) {
    var b = el("button", null, c, chips); b.type = "button";
    b.addEventListener("click", function () { exec(c); });
  });

  /* ---------- boot (starts when the terminal scrolls into view) ---------- */
  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    var L = [
      "[d][ [/][g]OK[/][d] ][/] starting sgsh 1.0",
      "[d][ [/][g]OK[/][d] ][/] mounting /home/visitor",
      "[d][ [/][g]OK[/][d] ][/] loading matrix rain",
      "[d][ [/][g]OK[/][d] ][/] 100% vanilla JavaScript, zero frameworks",
      ""
    ], i = 0;
    (function next() {
      if (i < L.length) { line(L[i++]); setTimeout(next, reduce ? 0 : 150); return; }
      banner(); line("");
      line("Welcome. I'm [y]Shubhomoy (Sgdev)[/]. Type [g]help[/] to see what this shell can do.");
      line("");
    })();
  }
  updatePrompt();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      vis = en[0].isIntersecting;
      if (vis) { boot(); kick(); }
    }, { threshold: 0.15 }).observe(win);
  } else { vis = true; boot(); kick(); }
})();
