use argon2::{
    password_hash::{
        phc::PasswordHash,
        PasswordVerifier,
    },
    Argon2,
};
use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::session::{Session, SessionState};

#[tauri::command]
pub fn login(
    app: AppHandle,
    state: tauri::State<'_, SessionState>,
    username: String,
    password: String,
) -> Result<Session, String> {

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let db_path = app_data_dir.join("sowl_hms.db");

    let conn = Connection::open(&db_path)
        .map_err(|e| e.to_string())?;

    let user: (i64, String, String) = conn
        .query_row(
            "
            SELECT id, password_hash, role
            FROM users
            WHERE username = ?1
              AND is_deleted = 0
            ",
            [&username],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                ))
            },
        )
        .map_err(|_| "Invalid username or password".to_string())?;

    let (user_id, password_hash, role) = user;

    let parsed_hash = PasswordHash::new(&password_hash)
        .map_err(|_| "Invalid username or password".to_string())?;

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Invalid username or password".to_string())?;

    let session = Session {
        user_id,
        username,
        role,
    };

    let mut current_session = state
        .session
        .lock()
        .map_err(|_| "Failed to access session".to_string())?;

    *current_session = Some(session.clone());

    Ok(session)
}
#[tauri::command]
pub fn get_session(
    state: tauri::State<'_, SessionState>,
) -> Result<Option<Session>, String> {

    let session = state
        .session
        .lock()
        .map_err(|_| "Failed to access session".to_string())?;

    Ok(session.clone())
}
#[tauri::command]
pub fn logout(
    state: tauri::State<'_, SessionState>,
) -> Result<(), String> {

    let mut session = state
        .session
        .lock()
        .map_err(|_| "Failed to access session".to_string())?;

    *session = None;

    Ok(())
}
