<div align="center">

<img src="https://raw.githubusercontent.com/da0t-exe/Notes/main/public/icon.png" width="72" alt="Notes icon" />

<h1>Notes</h1>

<p>A minimalist native text editor for Windows.</p>
<p><sub>Tauri 2 · Rust · React · CodeMirror 6</sub></p>

[![version](https://img.shields.io/badge/v0.4-000000?style=flat-square)](https://github.com/da0t-exe/Notes/releases/latest)
[![platform](https://img.shields.io/badge/Windows-000000?style=flat-square)](#)
[![license](https://img.shields.io/badge/MIT-000000?style=flat-square)](#)

<img src="https://raw.githubusercontent.com/da0t-exe/Notes/main/public/screenshot.png" width="720" alt="Notes screenshot" />

</div>

## What it does

- Opens text, code and log files with automatic encoding and line-ending detection
- Syntax highlighting for 25 languages, dropped automatically past 1.5 MB so large
  files stay responsive
- Live Markdown preview, sanitised before rendering
- Streams files over 2 MB so the window keeps painting while they load
- Prompts before closing a tab or quitting with unsaved edits
- Notes are stored locally in IndexedDB; files on disk are edited in place

Windows only. No telemetry, no network access — the app declares a
content-security policy that permits none.

## Status

v0.4 is a rebuild. Working today: opening, editing, saving, search, Markdown
preview, persistence. Not yet reimplemented from v0.3: categories, trash,
checklists, per-note password locking, and the tab bar.

## Shortcuts

| | |
|---|---|
| `Ctrl+N` | New note |
| `Ctrl+O` | Open file |
| `Ctrl+S` / `Ctrl+Shift+S` | Save / Save as |
| `Ctrl+W` | Close |
| `Ctrl+F` | Find |
| `Ctrl+B` | Toggle sidebar |
| `Alt+P` | Markdown preview |
| `Ctrl+±` / `Ctrl+0` | Font size |

## Development

Requires **Windows**, [Node.js](https://nodejs.org/) 18+ and [Rust](https://rustup.rs/).

```bash
npm install
npm run app
```

`npm run check` runs the type checker, the linter and the test suite together.
It gates every commit.

## Build

```bash
npm run dist
```

## License

MIT — see [LICENSE](LICENSE).

<div align="center">
<sub>Built by <a href="https://github.com/da0t-exe">da0t-exe</a>. v0.1–v0.3 with Cursor, v0.4 onward with Claude Code.</sub>
</div>
