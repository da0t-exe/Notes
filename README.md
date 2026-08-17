<div align="center">

<img src="https://raw.githubusercontent.com/da0t-exe/Notes/main/public/icon.png" width="72" alt="Notes icon" />

<h1>Notes</h1>

<p>A minimalist, native tabbed text editor for Windows.</p>
<p><sub>Tauri + Rust · v0.3</sub></p>

[<img src="https://raw.githubusercontent.com/da0t-exe/Notes/main/public/download.png" height="48" alt="Download" />](https://github.com/da0t-exe/Notes/releases/latest)

[![version](https://img.shields.io/badge/v0.3-000000?style=flat-square)](https://github.com/da0t-exe/Notes/releases/latest)
[![platform](https://img.shields.io/badge/Windows-000000?style=flat-square)](#)
[![license](https://img.shields.io/badge/MIT-000000?style=flat-square)](#)

<img src="https://raw.githubusercontent.com/da0t-exe/Notes/main/public/screenshot.png" width="720" alt="Notes screenshot" />

</div>

## Overview

Notes is a native Windows app built with Tauri + Rust. Fast startup, tabbed
interface, live Markdown, no Electron. Built with [Cursor Agent](https://cursor.com).

- Live Markdown rendering
- Notepad-style tabs
- Handles large files (logs, JSON, code)
- `Ctrl+O` to open a file

## Installation

**Portable** — [Notes-v0.3.exe](https://github.com/da0t-exe/Notes/releases/latest)

**App Installer** — [Notes.appinstaller](https://github.com/da0t-exe/Notes/releases/latest) (keep the `.msix` next to it, or install straight from the release)

## License

MIT — see [LICENSE](https://github.com/da0t-exe/Notes/blob/main/LICENSE).

## Development

Needs **Windows**, [Node.js](https://nodejs.org/) 18+, and [Rust](https://rustup.rs/).

```bash
npm install
npm run app
```

## Build & distribution

```bash
npm run dist
npm run dist:appinstaller
```

<div align="center">
<sub>Built with Rust & Tauri by <a href="https://github.com/da0t-exe">da0t-exe</a> (and Cursor Agent)</sub>
</div>
