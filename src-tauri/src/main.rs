#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use encoding_rs::{Encoding, UTF_8, UTF_16BE, UTF_16LE, WINDOWS_1252};
use serde::Serialize;
use tauri::Emitter;
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri_plugin_dialog::DialogExt;

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
  if bytes.len() >= 3 && bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf {
    return UTF_8;
  }
  if bytes.len() >= 2 && bytes[0] == 0xff && bytes[1] == 0xfe {
    return UTF_16LE;
  }
  if bytes.len() >= 2 && bytes[0] == 0xfe && bytes[1] == 0xff {
    return UTF_16BE;
  }
  match UTF_8.decode_without_bom_handling_and_without_replacement(&bytes[..bytes.len().min(65_536)]) {
    Some(_) => UTF_8,
    None => WINDOWS_1252,
  }
}

fn is_binary(bytes: &[u8], encoding: &'static Encoding) -> bool {
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

fn line_ending(text: &str) -> &'static str {
  if text.contains("\r\n") {
    "CRLF"
  } else if text.contains('\r') {
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
  let bytes = fs::read(path).map_err(|e| e.to_string())?;
  let meta = fs::metadata(path).map_err(|e| e.to_string())?;
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
      .unwrap_or_else(|| "fichier".into()),
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
async fn open_files(app: tauri::AppHandle) -> Result<Vec<OpenedFile>, String> {
  let handle = app.clone();
  let picked = tauri::async_runtime::spawn_blocking(move || {
    handle
      .dialog()
      .file()
      .add_filter(
        "Documents texte",
        &["txt", "md", "markdown", "log", "csv", "json", "xml", "yml", "yaml"],
      )
      .add_filter(
        "Code",
        &[
          "js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "c", "cpp", "h", "cs", "html", "css",
          "php", "sql", "sh", "ps1",
        ],
      )
      .add_filter("Tous les fichiers", &["*"])
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
    out.push(read_opened(&path)?);
  }
  Ok(out)
}

#[tauri::command]
fn write_file(file_path: String, text: String, encoding: String) -> Result<SavedFile, String> {
  let path = PathBuf::from(&file_path);
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
      .add_filter("Tous les fichiers", &["*"])
      .add_filter("Markdown", &["md"])
      .add_filter("Texte", &["txt"])
      .blocking_save_file()
  })
  .await
  .map_err(|e| e.to_string())?;

  let Some(file) = picked else {
    return Ok(None);
  };
  let path: PathBuf = file.into_path().map_err(|e| e.to_string())?;
  fs::write(&path, encode_text(&text, &encoding)).map_err(|e| e.to_string())?;
  Ok(Some(SavedFile {
    name: path
      .file_name()
      .map(|n| n.to_string_lossy().into_owned())
      .unwrap_or_default(),
    path: path.to_string_lossy().into_owned(),
  }))
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let file = SubmenuBuilder::new(app, "File")
        .text("new", "New note")
        .text("new-list", "New list")
        .separator()
        .text("open", "Open…")
        .text("save", "Save")
        .text("save-as", "Save as…")
        .separator()
        .quit()
        .build()?;
      let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .text("find", "Find")
        .build()?;
      let view = SubmenuBuilder::new(app, "View")
        .text("preview", "Markdown preview")
        .text("diff", "Diff")
        .separator()
        .fullscreen()
        .build()?;
      let menu = MenuBuilder::new(app).items(&[&file, &edit, &view]).build()?;
      app.set_menu(menu)?;
      let handle = app.handle().clone();
      app.on_menu_event(move |_app, event| {
        let id = event.id().as_ref();
        let _ = handle.emit("menu", id);
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![open_files, write_file, save_file_as])
    .run(tauri::generate_context!())
    .expect("failed to start Notes");
}
