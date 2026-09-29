use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_autostart::{ManagerExt, MacosLauncher};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid path: {0}")]
    InvalidPath(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type AppResult<T> = std::result::Result<T, AppError>;

fn validate_path(path: &str) -> AppResult<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidPath("path must not be empty".into()));
    }
    Ok(PathBuf::from(trimmed))
}

fn parent_dir(target: &Path) -> PathBuf {
    match target.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent.to_path_buf(),
        _ => PathBuf::from("."),
    }
}

fn atomic_write(target: &Path, content: &str) -> AppResult<()> {
    atomic_write_bytes(target, content.as_bytes(), true)
}

fn atomic_write_bytes(target: &Path, bytes: &[u8], keep_backup: bool) -> AppResult<()> {
    let dir = parent_dir(target);
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }

    let file_name = target
        .file_name()
        .ok_or_else(|| AppError::InvalidPath(format!("path has no file name: {}", target.display())))?
        .to_string_lossy()
        .into_owned();

    let temp = dir.join(format!(".{file_name}.tmp"));
    let write_result = (|| -> std::io::Result<()> {
        let mut handle = fs::File::create(&temp)?;
        handle.write_all(bytes)?;
        handle.sync_all()
    })();

    if let Err(err) = write_result {
        let _ = fs::remove_file(&temp);
        return Err(AppError::Io(err));
    }

    if keep_backup && target.exists() {
        let backup = dir.join(format!("{file_name}.bak"));
        let _ = fs::copy(target, backup);
    }

    if let Err(err) = fs::rename(&temp, target) {
        let _ = fs::remove_file(&temp);
        return Err(AppError::Io(err));
    }

    Ok(())
}

#[tauri::command]
fn read_text_file(path: String) -> AppResult<String> {
    let p = validate_path(&path)?;
    let content = fs::read_to_string(&p)?;
    Ok(content)
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> AppResult<()> {
    let p = validate_path(&path)?;
    atomic_write(&p, &content)
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub key: String,
    pub path: Option<String>,
    pub content: String,
    pub saved_at_ms: u64,
}

fn normalize_path_key(path: &str) -> String {
    path.trim()
        .replace('/', "\\")
        .to_lowercase()
}

fn draft_key(path: Option<&str>) -> String {
    let normalized = path.map(normalize_path_key).unwrap_or_default();
    if normalized.is_empty() {
        return "untitled".to_string();
    }

    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in normalized.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }

    format!("{hash:016x}")
}

fn draft_file_path(dir: &Path, key: &str) -> PathBuf {
    let safe: String = key
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();

    dir.join(format!("{safe}.json"))
}

fn write_draft_file(dir: &Path, draft: &Draft) -> AppResult<()> {
    let payload = serde_json::to_vec(draft)
        .map_err(|err| AppError::InvalidPath(format!("failed to encode draft: {err}")))?;

    atomic_write_bytes(&draft_file_path(dir, &draft.key), &payload, false)
}

fn read_drafts(dir: &Path) -> AppResult<Vec<Draft>> {
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut drafts = Vec::new();
    for entry in fs::read_dir(dir)?.filter_map(|entry| entry.ok()) {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        match fs::read_to_string(&path) {
            Ok(raw) => match serde_json::from_str::<Draft>(&raw) {
                Ok(draft) => drafts.push(draft),
                Err(_) => continue,
            },
            Err(_) => continue,
        }
    }

    drafts.sort_by(|a, b| b.saved_at_ms.cmp(&a.saved_at_ms));
    Ok(drafts)
}

fn remove_draft_file(dir: &Path, key: &str) -> AppResult<()> {
    let path = draft_file_path(dir, key);
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(AppError::Io(err)),
    }
}

fn drafts_directory(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|err| AppError::InvalidPath(format!("app data directory unavailable: {err}")))?;

    Ok(base.join("drafts"))
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn is_markdown_path(candidate: &str) -> bool {
    let lowered = candidate.to_lowercase();
    [".md", ".markdown", ".mdown", ".mkd"]
        .iter()
        .any(|ext| lowered.ends_with(ext))
}

fn markdown_path_from_args<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter()
        .skip(1)
        .find(|arg| !arg.starts_with('-') && is_markdown_path(arg))
        .map(|arg| arg.trim().to_string())
        .filter(|arg| !arg.is_empty())
}

#[tauri::command]
fn initial_open_path() -> Option<String> {
    markdown_path_from_args(std::env::args())
}

#[tauri::command]
fn save_draft(app: tauri::AppHandle, path: Option<String>, content: String) -> AppResult<()> {
    let dir = drafts_directory(&app)?;
    let draft = Draft {
        key: draft_key(path.as_deref()),
        path: path.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()),
        content,
        saved_at_ms: now_ms(),
    };

    write_draft_file(&dir, &draft)
}

#[tauri::command]
fn list_drafts(app: tauri::AppHandle) -> AppResult<Vec<Draft>> {
    read_drafts(&drafts_directory(&app)?)
}

#[tauri::command]
fn clear_draft(app: tauri::AppHandle, path: Option<String>) -> AppResult<()> {
    remove_draft_file(&drafts_directory(&app)?, &draft_key(path.as_deref()))
}

#[tauri::command]
fn file_modified_ms(path: String) -> AppResult<Option<u64>> {
    let p = validate_path(&path)?;
    if !p.exists() {
        return Ok(None);
    }

    let modified = fs::metadata(&p)?.modified()?;
    let millis = modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);

    Ok(Some(millis))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn scratch_dir(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("markfx-test-{tag}-{nanos}"));
        fs::create_dir_all(&dir).expect("failed to create scratch dir");
        dir
    }

    #[test]
    fn writes_content_to_a_new_file() {
        let dir = scratch_dir("new");
        let target = dir.join("note.md");

        atomic_write(&target, "# hello").expect("write should succeed");

        assert_eq!(fs::read_to_string(&target).unwrap(), "# hello");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn creates_missing_parent_directories() {
        let dir = scratch_dir("nested");
        let target = dir.join("docs").join("deep").join("note.md");

        atomic_write(&target, "body").expect("write should succeed");

        assert_eq!(fs::read_to_string(&target).unwrap(), "body");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn keeps_previous_content_as_backup_when_replacing() {
        let dir = scratch_dir("backup");
        let target = dir.join("note.md");
        fs::write(&target, "first").unwrap();

        atomic_write(&target, "second").expect("write should succeed");

        assert_eq!(fs::read_to_string(&target).unwrap(), "second");
        assert_eq!(fs::read_to_string(dir.join("note.md.bak")).unwrap(), "first");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn leaves_no_temporary_file_behind() {
        let dir = scratch_dir("clean");
        let target = dir.join("note.md");

        atomic_write(&target, "content").expect("write should succeed");

        let leftovers: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name.ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty(), "temporary files left: {leftovers:?}");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn keeps_original_intact_when_write_fails() {
        let dir = scratch_dir("failure");
        let target = dir.join("note.md");
        fs::write(&target, "original").unwrap();
        let blocked = dir.join("blocked");
        fs::create_dir_all(blocked.join("note.md")).unwrap();

        let result = atomic_write(&blocked.join("note.md"), "replacement");

        assert!(result.is_err(), "writing over a directory should fail");
        assert_eq!(fs::read_to_string(&target).unwrap(), "original");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rejects_empty_path() {
        assert!(validate_path("   ").is_err());
    }

    #[test]
    fn draft_key_is_stable_and_case_insensitive() {
        let a = draft_key(Some("C:\\Docs\\Note.md"));
        let b = draft_key(Some("c:\\docs\\note.md"));

        assert_eq!(a, b);
        assert_eq!(a, draft_key(Some("C:\\Docs\\Note.md")));
    }

    #[test]
    fn draft_key_separates_untitled_from_saved_files() {
        assert_ne!(draft_key(None), draft_key(Some("C:\\Docs\\Note.md")));
        assert_eq!(draft_key(None), draft_key(Some("   ")));
    }

    #[test]
    fn draft_roundtrip_keeps_content_and_path() {
        let dir = scratch_dir("draft-roundtrip");
        let draft = Draft {
            key: draft_key(Some("C:\\Docs\\Note.md")),
            path: Some("C:\\Docs\\Note.md".into()),
            content: "# draft body".into(),
            saved_at_ms: 1_700_000_000_000,
        };

        write_draft_file(&dir, &draft).expect("write should succeed");
        let drafts = read_drafts(&dir).expect("read should succeed");

        assert_eq!(drafts.len(), 1);
        assert_eq!(drafts[0].content, "# draft body");
        assert_eq!(drafts[0].path.as_deref(), Some("C:\\Docs\\Note.md"));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn writing_twice_replaces_the_same_draft() {
        let dir = scratch_dir("draft-replace");
        let mut draft = Draft {
            key: draft_key(Some("C:\\Docs\\Note.md")),
            path: Some("C:\\Docs\\Note.md".into()),
            content: "first".into(),
            saved_at_ms: 1,
        };

        write_draft_file(&dir, &draft).unwrap();
        draft.content = "second".into();
        draft.saved_at_ms = 2;
        write_draft_file(&dir, &draft).unwrap();

        let drafts = read_drafts(&dir).unwrap();
        assert_eq!(drafts.len(), 1);
        assert_eq!(drafts[0].content, "second");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn removing_a_draft_leaves_nothing_to_recover() {
        let dir = scratch_dir("draft-remove");
        let draft = Draft {
            key: draft_key(None),
            path: None,
            content: "unsaved".into(),
            saved_at_ms: 1,
        };
        write_draft_file(&dir, &draft).unwrap();

        remove_draft_file(&dir, &draft.key).expect("remove should succeed");

        assert!(read_drafts(&dir).unwrap().is_empty());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn reading_a_missing_draft_directory_yields_no_drafts() {
        let dir = scratch_dir("draft-missing").join("nested-that-does-not-exist");
        assert!(read_drafts(&dir).unwrap().is_empty());
    }

    #[test]
    fn unreadable_draft_files_are_skipped() {
        let dir = scratch_dir("draft-corrupt");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("broken.json"), "not json at all").unwrap();

        assert!(read_drafts(&dir).unwrap().is_empty());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn finds_markdown_path_in_arguments() {
        let args = vec![
            "C:\\Program Files\\MarkFX\\markfx.exe".to_string(),
            "--hidden".to_string(),
            "C:\\Docs\\note.md".to_string(),
        ];

        assert_eq!(markdown_path_from_args(args).as_deref(), Some("C:\\Docs\\note.md"));
    }

    #[test]
    fn ignores_arguments_that_are_not_markdown() {
        let args = vec![
            "markfx.exe".to_string(),
            "--hidden".to_string(),
            "C:\\Docs\\readme.txt".to_string(),
        ];

        assert_eq!(markdown_path_from_args(args), None);
    }

    #[test]
    fn accepts_all_markdown_extensions() {
        for name in ["a.md", "b.markdown", "c.mdown", "d.mkd"] {
            let args = vec!["markfx.exe".to_string(), format!("C:\\Docs\\{name}")];
            assert_eq!(
                markdown_path_from_args(args).as_deref(),
                Some(format!("C:\\Docs\\{name}").as_str()),
                "{name} should be recognized"
            );
        }
    }

    #[test]
    fn takes_the_first_markdown_path_when_several_are_given() {
        let args = vec![
            "markfx.exe".to_string(),
            "C:\\Docs\\first.md".to_string(),
            "C:\\Docs\\second.md".to_string(),
        ];

        assert_eq!(markdown_path_from_args(args).as_deref(), Some("C:\\Docs\\first.md"));
    }

    #[test]
    fn recognizes_markdown_paths_case_insensitively() {
        let args = vec!["markfx.exe".to_string(), "C:\\Docs\\NOTE.MD".to_string()];

        assert_eq!(markdown_path_from_args(args).as_deref(), Some("C:\\Docs\\NOTE.MD"));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            show_main_window(app);
            if let Some(path) = markdown_path_from_args(argv) {
                let _ = app.emit("markfx://open-file", path);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "显示 MarkFX", true, None::<&str>)?;
            let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
            let autostart = CheckMenuItem::with_id(
                app,
                "autostart",
                "开机自动启动",
                true,
                autostart_enabled,
                None::<&str>,
            )?;
            let quit = MenuItem::with_id(app, "quit", "退出 MarkFX", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &autostart, &quit])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().expect("application icon is missing"))
                .tooltip("MarkFX")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => show_main_window(app),
                    "autostart" => {
                        let enabled = app.autolaunch().is_enabled().unwrap_or(false);
                        let _ = if enabled {
                            app.autolaunch().disable()
                        } else {
                            app.autolaunch().enable()
                        };
                        let _ = autostart.set_checked(!enabled);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            if std::env::args().any(|arg| arg == "--hidden") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            file_modified_ms,
            save_draft,
            list_drafts,
            clear_draft,
            initial_open_path
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_, _| {});
}
