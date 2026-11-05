/* Pixel Studio: a small Photoshop-style image editor.
   Vanilla JS + Canvas 2D, no dependencies. Layers are full-size canvases.
   Limits: no selections/masks/pen/PSD. History is capped by a memory budget. */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const stage = $("#stage");
  const wrap = $("#canvasWrap");
  const board = $("#board");
  const overlay = $("#overlay");
  const empty = $("#empty");
  const textInput = $("#textInput");
  const bctx = board.getContext("2d", { willReadFrequently: true });
  const octx = overlay.getContext("2d");

  const MAX_DIM = 4096;
  const HISTORY_MB = 160;

  let doc = null;
  let zoom = 1;
  let tool = "brush";
  let fg = "#ffe21a";
  let bg = "#ffffff";
  let brushSize = 24;
  let toolOpacity = 1;
  let previewFilter = "none";
  let drag = null;
  let pan = null;
  let space = false;
  let cropRect = null;
  let history = [];
  let hIndex = -1;
  let layerCount = 1;
  let rafId = 0;

  /* ---------- small helpers ---------- */
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function ctxOf(c) { return c.getContext("2d", { willReadFrequently: true }); }
  function cloneCanvas(src) {
    const c = makeCanvas(src.width, src.height);
    c.getContext("2d").drawImage(src, 0, 0);
    return c;
  }
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => clamp(v, 0, 255).toString(16).padStart(2, "0")).join("");
  }
  function stamp() {
    const d = new Date();
    const p = (v) => String(v).padStart(2, "0");
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }
  function setStatus(msg) { $("#statusText").textContent = msg; }

  function makeLayer(name, canvas) {
    const c = canvas || makeCanvas(doc.w, doc.h);
    return { name, canvas: c, ctx: ctxOf(c), visible: true, opacity: 1, blend: "source-over" };
  }
  function activeLayer() {
    return doc && doc.layers[doc.active] ? doc.layers[doc.active] : null;
  }

  /* ---------- rendering ---------- */
  function compositeTo(ctx, withPreview) {
    ctx.clearRect(0, 0, doc.w, doc.h);
    const active = activeLayer();
    doc.layers.forEach((l) => {
      if (!l.visible) return;
      ctx.globalAlpha = l.opacity;
      ctx.globalCompositeOperation = l.blend;
      ctx.filter = withPreview && previewFilter !== "none" && l === active ? previewFilter : "none";
      ctx.drawImage(l.canvas, 0, 0);
    });
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function render() {
    if (!doc) return;
    compositeTo(bctx, true);
  }
  function requestRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; render(); });
  }
  function drawOverlay() {
    octx.clearRect(0, 0, doc.w, doc.h);
    if (!cropRect) return;
    const r = normalRect(cropRect);
    octx.fillStyle = "rgba(0,0,0,.55)";
    octx.fillRect(0, 0, doc.w, doc.h);
    octx.clearRect(r.x, r.y, r.w, r.h);
    octx.strokeStyle = "#ffe21a";
    octx.lineWidth = Math.max(1, 1 / zoom);
    octx.setLineDash([6 / zoom, 4 / zoom]);
    octx.strokeRect(r.x, r.y, r.w, r.h);
    octx.setLineDash([]);
  }
  function clearOverlay() {
    if (doc) octx.clearRect(0, 0, doc.w, doc.h);
  }

  /* ---------- zoom + layout ---------- */
  function applyZoom() {
    if (!doc) return;
    const w = Math.round(doc.w * zoom);
    const h = Math.round(doc.h * zoom);
    board.style.width = w + "px";
    board.style.height = h + "px";
    overlay.style.width = w + "px";
    overlay.style.height = h + "px";
    board.classList.toggle("pixel", zoom >= 2.5);
    $("#zoomLabel").textContent = Math.round(zoom * 100) + "%";
  }
  function resizeBoard() {
    board.width = doc.w;
    board.height = doc.h;
    overlay.width = doc.w;
    overlay.height = doc.h;
    applyZoom();
    updateDocInfo();
  }
  function fitZoom() {
    if (!doc) return;
    const z = Math.min((stage.clientWidth - 48) / doc.w, (stage.clientHeight - 48) / doc.h);
    zoom = clamp(z, 0.02, 8);
    applyZoom();
    centerStage();
  }
  function centerStage() {
    stage.scrollLeft = wrap.offsetLeft + wrap.offsetWidth / 2 - stage.clientWidth / 2;
    stage.scrollTop = wrap.offsetTop + wrap.offsetHeight / 2 - stage.clientHeight / 2;
  }
  function zoomAt(cx, cy, z) {
    if (!doc) return;
    z = clamp(z, 0.02, 8);
    const b = board.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const px = cx == null ? stageRect.left + stage.clientWidth / 2 : cx;
    const py = cy == null ? stageRect.top + stage.clientHeight / 2 : cy;
    const dx = (px - b.left) / zoom;
    const dy = (py - b.top) / zoom;
    zoom = z;
    applyZoom();
    const b2 = board.getBoundingClientRect();
    stage.scrollLeft += b2.left + dx * zoom - px;
    stage.scrollTop += b2.top + dy * zoom - py;
  }
  function docPoint(e) {
    const r = board.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  }

  /* ---------- history ---------- */
  function snapshot() {
    return {
      w: doc.w, h: doc.h, active: doc.active,
      layers: doc.layers.map((l) => ({
        name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend,
        canvas: cloneCanvas(l.canvas)
      }))
    };
  }
  function pushHistory() {
    if (!doc) return;
    if (hIndex < history.length - 1) history = history.slice(0, hIndex + 1);
    history.push(snapshot());
    const per = doc.w * doc.h * 4 * Math.max(1, doc.layers.length);
    const cap = clamp(Math.floor((HISTORY_MB * 1024 * 1024) / per), 2, 24);
    while (history.length > cap) history.shift();
    hIndex = history.length - 1;
    updateHistoryButtons();
  }
  function restore(s) {
    doc = { w: s.w, h: s.h, active: clamp(s.active, 0, s.layers.length - 1), layers: [] };
    doc.layers = s.layers.map((l) => {
      const c = cloneCanvas(l.canvas);
      return { name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, canvas: c, ctx: ctxOf(c) };
    });
    wrap.hidden = false;
    empty.hidden = true;
    resizeBoard();
    refreshLayers();
    syncLayerControls();
    render();
    updateHistoryButtons();
  }
  function updateHistoryButtons() {
    $("#undoBtn").disabled = hIndex <= 0;
    $("#redoBtn").disabled = hIndex >= history.length - 1;
  }
  function undo() {
    if (hIndex <= 0) return;
    hIndex--;
    restore(history[hIndex]);
    setStatus("Undo");
  }
  function redo() {
    if (hIndex >= history.length - 1) return;
    hIndex++;
    restore(history[hIndex]);
    setStatus("Redo");
  }

  /* ---------- document ---------- */
  function newDoc(w, h, bgColor) {
    commitText();
    w = clamp(Math.round(w) || 1, 1, MAX_DIM);
    h = clamp(Math.round(h) || 1, 1, MAX_DIM);
    doc = { w, h, active: 0, layers: [] };
    const l = makeLayer("Layer 1");
    if (bgColor) { l.ctx.fillStyle = bgColor; l.ctx.fillRect(0, 0, w, h); }
    doc.layers.push(l);
    layerCount = 1;
    history = [];
    hIndex = -1;
    wrap.hidden = false;
    empty.hidden = true;
    resizeBoard();
    pushHistory();
    fitZoom();
    refreshLayers();
    syncLayerControls();
    render();
    setStatus("New canvas " + w + " x " + h);
  }
  function openImage(img) {
    commitText();
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const s = Math.min(1, MAX_DIM / Math.max(w, h));
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
    doc = { w, h, active: 0, layers: [] };
    const l = makeLayer("Layer 1");
    l.ctx.drawImage(img, 0, 0, w, h);
    doc.layers.push(l);
    layerCount = 1;
    history = [];
    hIndex = -1;
    wrap.hidden = false;
    empty.hidden = true;
    resizeBoard();
    pushHistory();
    fitZoom();
    refreshLayers();
    syncLayerControls();
    render();
    setStatus("Opened " + w + " x " + h + (s < 1 ? " (scaled to 4096px)" : ""));
  }
  const DOC_CONTROLS = ["addLayer", "dupLayer", "upLayer", "downLayer", "delLayer",
    "layerOpacity", "blend", "bright", "contrast", "sat", "applyAdjust", "resetAdjust",
    "flatten", "clearLayer"];
  function updateControls() {
    const has = !!doc;
    DOC_CONTROLS.forEach((id) => { $("#" + id).disabled = !has; });
    $$("[data-filter]").forEach((b) => { b.disabled = !has; });
  }
  function updateDocInfo() {
    const info = $("#docInfo");
    const count = $("#layerCount");
    updateControls();
    if (!doc) {
      info.textContent = "No document";
      count.textContent = "0";
      return;
    }
    const n = doc.layers.length;
    count.textContent = String(n);
    info.innerHTML = "";
    const size = document.createElement("strong");
    size.textContent = doc.w + " × " + doc.h + " px";
    const meta = document.createElement("span");
    meta.textContent = n + (n === 1 ? " layer" : " layers");
    info.append(size, meta);
  }

  /* ---------- layers panel ---------- */
  function drawThumb(tc, l) {
    tc.clearRect(0, 0, 40, 40);
    const s = Math.min(40 / doc.w, 40 / doc.h);
    const w = doc.w * s;
    const h = doc.h * s;
    tc.drawImage(l.canvas, (40 - w) / 2, (40 - h) / 2, w, h);
  }
  function eyeSvg(on) {
    return on
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16"/><path d="M2 12s3.6-6 10-6c2 0 3.7.6 5.2 1.6M22 12s-3.6 6-10 6c-2 0-3.7-.6-5.2-1.6"/></svg>';
  }
  function refreshLayers() {
    const ul = $("#layers");
    ul.textContent = "";
    updateDocInfo();
    if (!doc) return;
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const l = doc.layers[i];
      const li = document.createElement("li");
      li.className = "layer" + (i === doc.active ? " active" : "") + (l.visible ? "" : " off");
      li.dataset.i = String(i);

      const eye = document.createElement("button");
      eye.type = "button";
      eye.className = "eye";
      eye.setAttribute("aria-label", l.visible ? "Hide layer" : "Show layer");
      eye.innerHTML = eyeSvg(l.visible);
      eye.addEventListener("click", (ev) => {
        ev.stopPropagation();
        l.visible = !l.visible;
        pushHistory();
        render();
        refreshLayers();
      });

      const th = document.createElement("canvas");
      th.className = "thumb";
      th.width = 40;
      th.height = 40;
      drawThumb(th.getContext("2d"), l);

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = l.name;
      name.title = "Double-click to rename";
      name.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        renameLayer(l, name);
      });

      li.append(eye, th, name);
      li.addEventListener("click", () => setActive(i));
      ul.appendChild(li);
    }
  }
  function refreshThumbs() {
    $$("#layers .layer").forEach((li) => {
      const i = +li.dataset.i;
      const l = doc.layers[i];
      const th = li.querySelector("canvas.thumb");
      if (l && th) drawThumb(th.getContext("2d"), l);
    });
  }
  function setActive(i) {
    if (!doc) return;
    doc.active = i;
    $$("#layers .layer").forEach((li) => li.classList.toggle("active", +li.dataset.i === i));
    syncLayerControls();
    render();
  }
  function renameLayer(l, nameEl) {
    const input = document.createElement("input");
    input.value = l.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const done = () => {
      l.name = input.value.trim() || l.name;
      refreshLayers();
    };
    input.addEventListener("blur", done, { once: true });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      else if (e.key === "Escape") { input.value = l.name; input.blur(); }
    });
  }
  function syncLayerControls() {
    const l = activeLayer();
    const op = l ? Math.round(l.opacity * 100) : 100;
    $("#layerOpacity").value = String(op);
    $("#layerOpacityVal").textContent = op + "%";
    $("#layerOpacity").disabled = !l;
    $("#blend").value = l ? l.blend : "source-over";
    $("#blend").disabled = !l;
  }
  function addLayer() {
    if (!doc) return;
    commitText();
    const l = makeLayer("Layer " + ++layerCount);
    doc.layers.splice(doc.active + 1, 0, l);
    doc.active++;
    pushHistory();
    refreshLayers();
    syncLayerControls();
    render();
    setStatus("Layer added");
  }
  function dupLayer() {
    if (!doc) return;
    const src = activeLayer();
    if (!src) return;
    const l = makeLayer(src.name + " copy", cloneCanvas(src.canvas));
    l.visible = src.visible;
    l.opacity = src.opacity;
    l.blend = src.blend;
    doc.layers.splice(doc.active + 1, 0, l);
    doc.active++;
    pushHistory();
    refreshLayers();
    syncLayerControls();
    render();
    setStatus("Layer duplicated");
  }
  function delLayer() {
    if (!doc) return;
    if (doc.layers.length === 1) { clearActiveLayer(); return; }
    doc.layers.splice(doc.active, 1);
    doc.active = clamp(doc.active, 0, doc.layers.length - 1);
    pushHistory();
    refreshLayers();
    syncLayerControls();
    render();
    setStatus("Layer deleted");
  }
  function moveLayer(dir) {
    if (!doc) return;
    const i = doc.active;
    const j = i + dir;
    if (j < 0 || j >= doc.layers.length) return;
    const t = doc.layers[i];
    doc.layers[i] = doc.layers[j];
    doc.layers[j] = t;
    doc.active = j;
    pushHistory();
    refreshLayers();
    syncLayerControls();
    render();
  }
  function clearActiveLayer() {
    const l = activeLayer();
    if (!l) return;
    l.ctx.clearRect(0, 0, doc.w, doc.h);
    pushHistory();
    render();
    refreshThumbs();
    setStatus("Layer cleared");
  }

  /* ---------- painting ---------- */
  function drawStamp(l, p, color, size, alpha, erase) {
    const c = l.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.globalCompositeOperation = erase ? "destination-out" : "source-over";
    c.fillStyle = color;
    c.beginPath();
    c.arc(p.x, p.y, Math.max(0.5, size / 2), 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  function drawSegment(l, a, b, color, size, alpha, erase) {
    const c = l.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.globalCompositeOperation = erase ? "destination-out" : "source-over";
    c.strokeStyle = color;
    c.lineWidth = size;
    c.lineCap = "round";
    c.lineJoin = "round";
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 0.6) drawStamp(l, b, color, size, alpha, erase);
    else {
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    c.restore();
  }
  function shapePath(ctx, a, b, shape, shift) {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    ctx.beginPath();
    if (shape === "line") {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      return;
    }
    if (shift) {
      const s = Math.max(Math.abs(dx), Math.abs(dy));
      dx = (dx < 0 ? -1 : 1) * s;
      dy = (dy < 0 ? -1 : 1) * s;
    }
    if (shape === "rect") {
      const x = Math.min(a.x, a.x + dx);
      const y = Math.min(a.y, a.y + dy);
      ctx.rect(x, y, Math.abs(dx), Math.abs(dy));
    } else {
      ctx.ellipse(a.x + dx / 2, a.y + dy / 2, Math.abs(dx) / 2, Math.abs(dy) / 2, 0, 0, Math.PI * 2);
    }
  }
  function paintShape(ctx, a, b, shape, shift, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    shapePath(ctx, a, b, shape, shift);
    if (shape === "line") ctx.stroke();
    else ctx.fill();
    ctx.restore();
  }

  /* ---------- flood fill ---------- */
  function floodFill(l, px, py, hex) {
    const c = l.canvas;
    const ctx = l.ctx;
    const w = c.width;
    const h = c.height;
    const x = clamp(Math.floor(px), 0, w - 1);
    const y = clamp(Math.floor(py), 0, h - 1);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const i0 = (y * w + x) * 4;
    const t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    const f = hexToRgb(hex);
    const tol = 32;
    const seen = new Uint8Array(w * h);
    const stack = [y * w + x];

    const match = (p) => {
      if (seen[p]) return false;
      const o = p * 4;
      return Math.abs(d[o] - t[0]) <= tol && Math.abs(d[o + 1] - t[1]) <= tol &&
        Math.abs(d[o + 2] - t[2]) <= tol && Math.abs(d[o + 3] - t[3]) <= tol;
    };
    const put = (p) => {
      const o = p * 4;
      d[o] = f[0]; d[o + 1] = f[1]; d[o + 2] = f[2]; d[o + 3] = 255;
    };

    while (stack.length) {
      const p = stack.pop();
      if (seen[p]) continue;
      const yy = Math.floor(p / w);
      let xl = p % w;
      let xr = xl;
      while (xl > 0 && match(yy * w + xl - 1)) xl--;
      while (xr < w - 1 && match(yy * w + xr + 1)) xr++;
      for (let xx = xl; xx <= xr; xx++) {
        const q = yy * w + xx;
        seen[q] = 1;
        put(q);
        if (yy > 0 && !seen[q - w] && match(q - w)) stack.push(q - w);
        if (yy < h - 1 && !seen[q + w] && match(q + w)) stack.push(q + w);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ---------- crop ---------- */
  function normalRect(r) {
    const x = clamp(Math.min(r.x, r.x + r.w), 0, doc.w);
    const y = clamp(Math.min(r.y, r.y + r.h), 0, doc.h);
    const x2 = clamp(Math.max(r.x, r.x + r.w), 0, doc.w);
    const y2 = clamp(Math.max(r.y, r.y + r.h), 0, doc.h);
    return { x, y, w: x2 - x, h: y2 - y };
  }
  function applyCrop() {
    if (!doc || !cropRect) return;
    const r = normalRect(cropRect);
    if (r.w < 2 || r.h < 2) { setStatus("Crop area is too small"); return; }
    const nw = Math.round(r.w);
    const nh = Math.round(r.h);
    doc.layers.forEach((l) => {
      const nc = makeCanvas(nw, nh);
      nc.getContext("2d").drawImage(l.canvas, -Math.round(r.x), -Math.round(r.y));
      l.canvas = nc;
      l.ctx = ctxOf(nc);
    });
    doc.w = nw;
    doc.h = nh;
    cropRect = null;
    resizeBoard();
    pushHistory();
    render();
    refreshLayers();
    setStatus("Cropped to " + nw + " x " + nh);
  }

  /* ---------- text ---------- */
  function beginText(p) {
    const l = activeLayer();
    if (!l || !l.visible) { setStatus("Select a visible layer first"); return; }
    commitText();
    textInput.hidden = false;
    textInput.value = "";
    textInput.dataset.x = String(p.x);
    textInput.dataset.y = String(p.y);
    textInput.dataset.size = String(brushSize);
    textInput.style.left = p.x * zoom + "px";
    textInput.style.top = p.y * zoom + "px";
    textInput.style.fontSize = Math.max(8, brushSize * zoom) + "px";
    textInput.style.color = fg;
    textInput.focus();
  }
  function commitText() {
    if (textInput.hidden) return;
    const value = textInput.value;
    const x = +textInput.dataset.x;
    const y = +textInput.dataset.y;
    const size = +textInput.dataset.size || brushSize;
    textInput.hidden = true;
    if (!value.trim()) return;
    const l = activeLayer();
    if (!l) return;
    const c = l.ctx;
    c.save();
    c.globalAlpha = toolOpacity;
    c.fillStyle = fg;
    c.font = '600 ' + size + "px Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.textBaseline = "top";
    value.split("\n").forEach((line, i) => c.fillText(line, x, y + i * size * 1.25));
    c.restore();
    pushHistory();
    render();
    refreshThumbs();
    setStatus("Text added");
  }
  function cancelText() {
    textInput.hidden = true;
    textInput.value = "";
  }

  /* ---------- filters ---------- */
  function filterString() {
    const b = +$("#bright").value;
    const c = +$("#contrast").value;
    const s = +$("#sat").value;
    const parts = [];
    if (b !== 100) parts.push("brightness(" + b + "%)");
    if (c !== 100) parts.push("contrast(" + c + "%)");
    if (s !== 100) parts.push("saturate(" + s + "%)");
    return parts.length ? parts.join(" ") : "none";
  }
  function updatePreview() {
    $("#brightVal").textContent = $("#bright").value;
    $("#contrastVal").textContent = $("#contrast").value;
    $("#satVal").textContent = $("#sat").value;
    previewFilter = filterString();
    render();
  }
  function resetAdjustUI() {
    $("#bright").value = "100";
    $("#contrast").value = "100";
    $("#sat").value = "100";
    $("#brightVal").textContent = "100";
    $("#contrastVal").textContent = "100";
    $("#satVal").textContent = "100";
    previewFilter = "none";
  }
  function bakeFilter(fs) {
    const l = activeLayer();
    if (!l) return;
    if (typeof bctx.filter === "undefined") {
      setStatus("Filters need a newer browser");
      return;
    }
    const tmp = makeCanvas(doc.w, doc.h);
    const t = tmp.getContext("2d");
    t.filter = fs;
    t.drawImage(l.canvas, 0, 0);
    t.filter = "none";
    l.canvas = tmp;
    l.ctx = ctxOf(tmp);
    pushHistory();
    render();
    refreshThumbs();
  }
  function flatten() {
    if (!doc) return;
    const tmp = makeCanvas(doc.w, doc.h);
    compositeTo(tmp.getContext("2d"), false);
    doc.layers = [makeLayer("Flattened", tmp)];
    doc.active = 0;
    pushHistory();
    refreshLayers();
    syncLayerControls();
    render();
    setStatus("Layers flattened");
  }

  /* ---------- import / export ---------- */
  function exportAs(type) {
    if (!doc) { setStatus("Open an image first"); return; }
    const tmp = makeCanvas(doc.w, doc.h);
    const t = tmp.getContext("2d");
    if (type === "image/jpeg") { t.fillStyle = "#ffffff"; t.fillRect(0, 0, doc.w, doc.h); }
    compositeTo(t, false);
    const ext = type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
    tmp.toBlob((blob) => {
      if (!blob) { setStatus("Export failed"); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pixel-studio-" + stamp() + "." + ext;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      setStatus("Exported " + ext.toUpperCase());
    }, type, 0.92);
  }
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) { setStatus("That file is not an image"); return; }
    if (doc && !window.confirm("Replace the current image?")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); openImage(img); };
    img.onerror = () => { URL.revokeObjectURL(url); setStatus("Could not read that image"); };
    img.src = url;
  }

  /* ---------- pointer input ---------- */
  function startPan(e) {
    pan = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
    stage.classList.add("panning");
  }
  function onDown(e) {
    if (!doc) return;
    if (e.button === 1 || space) { startPan(e); e.preventDefault(); return; }
    if (e.button !== 0) return;
    const p = docPoint(e);
    if (p.x < 0 || p.y < 0 || p.x >= doc.w || p.y >= doc.h) return;
    if (tool === "text") { beginText(p); e.preventDefault(); return; }
    if (tool === "picker") {
      const d = bctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
      fg = rgbToHex(d[0], d[1], d[2]);
      $("#fg").value = fg;
      setStatus("Picked " + fg);
      return;
    }
    const l = activeLayer();
    if (!l) return;
    if (!l.visible) { setStatus("That layer is hidden"); return; }

    if (tool === "fill") {
      floodFill(l, p.x, p.y, fg);
      pushHistory();
      render();
      refreshThumbs();
      setStatus("Filled");
      return;
    }
    try { board.setPointerCapture(e.pointerId); } catch (_) { /* synthetic or already released */ }

    if (tool === "brush" || tool === "eraser") {
      drag = {
        type: "stroke", layer: l, last: p, erase: tool === "eraser",
        color: fg, size: brushSize, alpha: toolOpacity
      };
      drawStamp(l, p, fg, brushSize, toolOpacity, tool === "eraser");
      requestRender();
    } else if (tool === "line" || tool === "rect" || tool === "ellipse") {
      drag = { type: "shape", layer: l, start: p, last: p, shape: tool, shift: e.shiftKey };
    } else if (tool === "move") {
      drag = { type: "move", layer: l, start: p, last: p, src: cloneCanvas(l.canvas) };
      l.ctx.clearRect(0, 0, doc.w, doc.h);
    } else if (tool === "crop") {
      drag = { type: "crop", start: p };
      cropRect = { x: p.x, y: p.y, w: 0, h: 0 };
    }
    e.preventDefault();
  }
  function onMove(e) {
    if (pan) {
      stage.scrollLeft = pan.sl - (e.clientX - pan.x);
      stage.scrollTop = pan.st - (e.clientY - pan.y);
      return;
    }
    if (doc) updateCursor(e);
    if (!drag) return;
    const p = docPoint(e);
    const shift = e.shiftKey;

    if (drag.type === "stroke") {
      const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      const events = coalesced.length ? coalesced : [e];
      events.forEach((ev) => {
        const q = docPoint(ev);
        drawSegment(drag.layer, drag.last, q, drag.color, drag.size, drag.alpha, drag.erase);
        drag.last = q;
      });
      requestRender();
    } else if (drag.type === "shape") {
      drag.last = p;
      drag.shift = shift;
      octx.clearRect(0, 0, doc.w, doc.h);
      paintShape(octx, drag.start, p, drag.shape, shift, toolOpacity);
    } else if (drag.type === "move") {
      drag.last = p;
      const l = drag.layer;
      const dx = Math.round(p.x - drag.start.x);
      const dy = Math.round(p.y - drag.start.y);
      l.ctx.clearRect(0, 0, doc.w, doc.h);
      l.ctx.drawImage(drag.src, dx, dy);
      requestRender();
    } else if (drag.type === "crop") {
      drag.last = p;
      cropRect = { x: drag.start.x, y: drag.start.y, w: p.x - drag.start.x, h: p.y - drag.start.y };
      drawOverlay();
    }
  }
  function onUp(e) {
    if (pan) { pan = null; stage.classList.remove("panning"); return; }
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === "stroke") {
      pushHistory();
      refreshThumbs();
    } else if (d.type === "shape") {
      const p = d.last;
      octx.clearRect(0, 0, doc.w, doc.h);
      paintShape(d.layer.ctx, d.start, p, d.shape, d.shift, toolOpacity);
      pushHistory();
      requestRender();
      refreshThumbs();
    } else if (d.type === "move") {
      pushHistory();
      refreshThumbs();
    } else if (d.type === "crop") {
      const r = normalRect(cropRect);
      setStatus(r.w > 4 && r.h > 4 ? "Press Enter to crop, Esc to cancel" : "Drag a crop area");
    }
  }
  function updateCursor(e) {
    const r = board.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      $("#cursorPos").textContent = "";
      return;
    }
    const p = docPoint(e);
    $("#cursorPos").textContent = Math.floor(p.x) + ", " + Math.floor(p.y) + " px";
  }

  /* ---------- tools + controls ---------- */
  const TOOL_HINTS = {
    move: "Move: drag the active layer",
    brush: "Brush: drag to paint (B). [ ] changes size",
    eraser: "Eraser: drag to remove pixels (E)",
    line: "Line: drag to draw (L)",
    rect: "Rectangle: drag to fill (R). Shift = square",
    ellipse: "Ellipse: drag to fill (O). Shift = circle",
    text: "Text: click, type, Enter to place (T)",
    fill: "Fill: click a region (G)",
    picker: "Eyedropper: click to pick a colour (I)",
    crop: "Crop: drag, then Enter to apply (C)"
  };
  function setTool(t) {
    commitText();
    tool = t;
    $$(".tool").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t)));
    if (t !== "crop" && cropRect) { cropRect = null; clearOverlay(); }
    board.style.cursor = t === "move" ? "move" : t === "text" ? "text" : "crosshair";
    setStatus(TOOL_HINTS[t] || "");
  }
  function swapColors() {
    const t = fg;
    fg = bg;
    bg = t;
    $("#fg").value = fg;
    $("#bg").value = bg;
  }

  /* ---------- wiring ---------- */
  $$(".tool").forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
  $("#fg").addEventListener("input", (e) => { fg = e.target.value; });
  $("#bg").addEventListener("input", (e) => { bg = e.target.value; });
  $("#swapColors").addEventListener("click", swapColors);

  $("#size").addEventListener("input", (e) => {
    brushSize = +e.target.value;
    $("#sizeVal").textContent = brushSize;
    if (!textInput.hidden) textInput.style.fontSize = Math.max(8, brushSize * zoom) + "px";
  });
  $("#opacity").addEventListener("input", (e) => {
    toolOpacity = +e.target.value / 100;
    $("#opacityVal").textContent = e.target.value + "%";
  });

  $("#zoomIn").addEventListener("click", () => zoomAt(null, null, zoom * 1.2));
  $("#zoomOut").addEventListener("click", () => zoomAt(null, null, zoom / 1.2));
  $("#fitBtn").addEventListener("click", fitZoom);

  $("#undoBtn").addEventListener("click", undo);
  $("#redoBtn").addEventListener("click", redo);
  $("#addLayer").addEventListener("click", addLayer);
  $("#dupLayer").addEventListener("click", dupLayer);
  $("#delLayer").addEventListener("click", delLayer);
  $("#upLayer").addEventListener("click", () => moveLayer(1));
  $("#downLayer").addEventListener("click", () => moveLayer(-1));
  $("#flatten").addEventListener("click", flatten);
  $("#clearLayer").addEventListener("click", clearActiveLayer);

  $("#layerOpacity").addEventListener("input", (e) => {
    const l = activeLayer();
    if (!l) return;
    l.opacity = +e.target.value / 100;
    $("#layerOpacityVal").textContent = e.target.value + "%";
    render();
  });
  $("#layerOpacity").addEventListener("change", () => {
    if (doc) pushHistory();
  });
  $("#blend").addEventListener("change", (e) => {
    const l = activeLayer();
    if (!l) return;
    l.blend = e.target.value;
    pushHistory();
    render();
  });

  ["bright", "contrast", "sat"].forEach((id) => {
    $("#" + id).addEventListener("input", updatePreview);
  });
  $("#applyAdjust").addEventListener("click", () => {
    const fs = filterString();
    if (fs === "none") { setStatus("No adjustment to apply"); return; }
    bakeFilter(fs);
    resetAdjustUI();
    render();
    setStatus("Adjustment applied");
  });
  $("#resetAdjust").addEventListener("click", () => { resetAdjustUI(); render(); });
  $$("[data-filter]").forEach((b) => b.addEventListener("click", () => {
    bakeFilter(b.dataset.filter);
    resetAdjustUI();
    render();
    setStatus("Filter applied");
  }));

  $("#newBtn").addEventListener("click", () => $("#newDialog").showModal());
  $("#emptyNew").addEventListener("click", () => $("#newDialog").showModal());
  $("#newForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const w = clamp(+$("#newW").value || 1, 1, MAX_DIM);
    const h = clamp(+$("#newH").value || 1, 1, MAX_DIM);
    const color = $("#newBg").value;
    $("#newDialog").close();
    newDoc(w, h, color);
  });

  const fileInput = $("#file");
  const pickFile = () => fileInput.click();
  $("#openBtn").addEventListener("click", pickFile);
  $("#emptyOpen").addEventListener("click", pickFile);
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) loadFile(f);
    fileInput.value = "";
  });
  $$("[data-export]").forEach((b) => b.addEventListener("click", () => {
    const details = b.closest("details");
    if (details) details.open = false;
    exportAs(b.dataset.export);
  }));

  board.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  stage.addEventListener("wheel", (e) => {
    if (!doc || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, zoom * (e.deltaY < 0 ? 1.12 : 0.893));
  }, { passive: false });

  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(); }
    else if (e.key === "Escape") { e.preventDefault(); cancelText(); }
  });
  textInput.addEventListener("blur", () => {
    // let a click elsewhere place the text before the next tool acts
    if (!textInput.hidden) commitText();
  });

  document.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items || !doc) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image/") === 0) {
        const f = items[i].getAsFile();
        if (f) { e.preventDefault(); loadFile(f); }
        break;
      }
    }
  });

  ["dragenter", "dragover"].forEach((t) => stage.addEventListener(t, (e) => {
    e.preventDefault();
    stage.classList.add("dropping");
  }));
  ["dragleave", "drop"].forEach((t) => stage.addEventListener(t, () => stage.classList.remove("dropping")));
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if ((tag === "button" || tag === "summary" || tag === "a") && (e.key === " " || e.key === "Enter")) return;

    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (k === "y") { e.preventDefault(); redo(); }
      else if (k === "s") { e.preventDefault(); exportAs("image/png"); }
      return;
    }
    if (e.key === " ") {
      if (!space) { space = true; stage.classList.add("spacing"); }
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      if (cropRect) { cropRect = null; clearOverlay(); setStatus("Crop cancelled"); }
      return;
    }
    if (e.key === "Enter" && cropRect) { e.preventDefault(); applyCrop(); return; }

    const map = { b: "brush", e: "eraser", v: "move", t: "text", l: "line", r: "rect", o: "ellipse", g: "fill", i: "picker", c: "crop" };
    const k = e.key.toLowerCase();
    if (map[k]) { e.preventDefault(); setTool(map[k]); return; }
    if (k === "[" || k === "]") {
      brushSize = clamp(brushSize + (k === "]" ? 4 : -4), 1, 120);
      $("#size").value = String(brushSize);
      $("#sizeVal").textContent = brushSize;
      return;
    }
    if (k === "x") { swapColors(); return; }
    if (k === "0") { fitZoom(); return; }
    if (k === "+" || k === "=") { zoomAt(null, null, zoom * 1.2); return; }
    if (k === "-") { zoomAt(null, null, zoom / 1.2); return; }
    if (k === "delete" || k === "backspace") { e.preventDefault(); clearActiveLayer(); }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === " ") { space = false; stage.classList.remove("spacing"); }
  });

  /* ---------- init ---------- */
  setTool("brush");
  updateHistoryButtons();
  syncLayerControls();
  updateControls();

  /* ---------- self-test: ?selftest=1 ---------- */
  function pixelAt(l, x, y) {
    return Array.from(l.ctx.getImageData(x, y, 1, 1).data);
  }
  function runSelfTest() {
    const fails = [];
    const ok = (name, cond) => { if (!cond) fails.push(name); };
    try {
      newDoc(120, 80, "#ffffff");
      ok("doc size", doc.w === 120 && doc.h === 80);
      ok("one layer", doc.layers.length === 1);
      const l0 = doc.layers[0];
      l0.ctx.fillStyle = "#ff0000";
      l0.ctx.fillRect(10, 10, 20, 20);
      pushHistory();
      ok("red pixel", pixelAt(doc.layers[0], 15, 15).join(",") === "255,0,0,255");
      addLayer();
      ok("two layers", doc.layers.length === 2);
      undo();
      ok("undo layers", doc.layers.length === 1);
      ok("undo keeps red", pixelAt(doc.layers[0], 15, 15)[0] === 255);
      redo();
      ok("redo layers", doc.layers.length === 2);
      undo();
      doc.active = 0;
      floodFill(doc.layers[0], 0, 0, "#0000ff");
      ok("flood fill", pixelAt(doc.layers[0], 0, 0).slice(0, 3).join(",") === "0,0,255");
      const t = makeCanvas(120, 80);
      compositeTo(t.getContext("2d"), false);
      ok("composite", t.getContext("2d").getImageData(50, 50, 1, 1).data[2] === 255);
    } catch (err) {
      fails.push("crash: " + err.message);
    }
    document.title = fails.length ? "SELFTEST FAIL: " + fails.join(", ") : "SELFTEST PASS";
  }
  if (new URLSearchParams(location.search).has("selftest")) setTimeout(runSelfTest, 100);
})();
