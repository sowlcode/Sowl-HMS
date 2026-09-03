use argon2::{
    password_hash::{
        phc::PasswordHash,
        PasswordVerifier,
    },
    Argon2,
};
use rusqlite::Connection;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn login(
    app: AppHandle,
    username: String,
    password: String,
) -> Result<String, String> {

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let db_path = app_data_dir.join("sowl_hms.db");

    let conn = Connection::open(&db_path)
        .map_err(|e| e.to_string())?;

    let password_hash: String = conn
        .query_row(
            "
            SELECT password_hash
            FROM users
            WHERE username = ?1
            ",
            [&username],
            |row| row.get(0),
        )
        .map_err(|_| "Invalid username or password".to_string())?;

    let parsed_hash = PasswordHash::new(&password_hash)
        .map_err(|_| "Invalid username or password".to_string())?;

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Invalid username or password".to_string())?;

    let role: String = conn
        .query_row(
            "
            SELECT role
            FROM users
            WHERE username = ?1
            ",
            [&username],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(role)
}