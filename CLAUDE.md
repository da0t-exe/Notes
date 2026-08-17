# Notes

A minimalist native tabbed text editor for Windows. Tauri v2 + Rust backend,
React 19 + TypeScript frontend, CodeMirror 6 editing surface.

Repo: https://github.com/da0t-exe/Notes · License: MIT

## Commands

```bash
npm install          # first time only
npm run app          # run the desktop app (tauri dev)
npm run dev          # browser-only dev server, no native shell
npm run check        # tsc --noEmit && oxlint && vitest run  ← run before every commit
npm run test         # vitest run
npm run dist         # build the Windows installer (NSIS)
```

`npm run check` is the gate. Nothing gets committed that does not pass it.

## Layout

```
src/
  main.tsx           entry point — mounts App, nothing else
  App.tsx            shell: routing between screens, global shortcuts
  components/        presentational pieces shared across screens
  screens/           one file per full-screen view
  editor/            CodeMirror host, checklist editor, editor theme
  lib/               pure logic — no React, no DOM side effects
  store/             state container (useSyncExternalStore)
src-tauri/           Rust: file IO, dialogs, native menu, window
```

`lib/` must stay free of React and of DOM mutation. That is what makes it
testable, and every module in it has a `.test.ts` next to it.

## Product rule: files vs notes

The app serves two object types and they must not borrow each other's chrome.

| | `fromDisk: false` — a **note** | `fromDisk: true` — a **file** |
|---|---|---|
| Lives in | IndexedDB | the filesystem |
| Has | categories, images, pin, trash, lock | encoding, line endings, dirty state |
| Deleting means | move to trash (recoverable) | close the tab (file untouched) |

`NoteChrome` and `EditorActions` branch on `note.fromDisk`. A file opened from
disk never shows categories, image attachments or the trash action. This was
the single biggest incoherence in v0.3 — do not reintroduce it.

## Regressions to never reintroduce

The v0.3 tree (archived at `Desktop/Notes by Cursor`, scored 58/100) shipped
several features that looked complete but were never wired. Each has a
corresponding guard here:

| v0.3 defect | Guard |
|---|---|
| `marked` output injected raw → XSS → arbitrary file write via `write_file` | DOMPurify on every render path; CSP set in `tauri.conf.json`; `write_file` validates the path against session-opened files |
| `setAppPin` / `lockAppNow` exported, never called → unreachable lock screen | A feature is not merged until a UI path reaches it |
| Language picker with 8 locales and no i18n layer | No setting ships without behaviour behind it |
| Fingerprint icon that only submits a typed PIN | No affordance implies a capability the app lacks |
| `.tabs` CSS with no tab bar in the JSX; `openTabs` tracked, never rendered | Dead CSS and dead state are lint/review failures |
| `closeTab` discarded unsaved edits silently | Dirty-state guard on tab close and on window close |
| `persist()` rewrote every note every 400 ms | Persistence is incremental — only ids in the dirty set |
| `tsconfig` had no `strict` | `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` on |
| French strings left in an English UI | UI copy is English; French exists only in conversation |

## Platform notes

**Window close needs two permissions.** Registering `onCloseRequested` changes
how a window shuts down: `close()` only emits the request, and the JS runtime
calls `destroy()` afterwards to actually close it. So the capability list needs
`core:window:allow-close` *and* `core:window:allow-destroy`. With only the
first, the titlebar close button silently rejects and the app cannot be closed.
This surfaced the moment the unsaved-changes guard was added.

**Vite must not watch `src-tauri`.** Cargo rewrites build artifacts there while
the dev server is live and chokidar dies with EBUSY. Handled in `vite.config.ts`.

## Conventions

- **Commits**: one logical change each, imperative mood, and `npm run check`
  passes before every one. Small commits are the recovery mechanism for a
  codebase whose author does not have all of it in their head.
- **Comments**: explain *why*, never *what*. The surrounding code is dense and
  low-comment; match it.
- **No `any`**, no `dangerouslySetInnerHTML` without DOMPurify (oxlint enforces
  both).
- **Secrets**: `packaging/` and `*.pfx` are gitignored. The code-signing key
  lives only in `Desktop/Notes by Cursor/Notes/packaging/cert/`. It must never
  enter this repo.

## History

Built with Cursor through v0.3, then rebuilt clean from v0.4 with Claude Code.
The v0.3 tree is preserved in full (with its git history) at
`C:\Users\Dot\Desktop\Notes by Cursor\`.
