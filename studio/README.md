# Pixel Studio

A small Photoshop-style image editor that runs in the browser. Vanilla JS and
Canvas 2D — no frameworks, no build step, no image ever leaves the page.

This is **not** a Photoshop clone. It covers the common editing loop: open an
image, paint on layers, adjust it, and export.

## Run

Either one works:

```bash
# Node (no dependencies)
node server.js 8081

# or Python
python -m http.server 8081
```

Open <http://localhost:8081>. It also runs as a static folder on GitHub Pages
(or any host) because there is no server-side code.

## What it does

| Area | Included |
|---|---|
| File | Open, drag & drop, paste, new canvas up to 4096 px, export PNG / JPG / WebP |
| Paint | Brush, eraser, line, rectangle, ellipse, text, flood fill, eyedropper |
| Layers | Add, duplicate, delete, reorder, rename, hide, opacity, blend modes |
| Adjust | Brightness, contrast, saturation, grayscale, invert, sepia, blur |
| View | Zoom (Ctrl + wheel), pan (Space + drag or middle mouse), fit |
| History | Undo / redo, capped by a 160 MB memory budget |

## Shortcuts

| Key | Action |
|---|---|
| `B` `E` `V` `T` `L` `R` `O` `G` `I` `C` | Brush, Eraser, Move, Text, Line, Rect, Ellipse, Fill, Picker, Crop |
| `[` `]` | Brush size |
| `X` | Swap foreground / background colour |
| `Ctrl + Z` / `Ctrl + Shift + Z` | Undo / redo |
| `Ctrl + S` | Export PNG |
| `+` `-` `0` | Zoom in / out / fit |
| `Space + drag` | Pan |
| `Delete` | Clear the active layer |
| `Enter` / `Esc` | Apply / cancel a crop, or place / cancel text |

## Limits

- No selections, masks, pen tool, smart objects, PSD import/export or plugins.
- Layers are full-size canvases, so very large documents use more memory.
- Image data stays local; nothing is uploaded.
