#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use encoding_rs::{Encoding, UTF_16BE, UTF_16LE, UTF_8, WINDOWS_1252};
use serde::Serialize;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

/// Refuse to load anything past this before allocating for it. The v0.3 build
/// read the whole file first and only checked the size in the frontend, so a
/// multi-gigabyte pick was fully resident before it could be rejected.
const MAX_OPEN_BYTES: u64 = 80 * 1024 * 1024;

/// Paths the user has explicitly opened or saved to during this run.
///
/// `write_file` takes a path from the webview, so without this an injected
/// script could write anywhere the process can reach. Membership is only ever
/// granted through a native dialog the user interacted with.
#[derive(Default)]
struct Session {
  writable: Mutex<HashSet<PathBuf>>,
}

impl Session {
  fn allow(&self, path: &Path) {
    if let Ok(mut set) = self.writable.lock() {
      set.insert(canonical(path));
    }
  }

  fn allows(&self, path: &Path) -> bool {
    self
      .writable
      .lock()
      .map(|set| set.contains(&canonical(path)))
      .unwrap_or(false)
  }
}

/// Falls back to the path as given when it does not resolve, so a target that
/// does not exist yet still compares consistently against itself.
fn canonical(path: &Path) -> PathBuf {
  fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedFile {
  path: String,
  name: String,
  text: String,
  size: u64,
  last_modified: u64,
  encoding: String,
  binary: bool,
  line_ending: String,
}

#[derive(Serialize)]
struct SavedFile {
  path: String,
  name: String,
}

fn detect_encoding(bytes: &[u8]) -> &'static Encoding {
  if bytes.starts_with(&[0xef, 0xbb, 0xbf]) {
    return UTF_8;
  }
  if bytes.starts_with(&[0xff, 0xfe]) {
    return UTF_16LE;
  }
  if bytes.starts_with(&[0xfe, 0xff]) {
    return UTF_16BE;
  }
  let head = &bytes[..bytes.len().min(65_536)];
  match UTF_8.decode_without_bom_handling_and_without_replacement(head) {
    Some(_) => UTF_8,
    None => WINDOWS_1252,
  }
}

fn is_binary(bytes: &[u8], encoding: &'static Encoding) -> bool {
  // UTF-16 text is half NUL bytes in the ASCII range, so the heuristic below
  // would reject all of it.
  if encoding == UTF_16LE || encoding == UTF_16BE {
    return false;
  }
  let n = bytes.len().min(8192);
  let mut control = 0usize;
  for &b in &bytes[..n] {
    if b == 0 {
      return true;
    }
    if b < 9 || (b > 13 && b < 32) {
      control += 1;
    }
  }
  n > 0 && (control as f32) / (n as f32) > 0.08
}

/// Mirrors `detectLineEnding` in src/lib/encoding.ts: the dominant style wins
/// rather than the first one seen.
fn line_ending(text: &str) -> &'static str {
  let crlf = text.matches("\r\n").count();
  let cr = text.matches('\r').count() - crlf;
  let lf = text.matches('\n').count() - crlf;
  if crlf > 0 && crlf >= lf && crlf >= cr {
    "CRLF"
  } else if cr > lf && cr > crlf {
    "CR"
  } else {
    "LF"
  }
}

fn encoding_label(enc: &'static Encoding) -> String {
  if enc == UTF_8 {
    "utf-8".into()
  } else if enc == UTF_16LE {
    "utf-16le".into()
  } else if enc == UTF_16BE {
    "utf-16be".into()
  } else {
    "windows-1252".into()
  }
}

fn read_opened(path: &Path) -> Result<OpenedFile, String> {
  let meta = fs::metadata(path).map_err(|e| e.to_string())?;
  if meta.len() > MAX_OPEN_BYTES {
    return Err(format!(
      "{} is {:.0} MB, over the {} MB limit",
      path.file_name().unwrap_or_default().to_string_lossy(),
      meta.len() as f64 / 1_048_576.0,
      MAX_OPEN_BYTES / 1_048_576
    ));
  }

  let bytes = fs::read(path).map_err(|e| e.to_string())?;
  let encoding = detect_encoding(&bytes);
  let binary = is_binary(&bytes, encoding);
  let (cow, _, _) = encoding.decode(&bytes);
  let text = cow.into_owned();
  let modified = meta
    .modified()
    .ok()
    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0);

  Ok(OpenedFile {
    path: path.to_string_lossy().into_owned(),
    name: path
      .file_name()
      .map(|n| n.to_string_lossy().into_owned())
      .unwrap_or_else(|| "untitled".into()),
    size: meta.len(),
    last_modified: modified,
    encoding: encoding_label(encoding),
    binary,
    line_ending: line_ending(&text).into(),
    text,
  })
}

fn encode_text(text: &str, encoding: &str) -> Vec<u8> {
  match encoding {
    "utf-16le" => {
      let mut out = vec![0xff, 0xfe];
      out.extend(text.encode_utf16().flat_map(|u| u.to_le_bytes()));
      out
    }
    "utf-16be" => {
      let mut out = vec![0xfe, 0xff];
      out.extend(text.encode_utf16().flat_map(|u| u.to_be_bytes()));
      out
    }
    "windows-1252" | "iso-8859-1" => {
      let (cow, _, _) = WINDOWS_1252.encode(text);
      cow.into_owned()
    }
    _ => text.as_bytes().to_vec(),
  }
}

#[tauri::command]
async fn open_files(
  app: tauri::AppHandle,
  session: tauri::State<'_, Session>,
) -> Result<Vec<OpenedFile>, String> {
  let handle = app.clone();
  let picked = tauri::async_runtime::spawn_blocking(move || {
    handle
      .dialog()
      .file()
      // All files first, deliberately. Nothing in the pipeline restricts what
      // can be opened — read_opened takes any path, sniffs the encoding and
      // flags binaries — so leading with a nine-extension filter only hid
      // openable files behind a dropdown.
      .add_filter("All files", &["*"])
      .add_filter(
        "Text documents",
        &["txt", "md", "markdown", "log", "csv", "tsv", "json", "xml", "yml", "yaml", "toml", "ini", "conf"],
      )
      .add_filter(
        "Code",
        &[
          "js", "mjs", "cjs", "jsx", "ts", "tsx", "py", "rs", "go", "java", "kt", "c", "cpp", "h",
          "hpp", "cs", "html", "css", "scss", "php", "rb", "sql", "sh", "bash", "ps1", "lua", "vue",
          "svelte", "swift", "r",
        ],
      )
      .blocking_pick_files()
  })
  .await
  .map_err(|e| e.to_string())?;

  let Some(paths) = picked else {
    return Ok(vec![]);
  };

  let mut out = Vec::new();
  for file in paths {
    let path: PathBuf = file.into_path().map_err(|e| e.to_string())?;
    let opened = read_opened(&path)?;
    session.allow(&path);
    out.push(opened);
  }
  Ok(out)
}

#[tauri::command]
fn write_file(
  session: tauri::State<'_, Session>,
  file_path: String,
  text: String,
  encoding: String,
) -> Result<SavedFile, String> {
  let path = PathBuf::from(&file_path);
  if !session.allows(&path) {
    return Err("This file was not opened in this session".into());
  }
  fs::write(&path, encode_text(&text, &encoding)).map_err(|e| e.to_string())?;
  Ok(SavedFile {
    path: file_path,
    name: path
      .file_name()
      .map(|n| n.to_string_lossy().into_owned())
      .unwrap_or_default(),
  })
}

#[tauri::command]
async fn save_file_as(
  app: tauri::AppHandle,
  session: tauri::State<'_, Session>,
  name: String,
  text: String,
  encoding: String,
) -> Result<Option<SavedFile>, String> {
  let handle = app.clone();
  let suggested = name.clone();
  let picked = tauri::async_runtime::spawn_blocking(move || {
    handle
      .dialog()
      .file()
      .set_file_name(&suggested)
      .add_filter("All files", &["*"])
      .add_filter("Markdown", &["md"])
      .add_filter("Text", &["txt"])
      .blocking_save_file()
  })
  .await
  .map_err(|e| e.to_string())?;

  let Some(file) = picked else {
    return Ok(None);
  };
  let path: PathBuf = file.into_path().map_err(|e| e.to_string())?;
  fs::write(&path, encode_text(&text, &encoding)).map_err(|e| e.to_string())?;
  session.allow(&path);

  Ok(Some(SavedFile {
    name: path
      .file_name()
      .map(|n| n.to_string_lossy().into_owned())
      .unwrap_or_default(),
    path: path.to_string_lossy().into_owned(),
  }))
}

fn main() {
  // No native menu bar: the window runs with `decorations: false` and a custom
  // titlebar, and Win32 attaches menus to the frame — so the v0.3 File/Edit/View
  // menu was built, wired to an event channel, and never rendered. Shortcuts in
  // App.tsx are the real surface.
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      app.manage(Session::default());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![open_files, write_file, save_file_as])
    .run(tauri::generate_context!())
    .expect("failed to start Notes");
}
