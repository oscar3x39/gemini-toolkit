# Gemini Toolkit

> Multi-select and bulk-delete your Google Gemini sidebar conversations — with a file-manager-style selection UX. Runs **fully locally, zero network, no extra permissions**.

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/oscar3x39/gemini-toolkit/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

繁體中文說明 → [README.zh-TW.md](README.zh-TW.md)

Deleting Gemini conversations one by one is painful — three clicks and a confirm dialog *per chat*. Gemini Toolkit adds proper multi-select so you can clear dozens in one pass.

---

## Features

- **File-manager-style selection** — Cmd/Ctrl-click to toggle, Shift-click for ranges, or flip on **Select Mode** and just single-click.
- **Right-click to delete** — right-click any conversation → *Delete selected (N)*.
- **Keyword filter** — type a term, hit *Match*, and every conversation whose title contains it gets selected.
- **In-place confirm** — a small popover next to the delete button (no jarring native alert). **Enter** confirms, **Esc** cancels.
- **Abort mid-run** — stop a long deletion at any time.
- **Reader mode** — one click on the bottom-left "閱讀" button: Medium-style typography (20px body / 1.8 line-height) on a full-width column, 1.2em paragraph spacing, heading breathing room, higher-contrast inline code, system font (PingFang), slimmer input box. Right-click the button to tune width (full / 1400 / 1100 / 760) / font size (18–24) / font family (system / Google Sans / serif); settings persist.
- **Selection survives re-render** — tracked by conversation id, not DOM nodes, so scrolling or Gemini repainting the sidebar won't drop your picks.

---

## Install

### Option A — from a Release (recommended)

1. Download `gemini-toolkit.zip` from the [latest release](https://github.com/oscar3x39/gemini-toolkit/releases/latest) and unzip it.
2. Open `chrome://extensions` in Chrome (or any Chromium browser: Edge, Brave, Arc…).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped folder.
5. Open <https://gemini.google.com> and expand the left conversation list.

### Option B — from source

```bash
git clone https://github.com/oscar3x39/gemini-toolkit.git
```

Then follow steps 2–5 above, selecting the cloned folder.

> After any update, click the **↻ reload** icon on the extension card in `chrome://extensions`, then refresh the Gemini tab.

---

## Usage

**Selecting conversations**

| Action | Result |
|---|---|
| Toggle **Select Mode** (bottom-left bar) | Plain left-click selects — no modifier needed. State is remembered across reloads. |
| **Cmd/Ctrl + click** | Toggle a single conversation (when Select Mode is off; normal click still opens the chat). |
| **Shift + click** | Select the range between the last pick and this one. |
| **Right-click** a conversation | Pop up *Delete selected (N)*. |
| Click empty space, or **Esc** | Clear the selection. |

Selected conversations are highlighted in blue.

**Deleting**

1. Select what you want gone.
2. Right-click → *Delete selected*, or hit the red **Delete selected** button.
3. A confirm popover appears next to the button — **Enter** to confirm, **Esc** to cancel.
4. It runs each conversation through Gemini's native *⋮ menu → Delete → Confirm* flow. Hit **Abort** to stop early.

**Keyword filter** — type into the box and press *Match* (or Enter) to select every conversation whose title contains that text (case-insensitive, additive). Great for wiping a whole topic at once.

---

## How it works

Selectors and the delete flow were reverse-engineered against the live Gemini DOM and cross-checked with the open-source [Gemini Mass Delete](https://github.com/sinadalvand/GeminiMassDeleteExtension) (MIT):

- **Stable `data-test-id` selectors** — `gem-nav-list-item[data-test-id="conversation"]` (row), `actions-menu-button`, `delete-button`, `confirm-button` — not fragile Angular hash classes. Delete/confirm add `aria-label` + text fallbacks for other languages.
- **`simulateClick`** dispatches `mouseover/mousedown/mouseup + click`, because Angular Material menus often ignore a bare `.click()`.
- **Bottom-up deletion** — removing rows shifts the DOM, so it deletes from the bottom up.
- **DOM-removal confirmation** — each delete waits (up to 5s) for the row to actually leave the DOM before moving on; if it gets stuck, it sends `Escape` so one bad item can't block the batch.
- **Id-based selection** keyed off the `/app/<id>` href, so re-renders don't lose your picks.

If Gemini ever changes the row structure, the console logs `row 命中 0 筆` / `0 rows matched`; add a new candidate to `ROW_FALLBACKS` in `content.js`.

---

## Limitations

- **No date filtering.** Gemini's sidebar rows carry no timestamp — only a title, a pin icon, the menu, and the conversation id. Filtering by date would require intercepting Gemini's internal API, which is out of scope for a lightweight tool. In practice, lower in the list = older, so Shift-click from a point down to the bottom.

---

## Privacy

- Runs only on `https://gemini.google.com`.
- **No** `host_permissions`, **no** background page, **no** network requests of any kind.
- It only reads the sidebar DOM and drives Gemini's own delete UI — exactly what you'd do by hand.

---

## Credits

Selector reference and delete-flow patterns adapted from [Gemini Mass Delete](https://github.com/sinadalvand/GeminiMassDeleteExtension) by sinadalvand (MIT).

## License

[MIT](LICENSE)
