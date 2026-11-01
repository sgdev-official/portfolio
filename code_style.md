# JS DevForge — Code Style Guide & Engineering Standards

Welcome to the official **Code Style Guide** for the JS DevForge ecosystem. This document dictates the formatting, architecture, performance rules, and design patterns for all contributions across HTML, CSS, and Vanilla JavaScript.

---

## 1. Core Philosophy

1. **Zero External Dependencies:** No NPM packages, heavy frameworks, or external runtime UI libraries. Everything must run natively in standard modern web browsers.
2. **No-Eval Security Policy:** Never use `eval()`, `new Function()`, or dynamic script injection executing untrusted string input.
3. **Local-First & Light Overhead:** Favor client-side computation, Web Storage APIs, and lightweight URL-based service integrations (e.g., Pollinations AI).
4. **Performance & Clean State:** Keep memory leaks to zero by clearing intervals, unbinding unused listeners, and using pure CSS transitions over heavy JS render loops where possible.

---

## 2. JavaScript Guidelines

### Modularity & Scope
* Wrap all module files in **Immediately Invoked Function Expressions (IIFE)** or export module patterns to avoid polluting the global `window` namespace.
* Share state across modules via explicit window properties (e.g., `window.DevForge = window.DevForge || {}`).

```javascript
// Good: Encapsulated IIFE Pattern
(function (DevForge) {
  'use strict';

  const Gallery = {
    init() {
      this.bindEvents();
    },
    bindEvents() {
      // Event logic
    }
  };

  DevForge.Gallery = Gallery;
})(window.DevForge = window.DevForge || {});
```

### Variable Declaration & Naming
* Use `const` by default. Use `let` only when reassignment is explicitly required. Never use `var`.
* **Variables & Functions:** `camelCase` (e.g., `generateImage`, `activePrompt`).
* **Constants:** `UPPER_SNAKE_CASE` (e.g., `POLLINATIONS_BASE_URL`).
* **DOM Elements:** Suffix DOM variables with `El` or `$`, e.g., `submitBtnEl` or `galleryGridEl`.

### Async Logic & Fetching
* Use `async / await` over nested `.then()` promises for clarity.
* Wrap API / dynamic asset fetches inside `try...catch` blocks with gracefully degrading fallback UI.

```javascript
async function fetchImageStream(prompt) {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;
    return imageUrl;
  } catch (error) {
    console.error('Failed to generate image URL:', error);
    return 'fallback-placeholder.svg';
  }
}
```

---

## 3. HTML & DOM Structure

* Use semantic HTML5 elements (`<header>`, `<main>`, `<section>`, `<article>`, `<footer>`).
* Maintain clear hierarchy; all interactive elements (`button`, `input`, `a`) must have visible `:focus-visible` outlines and proper ARIA labels where applicable.
* Use `data-*` attributes for JavaScript interaction hooks rather than querying styling classes directly.

```html
<!-- Good: Data attributes for JS targeting -->
<button class="btn btn-primary" data-action="generate-ai-img">
  Generate
</button>
```

---

## 4. CSS & Styling Rules

### Design Tokens & Variables
* Maintain site-wide themes via CSS variables defined inside `:root` in `style.css`.
* Do not hardcode HEX or RGB values directly in component rules.

```css
:root {
  --bg-primary: #0a0c10;
  --text-main: #e6edf3;
  --accent-color: #58a6ff;
  --border-radius-sm: 6px;
  --transition-fast: 0.2s ease;
}

.gallery-card {
  background-color: var(--bg-primary);
  border: 1px solid var(--accent-color);
  border-radius: var(--border-radius-sm);
  transition: transform var(--transition-fast);
}
```

### Layouts
* Use CSS Grid for overall layout structures and dynamic galleries.
* Use Flexbox for micro-layouts (navigation bars, input groups, button alignments).

---

## 5. File Structure Reference

```text
├── index.html        # Core HTML Entrypoint
├── style.css         # Main Design Tokens & Base Styles
├── script.js        # Core App Routing & State Controller
├── fx.js            # Visual Effects & Procedural Animations
├── lab.js            # Tools, Mini-apps & AI Integrations
└── extras.css        # Utility Classes & Specialized Component CSS
```

---

## 6. Code Review Checklist

Before committing or releasing new tools/modules:
- [ ] Is all code free of `eval()` or unsanitized `innerHTML` injection?
- [ ] Are all new modules scoped inside an IIFE or clean namespace?
- [ ] Are CSS colors using `:root` design tokens?
- [ ] Does the UI render cleanly on mobile viewports without horizontal scrolling?
