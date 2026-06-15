# FlashDash

A portable dashboard that lives on a USB drive. Plug it in, open it in any browser, and launch your JavaScript mini-apps from one place — no internet required, no install, no cloud.

---

## Features

- **Runs offline** — everything is stored in `localStorage` or bundled on disk
- **Two app sources** — upload a local `.js` file or paste a raw script URL
- **Annotation metadata** — declare name, icon, and description directly in your script
- **Drag-and-drop** upload support
- **Sandboxed runner** — each app runs in an isolated `<iframe>` with no access to the dashboard
- **Quick Access** row on the home screen for one-click launch
- **Search** across all your apps by name
- **Keyboard shortcut** — `Esc` closes any running app

---

## Getting Started

Copy the folder onto a USB drive (or anywhere) and open `index.html` in any browser. No build step, no install, no server required.

---

## Adding Apps

Click **+ Add App** in the Apps tab. You can either:

- **Drop or browse a `.js` file** from your drive — the source is stored in `localStorage`
- **Paste a raw JS URL** — FlashDash fetches and runs it on launch (e.g. a `raw.githubusercontent.com` or Gist raw link)

File and URL are mutually exclusive; setting one clears the other.

> Apps run in a sandboxed `<iframe srcdoc allow-scripts>`. They cannot touch the dashboard DOM or navigate the parent page.

---

## Writing an App

An app is a plain `.js` file. Declare metadata with comment annotations at the top:

```js
// @name        My Clock
// @icon        ⚡
// @description Shows the current time

setInterval(() => {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;
                height:100vh;font-family:monospace;font-size:5rem">
      ${new Date().toLocaleTimeString()}
    </div>`;
}, 1000);
```

| Annotation | Required | Description |
|---|---|---|
| `// @name` | No — falls back to filename | Display name on the card and Quick Access tile |
| `// @icon` | No — defaults to a bolt SVG | Emoji, a named icon, or a raw inline SVG string (see below) |
| `// @description` | No | Short subtitle shown on the app card |

The script has full access to browser APIs inside the sandbox (`document`, `fetch`, `localStorage`, `setInterval`, Canvas, Web Audio, etc.).

### Icon formats

`// @icon` accepts three formats:

```js
// @icon  ⚡                                   // any emoji
// @icon  folder                               // named icon (resolved by FlashDash)
// @icon  <svg viewBox="0 0 24 24">…</svg>    // raw inline SVG on one line
```

**Available named icons:**

| Name | Shape |
|---|---|
| `bolt` | Lightning bolt |
| `circle` | Filled circle |
| `search` | Magnifying glass |
| `close` | × mark |
| `plus` | + sign |
| `folder` | Folder |
| `pencil` | Pencil / edit |
| `check` | Checkmark |
| `upload` | Upload arrow |

> Named icons use `currentColor` so they match your app card's inherited text colour. Add more to `NAMED_ICONS` in `icons.js`.

### Minimal example

```js
// @name  Hello
// @icon  👋

document.body.style = 'font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;font-size:3rem';
document.body.textContent = 'Hello from FlashDash!';
```

---

## Project Structure

```
flashdash/
├── index.html   — layout and markup
├── style.css    — dark theme
├── main.js      — state, rendering, app viewer, modal logic
├── icons.js     — SVG icon string exports
└── README.md
