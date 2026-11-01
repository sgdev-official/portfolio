(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, props, kids) => {
    const n = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    (kids || []).forEach((c) => n.append(c));
    return n;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];

  /* ---------- URL builders for every image source ---------- */
  function pollUrl(cfg, prompt, w, h, seed, model) {
    const g = cfg.generator;
    return g.endpoint + encodeURIComponent(prompt) +
      "?width=" + w + "&height=" + h + "&seed=" + seed +
      "&model=" + (model || "flux") + "&nologo=true";
  }

  function buildItem(cfg, i, srcList) {
    const src = srcList[i % srcList.length];
    const heights = [420, 520, 620, 720, 560, 480];
    const h = heights[(i * 7 + 3) % heights.length];
    const w = 480;
    const seed = 1000 + i * 13;
    if (src.id === "unsplash") {
      const q = src.queries[i % src.queries.length];
      const fallbackPrompt = "photo of " + q;
      return {
        id: "u" + i, source: "unsplash", title: q, w, h,
        thumb: "https://source.unsplash.com/random/" + w + "x" + h + "/?" + encodeURIComponent(q) + "&sig=" + i,
        full: "https://source.unsplash.com/random/1200x" + Math.round(h * 2.5) + "/?" + encodeURIComponent(q) + "&sig=" + i,
        fallback: pollUrl(cfg, fallbackPrompt, w, h, seed, "flux")
      };
    }
    if (src.id === "robohash") {
      const set = src.sets[i % src.sets.length];
      const bg = src.bgsets[i % src.bgsets.length];
      const base = "https://robohash.org/bearing-" + i + "?set=" + set + "&bgset=" + bg;
      return {
        id: "r" + i, source: "robohash", title: "Robot " + set, w, h: w,
        thumb: base + "&size=" + w + "x" + w,
        full: base + "&size=900x900",
        fallback: pollUrl(cfg, "cute robot character, flat colours", w, w, seed, "turbo")
      };
    }
    const prompt = src.prompts[i % src.prompts.length];
    return {
      id: "p" + i, source: "pollinations", title: prompt, w, h,
      thumb: pollUrl(cfg, prompt, w, h, seed, "turbo"),
      full: pollUrl(cfg, prompt, 1024, Math.round(1024 * h / w), seed, "flux"),
      fallback: "https://robohash.org/fallback-" + i + "?set=set1&size=" + w + "x" + w
    };
  }

  function weightedSources(cfg) {
    const list = [];
    cfg.sources.forEach((s) => { for (let k = 0; k < s.weight; k++) list.push(s); });
    // spread them so sources interleave
    const out = [];
    const buckets = cfg.sources.map((s) => list.filter((x) => x === s));
    let more = true;
    while (more) {
      more = false;
      buckets.forEach((b) => { if (b.length) { out.push(b.shift()); more = true; } });
    }
    return out;
  }

  /* ---------- styles (all injected from JS) ---------- */
  function injectStyles(cfg) {
    const P = cfg.palette, F = cfg.fonts;
    const css = `
:root{--y:${P.yellow};--r:${P.red};--b:${P.blue};--k:${P.black};--d:${F.display};--t:${F.body}}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--k);color:var(--y);font-family:var(--t);min-height:100vh;overflow-x:hidden}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:3px solid var(--y);outline-offset:3px}

/* layer 0: image mosaic background */
.L0{position:fixed;inset:-4%;z-index:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));grid-auto-rows:150px;gap:0;transform:rotate(-4deg) scale(1.1);filter:saturate(1.2) contrast(1.1)}
.L0 img{width:100%;height:100%;object-fit:cover;display:block;opacity:.0;transition:opacity .8s}
.L0 img.on{opacity:.75}
/* layer 1: colour washes, tuned so the images still show through */
.L1{position:fixed;inset:0;z-index:1;pointer-events:none;background:
  linear-gradient(115deg,${P.blue}d9 0%,${P.blue}66 28%,transparent 50%),
  linear-gradient(295deg,${P.red}cc 0%,${P.red}55 26%,transparent 48%),
  radial-gradient(circle at 80% 8%,${P.yellow}66,transparent 30%);mix-blend-mode:multiply}
/* layer 2: halftone dots */
.L2{position:fixed;inset:0;z-index:2;pointer-events:none;opacity:.35;background-image:radial-gradient(${P.black} 22%,transparent 24%);background-size:9px 9px;mix-blend-mode:multiply}
/* layer 3: diagonal stripes at the edges */
.L3{position:fixed;inset:0;z-index:3;pointer-events:none;background:repeating-linear-gradient(135deg,${P.yellow} 0 14px,${P.black} 14px 28px);-webkit-mask:linear-gradient(90deg,#000 0,transparent 3%,transparent 97%,#000 100%);mask:linear-gradient(90deg,#000 0,transparent 3%,transparent 97%,#000 100%);opacity:.9}
/* layer 4: vignette */
.L4{position:fixed;inset:0;z-index:4;pointer-events:none;background:radial-gradient(ellipse at center,transparent 45%,${P.black}cc 100%)}
/* layer 5: scanlines */
.L5{position:fixed;inset:0;z-index:5;pointer-events:none;opacity:.18;background:repeating-linear-gradient(0deg,#000 0 1px,transparent 1px 3px)}

.wrap{position:relative;z-index:10;max-width:1280px;margin:0 auto;padding:22px 28px 90px}
header{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px}
.logo{font-family:var(--d);font-size:clamp(2.4rem,8vw,5.6rem);line-height:.88;letter-spacing:-.03em;color:var(--y);background:var(--k);padding:10px 18px 14px;border:5px solid var(--y);box-shadow:10px 10px 0 var(--r),20px 20px 0 var(--b);transform:rotate(-1.2deg)}
.tag{font-family:var(--d);font-size:1rem;background:var(--r);color:var(--y);padding:8px 14px;border:3px solid var(--k);box-shadow:5px 5px 0 var(--k)}
nav{display:flex;gap:10px;margin:26px 0 18px;flex-wrap:wrap}
.tab,.chip{font-family:var(--d);background:var(--k);color:var(--y);border:3px solid var(--y);padding:10px 18px;box-shadow:5px 5px 0 var(--b);transition:transform .12s,box-shadow .12s,background .12s}
.tab:hover,.chip:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 var(--r)}
.tab[aria-selected=true],.chip[aria-pressed=true]{background:var(--y);color:var(--k);box-shadow:5px 5px 0 var(--r)}
.chip{padding:7px 14px;font-size:.85rem}
.bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}
.panel{background:${P.black}ee;border:4px solid var(--y);box-shadow:12px 12px 0 var(--r);padding:22px}
.grid{column-width:230px;column-gap:18px}
.card{position:relative;break-inside:avoid;margin:0 0 18px;background:var(--k);border:4px solid var(--y);box-shadow:7px 7px 0 var(--b);overflow:hidden;cursor:zoom-in;transition:transform .15s,box-shadow .15s}
.card:hover{transform:translate(-3px,-3px) rotate(-.4deg);box-shadow:11px 11px 0 var(--r)}
.card img{display:block;width:100%;height:auto;background:linear-gradient(135deg,var(--b),var(--r));min-height:120px}
.card .cap{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px 10px;background:var(--k);font-size:.78rem;border-top:3px solid var(--y)}
.card .cap b{font-family:var(--d);background:var(--r);color:var(--y);padding:2px 7px;white-space:nowrap}
.card .cap span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.heart{position:absolute;top:8px;right:8px;background:var(--k);border:3px solid var(--y);width:38px;height:38px;font-size:1.1rem;line-height:1}
.heart[aria-pressed=true]{background:var(--r)}
.more{display:block;margin:18px auto 0;font-size:1.1rem;padding:14px 34px}
label.f{display:block;font-family:var(--d);font-size:.85rem;margin:14px 0 6px}
textarea,input[type=text],input[type=number],select{width:100%;background:var(--k);color:var(--y);border:3px solid var(--y);padding:11px 12px;box-shadow:inset 0 0 0 2px var(--b)}
textarea{min-height:110px;resize:vertical}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
.maker{display:grid;grid-template-columns:minmax(280px,420px) 1fr;gap:26px;align-items:start}
@media(max-width:860px){.maker{grid-template-columns:1fr}.wrap{padding:16px 14px 70px}}
.go{width:100%;margin-top:18px;font-size:1.15rem;padding:15px;background:var(--r);color:var(--y);border:4px solid var(--y);font-family:var(--d);box-shadow:6px 6px 0 var(--b)}
.go:hover{background:var(--y);color:var(--k)}
.go[disabled]{opacity:.6;cursor:wait}
.stage{min-height:340px;display:grid;place-items:center;background:repeating-conic-gradient(var(--b) 0 25%,var(--k) 0 50%) 0 0/36px 36px;border:4px solid var(--y);position:relative;overflow:hidden}
.stage img{max-width:100%;max-height:70vh;display:block;border:4px solid var(--y);box-shadow:8px 8px 0 var(--r)}
.msg{font-family:var(--d);background:var(--k);padding:14px 18px;border:3px solid var(--y);max-width:80%;text-align:center}
.spin{width:54px;height:54px;border:8px solid var(--y);border-top-color:var(--r);border-radius:50%;animation:sp 0.8s linear infinite;margin:0 auto 12px}
@keyframes sp{to{transform:rotate(360deg)}}
.acts{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.hist{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin-top:18px}
.hist img{width:100%;aspect-ratio:1;object-fit:cover;border:3px solid var(--y);cursor:pointer;display:block}
.hist img:hover{border-color:var(--r)}

.lb{position:fixed;inset:0;z-index:100;background:${P.black}f2;display:none;grid-template-rows:1fr auto;padding:18px;gap:12px}
.lb.open{display:grid}
.lb .pic{display:grid;place-items:center;min-height:0}
.lb .pic img{max-width:100%;max-height:100%;object-fit:contain;border:5px solid var(--y);box-shadow:14px 14px 0 var(--r),28px 28px 0 var(--b)}
.lb .bottom{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center}
.lb .ttl{font-family:var(--d);flex-basis:100%;text-align:center;font-size:.95rem}
.sr{position:absolute;left:-9999px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.L0{transform:none}}
`;
    document.head.append(el("style", { text: css }));
    document.title = cfg.app.name;
  }

  /* ---------- background layers ---------- */
  function buildLayers(cfg) {
    const root = el("div", { "aria-hidden": "true" });
    const l0 = el("div", { class: "L0" });
    const tiles = [];
    const srcs = weightedSources(cfg);
    for (let i = 0; i < cfg.app.backgroundTiles; i++) {
      const item = buildItem(cfg, 500 + i, srcs);
      const img = el("img", { alt: "", loading: "lazy", decoding: "async", src: item.thumb });
      img.addEventListener("load", () => img.classList.add("on"));
      img.addEventListener("error", () => {
        if (img.dataset.fb) return;
        img.dataset.fb = "1";
        img.src = item.fallback;
      });
      tiles.push(img);
    }
    l0.append(...tiles);
    root.append(l0);
    ["L1", "L2", "L3", "L4", "L5"].forEach((c) => root.append(el("div", { class: c })));
    document.body.prepend(root);
  }

  /* ---------- lightbox ---------- */
  function buildLightbox(cfg) {
    const T = cfg.text;
    const img = el("img", { alt: "" });
    const ttl = el("div", { class: "ttl" });
    const open = el("a", { class: "chip", target: "_blank", rel: "noopener", text: T.open });
    const dl = el("button", { class: "chip", text: T.download });
    const prev = el("button", { class: "chip", "aria-label": "Previous image", text: "Prev" });
    const next = el("button", { class: "chip", "aria-label": "Next image", text: "Next" });
    const close = el("button", { class: "chip", text: "Close" });
    const box = el("div", { class: "lb", role: "dialog", "aria-modal": "true", "aria-label": "Image viewer" }, [
      el("div", { class: "pic" }, [img]),
      el("div", { class: "bottom" }, [ttl, prev, next, open, dl, close])
    ]);
    document.body.append(box);
    const state = { list: [], i: 0 };

    function show() {
      const it = state.list[state.i];
      if (!it) return;
      img.src = it.full || it.thumb;
      img.onerror = () => { img.onerror = null; img.src = it.fallback || it.thumb; };
      ttl.textContent = it.title;
      open.href = it.full || it.thumb;
    }
    function go(d) { state.i = (state.i + d + state.list.length) % state.list.length; show(); }
    prev.onclick = () => go(-1);
    next.onclick = () => go(1);
    close.onclick = () => box.classList.remove("open");
    box.addEventListener("click", (e) => { if (e.target === box || e.target.classList.contains("pic")) box.classList.remove("open"); });
    dl.onclick = () => downloadImage(img.src, "bearing-" + Date.now() + ".jpg");
    document.addEventListener("keydown", (e) => {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") box.classList.remove("open");
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    });
    return { openAt(list, i) { state.list = list; state.i = i; box.classList.add("open"); show(); close.focus(); } };
  }

  async function downloadImage(url, name) {
    try {
      const r = await fetch(url, { mode: "cors" });
      const b = await r.blob();
      const a = el("a", { href: URL.createObjectURL(b), download: name });
      document.body.append(a); a.click(); a.remove();
    } catch (e) {
      window.open(url, "_blank", "noopener");
    }
  }

  /* ---------- gallery ---------- */
  function buildGallery(cfg, lb) {
    const T = cfg.text;
    const srcs = weightedSources(cfg);
    const favs = new Set(store.get("favs", []));
    let filter = "all";
    let items = [];
    let counter = 0;

    const grid = el("div", { class: "grid" });
    const bar = el("div", { class: "bar" });
    const moreBtn = el("button", { class: "tab more", text: T.more });
    const section = el("section", {}, [bar, grid, moreBtn]);

    const filters = [{ id: "all", label: T.all }].concat(cfg.sources.map((s) => ({ id: s.id, label: s.label })), [{ id: "saved", label: T.saved }]);
    filters.forEach((f) => {
      const b = el("button", { class: "chip", "aria-pressed": String(f.id === filter), text: f.label });
      b.dataset.id = f.id;
      b.onclick = () => {
        filter = f.id;
        bar.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.id === filter)));
        render();
      };
      bar.append(b);
    });

    function visible() {
      if (filter === "all") return items;
      if (filter === "saved") return items.filter((x) => favs.has(x.id));
      return items.filter((x) => x.source === filter);
    }

    function card(it, list) {
      const img = el("img", { alt: it.title, loading: "lazy", decoding: "async", src: it.thumb, width: it.w, height: it.h });
      img.addEventListener("error", () => { if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = it.fallback; } });
      const heart = el("button", { class: "heart", "aria-label": T.save, "aria-pressed": String(favs.has(it.id)), text: "\u2665" });
      heart.onclick = (e) => {
        e.stopPropagation();
        if (favs.has(it.id)) favs.delete(it.id); else favs.add(it.id);
        heart.setAttribute("aria-pressed", String(favs.has(it.id)));
        store.set("favs", Array.from(favs));
        if (filter === "saved") render();
      };
      const c = el("figure", { class: "card", tabindex: "0" }, [
        img, heart,
        el("figcaption", { class: "cap" }, [el("span", { text: it.title }), el("b", { text: it.source })])
      ]);
      const openIt = () => lb.openAt(list, list.indexOf(it));
      c.onclick = openIt;
      c.addEventListener("keydown", (e) => { if (e.key === "Enter") openIt(); });
      return c;
    }

    function render() {
      grid.textContent = "";
      const list = visible();
      if (!list.length) { grid.append(el("p", { class: "msg", text: filter === "saved" ? "Tap the heart on an image to save it here." : T.loading })); return; }
      list.forEach((it) => grid.append(card(it, list)));
    }

    function loadMore() {
      for (let k = 0; k < cfg.app.pageSize; k++) items.push(buildItem(cfg, counter++, srcs));
      render();
    }
    moreBtn.onclick = loadMore;
    loadMore();

    // endless scroll
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting && filter !== "saved") loadMore(); }, { rootMargin: "600px" });
    io.observe(moreBtn);
    return section;
  }

  /* ---------- image maker ---------- */
  function buildMaker(cfg, lb) {
    const T = cfg.text, G = cfg.generator;
    const history = store.get("history", []);

    const prompt = el("textarea", { id: "prompt", placeholder: T.promptPlaceholder });
    const style = el("select", { id: "style" }, G.styles.map((s, i) => el("option", { value: i, text: s.label })));
    const model = el("select", { id: "model" }, G.models.map((m) => el("option", { value: m, text: m })));
    const size = el("select", { id: "size" }, G.sizes.map((s, i) => el("option", { value: i, text: s.label })));
    const seed = el("input", { type: "number", id: "seed", value: String(rnd(999999)), min: "0" });
    const fixed = el("input", { type: "checkbox", id: "fixed" });
    const go = el("button", { class: "go", text: T.generate });
    const idea = el("button", { class: "chip", text: T.random });
    const stage = el("div", { class: "stage" }, [el("p", { class: "msg", text: T.empty })]);
    const acts = el("div", { class: "acts" });
    const hist = el("div", { class: "hist" });

    const lab = (txt, input, id) => el("div", {}, [el("label", { class: "f", for: id, text: txt }), input]);
    const left = el("div", { class: "panel" }, [
      lab("Prompt", prompt, "prompt"),
      el("div", { class: "acts" }, [idea]),
      el("div", { class: "row" }, [lab("Style", style, "style"), lab("Model", model, "model")]),
      el("div", { class: "row" }, [lab("Size", size, "size"), lab("Seed", seed, "seed")]),
      el("label", { class: "f" }, [fixed, document.createTextNode(" Keep this seed every time")]),
      go
    ]);
    const right = el("div", { class: "panel" }, [stage, acts, hist]);
    const wrap = el("section", { class: "maker" }, [left, right]);

    let current = null;

    function renderHistory() {
      hist.textContent = "";
      history.forEach((h, i) => {
        const t = el("img", { src: h.url, alt: h.prompt, title: h.prompt, loading: "lazy" });
        t.onclick = () => lb.openAt(history.map((x) => ({ title: x.prompt, full: x.url, thumb: x.url })), i);
        hist.append(t);
      });
    }

    function showResult(r) {
      current = r;
      stage.textContent = "";
      const img = el("img", { alt: r.prompt, src: r.url });
      stage.append(img);
      acts.textContent = "";
      const dl = el("button", { class: "chip", text: T.download });
      dl.onclick = () => downloadImage(r.url, "bear-ai-" + r.seed + ".jpg");
      const op = el("a", { class: "chip", href: r.url, target: "_blank", rel: "noopener", text: T.open });
      const cp = el("button", { class: "chip", text: "Copy link" });
      cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(r.url); cp.textContent = "Copied"; setTimeout(() => (cp.textContent = "Copy link"), 1400); };
      const again = el("button", { class: "chip", text: "New variation" });
      again.onclick = () => { seed.value = String(rnd(999999)); run(); };
      acts.append(dl, op, cp, again);
    }

    function run() {
      const base = prompt.value.trim();
      if (!base) { prompt.focus(); return; }
      const st = G.styles[+style.value];
      const sz = G.sizes[+size.value];
      const full = base + st.suffix;
      const sd = +seed.value || rnd(999999);
      const url = pollUrl(cfg, full, sz.w, sz.h, sd, model.value);

      go.disabled = true;
      go.textContent = T.loading;
      stage.textContent = "";
      stage.append(el("div", { class: "msg" }, [el("div", { class: "spin" }), document.createTextNode(T.loading)]));
      acts.textContent = "";

      const probe = new Image();
      probe.onload = () => {
        go.disabled = false; go.textContent = T.generate;
        const r = { prompt: base, url, seed: sd };
        showResult(r);
        history.unshift(r);
        history.length = Math.min(history.length, 24);
        store.set("history", history);
        renderHistory();
        if (!fixed.checked) seed.value = String(rnd(999999));
      };
      probe.onerror = () => {
        go.disabled = false; go.textContent = T.generate;
        stage.textContent = "";
        stage.append(el("p", { class: "msg", text: T.failed }));
      };
      probe.src = url;
    }

    go.onclick = run;
    idea.onclick = () => { prompt.value = pick(G.randomPrompts); prompt.focus(); };
    prompt.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run(); });
    renderHistory();
    if (history[0]) showResult(history[0]);
    return wrap;
  }

  /* ---------- boot ---------- */
  async function boot() {
    const app = $("#app");
    let cfg;
    const base = document.currentScript ? document.currentScript.src : location.href;
    const tries = [new URL("main.json", base).href, new URL("main.json", location.href).href, "/main.json"];
    const seen = [];
    for (const u of Array.from(new Set(tries))) {
      try {
        const res = await fetch(u + "?v=" + Date.now(), { cache: "no-store" });
        if (!res.ok) { seen.push(u + " -> HTTP " + res.status); continue; }
        cfg = await res.json();
        break;
      } catch (e) {
        seen.push(u + " -> " + e.message);
      }
    }
    if (!cfg) {
      document.body.style.cssText = "background:#000;color:#ffe21a;font-family:sans-serif;padding:40px;line-height:1.6";
      app.textContent = "";
      app.append(el("h2", { text: "main.json could not be loaded" }));
      seen.forEach((m) => app.append(el("p", { text: m })));
      app.append(el("p", { text: "Check that main.json is in the same folder as index.html and was deployed with it." }));
      return;
    }

    injectStyles(cfg);
    buildLayers(cfg);
    const lb = buildLightbox(cfg);

    const wrap = el("div", { class: "wrap" });
    wrap.append(el("header", {}, [
      el("h1", { class: "logo", text: cfg.app.name }),
      el("div", { class: "tag", text: cfg.app.tagline })
    ]));

    const gallery = buildGallery(cfg, lb);
    const maker = buildMaker(cfg, lb);
    const views = { gallery, maker };

    const tabs = el("nav", { role: "tablist" });
    [["gallery", cfg.text.galleryTab], ["maker", cfg.text.makerTab]].forEach(([id, label]) => {
      const b = el("button", { class: "tab", role: "tab", text: label });
      b.dataset.id = id;
      b.onclick = () => select(id);
      tabs.append(b);
    });

    const host = el("main");
    wrap.append(tabs, host);
    app.append(wrap);

    function select(id) {
      tabs.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.id === id)));
      host.textContent = "";
      host.append(views[id]);
      history.replaceState(null, "", "#" + id);
    }
    select(location.hash === "#maker" ? "maker" : "gallery");
  }

  boot();
})();
