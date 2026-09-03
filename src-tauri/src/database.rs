use argon2::Argon2;
use argon2::password_hash::PasswordHasher;
use rusqlite::Connection;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn database_path(app: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;

    std::fs::create_dir_all(&app_data_dir)?;

    Ok(app_data_dir.join("sowl_hms.db"))
}

pub fn initialize_database(
    app: &AppHandle,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = database_path(app)?;

    println!("Database path: {:?}", db_path);

    let conn = Connection::open(&db_path)?;

    println!("Database opened successfully.");

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'staff'))
        );
        ",
    )?;

    seed_admin(&conn)?;

    Ok(())
}

fn seed_admin(
    conn: &Connection,
) -> Result<(), Box<dyn std::error::Error>> {
    let username = "sowladmin";
    let password = "Rr@ik012";

    let exists: bool = conn.query_row(
        "
        SELECT EXISTS(
            SELECT 1
            FROM users
            WHERE username = ?1
        )
        ",
        [username],
        |row| row.get(0),
    )?;

    if exists {
        println!("Admin already exists.");
        return Ok(());
    }

    let password_hash = Argon2::default()
        .hash_password(password.as_bytes())?
        .to_string();

    conn.execute(
        "
        INSERT INTO users
            (username, password_hash, role)
        VALUES
            (?1, ?2, ?3)
        ",
        (username, password_hash, "admin"),
    )?;

    println!("ADMIN CREATED: {}", username);

    Ok(())
}