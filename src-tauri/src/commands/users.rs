use argon2::{
    password_hash::PasswordHasher,
    Argon2,
};

use rusqlite::{params, Connection};

use serde::Serialize;

use tauri::{AppHandle, Manager};


// ============================================================
// USER STRUCT
// ============================================================

#[derive(Debug, Serialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub is_deleted: bool,  // Added field
}


// ============================================================
// DATABASE CONNECTION
// ============================================================

fn get_connection(app: &AppHandle) -> Result<Connection, String> {

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let db_path = app_data_dir.join("sowl_hms.db");

    println!("Database path: {:?}", db_path);

    Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))
}


// ============================================================
// CREATE STAFF USER
// ============================================================

#[tauri::command]
pub fn create_user(
    app: AppHandle,
    username: String,
    password: String,
) -> Result<(), String> {

    let username = username.trim().to_string();

    // Validate username
    if username.is_empty() {
        return Err("Username is required".to_string());
    }

    // Validate password
    if password.len() < 8 {
        return Err("Password must be at least 8 characters".to_string());
    }

    let conn = get_connection(&app)?;

    // ========================================================
    // CHECK IF USER EXISTS (including soft-deleted)
    // ========================================================

    let exists: bool = conn
        .query_row(
            "
            SELECT EXISTS(
                SELECT 1
                FROM users
                WHERE username = ?1
                AND is_deleted = 0
            )
            ",
            params![username],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check user: {}", e))?;

    if exists {
        return Err("Username already exists".to_string());
    }

    // ========================================================
    // HASH PASSWORD
    // ========================================================

    let password_hash = Argon2::default()
        .hash_password(password.as_bytes())
        .map_err(|e| format!("Failed to hash password: {}", e))?
        .to_string();

    println!("Creating user: {}", username);

    // ========================================================
    // INSERT USER
    // ========================================================

    conn.execute(
        "
        INSERT INTO users
            (username, password_hash, role)
        VALUES
            (?1, ?2, 'manager')
        ",
        params![username, password_hash],
    )
    .map_err(|e| {
        let error = e.to_string();
        if error.contains("UNIQUE constraint failed") {
            "Username already exists".to_string()
        } else {
            format!("Failed to create user: {}", error)
        }
    })?;

    println!("User created successfully");

    Ok(())
}


// ============================================================
// LIST ALL ACTIVE USERS
// ============================================================

#[tauri::command]
pub fn list_users(
    app: AppHandle,
) -> Result<Vec<User>, String> {

    let conn = get_connection(&app)?;

    let mut statement = conn
        .prepare(
            "
            SELECT id, username, role, is_deleted
            FROM users
            WHERE is_deleted = 0
            ORDER BY id
            "
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let users = statement
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                role: row.get(2)?,
                is_deleted: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to retrieve users: {}", e))?
        .collect::<Result<Vec<User>, rusqlite::Error>>()
        .map_err(|e| format!("Failed to read users: {}", e))?;

    Ok(users)
}


// ============================================================
// LIST ALL DELETED USERS
// ============================================================

#[tauri::command]
pub fn list_deleted_users(
    app: AppHandle,
) -> Result<Vec<User>, String> {

    let conn = get_connection(&app)?;

    let mut statement = conn
        .prepare(
            "
            SELECT id, username, role, is_deleted
            FROM users
            WHERE is_deleted = 1
            ORDER BY id
            "
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let users = statement
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                role: row.get(2)?,
                is_deleted: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to retrieve users: {}", e))?
        .collect::<Result<Vec<User>, rusqlite::Error>>()
        .map_err(|e| format!("Failed to read users: {}", e))?;

    Ok(users)
}


// ============================================================
// CHANGE USER PASSWORD
// ============================================================

#[tauri::command]
pub fn change_user_password(
    app: AppHandle,
    user_id: i64,
    new_password: String,
) -> Result<(), String> {

    println!(
        "Changing password for user ID: {}",
        user_id
    );

    // ========================================================
    // VALIDATE PASSWORD
    // ========================================================

    if new_password.len() < 8 {
        return Err(
            "Password must be at least 8 characters".to_string()
        );
    }

    let conn = get_connection(&app)?;

    // ========================================================
    // CHECK USER EXISTS AND IS NOT DELETED
    // ========================================================

    let user_exists: bool = conn
        .query_row(
            "
            SELECT EXISTS(
                SELECT 1
                FROM users
                WHERE id = ?1
                AND is_deleted = 0
            )
            ",
            params![user_id],
            |row| row.get(0),
        )
        .map_err(|e| {
            format!("Failed to check user: {}", e)
        })?;

    if !user_exists {
        return Err(
            format!("User with ID {} not found or has been deleted", user_id)
        );
    }

    // ========================================================
    // HASH NEW PASSWORD
    // ========================================================

    let password_hash = Argon2::default()
        .hash_password(new_password.as_bytes())
        .map_err(|e| {
            format!("Failed to hash password: {}", e)
        })?
        .to_string();

    println!("New password hashed successfully");

    // ========================================================
    // UPDATE PASSWORD
    // ========================================================

    let affected = conn
        .execute(
            "
            UPDATE users
            SET password_hash = ?1
            WHERE id = ?2
            AND is_deleted = 0
            ",
            params![password_hash, user_id],
        )
        .map_err(|e| {
            format!("Failed to update password: {}", e)
        })?;

    println!(
        "Password update affected {} row(s)",
        affected
    );

    if affected == 0 {
        return Err("Password was not updated".to_string());
    }

    println!(
        "Password changed successfully for user ID: {}",
        user_id
    );

    Ok(())
}


// ============================================================
// DELETE USER (Soft Delete)
// ============================================================

#[tauri::command]
pub fn delete_user(
    app: AppHandle,
    user_id: i64,
) -> Result<(), String> {

    println!(
        "Deleting user ID: {}",
        user_id
    );

    let conn = get_connection(&app)?;

    // ========================================================
    // GET USER ROLE AND CHECK IF EXISTS
    // ========================================================

    let role: String = conn
        .query_row(
            "
            SELECT role
            FROM users
            WHERE id = ?1
            AND is_deleted = 0
            ",
            params![user_id],
            |row| row.get(0),
        )
        .map_err(|_| {
            format!("User with ID {} not found or already deleted", user_id)
        })?;

    println!("User role: {}", role);

    // ========================================================
    // PREVENT ADMIN DELETION
    // ========================================================

    if role == "admin" {
        return Err(
            "Admin account cannot be deleted".to_string()
        );
    }

    // ========================================================
    // SOFT DELETE USER
    // ========================================================

    let affected = conn
        .execute(
            "
            UPDATE users
            SET is_deleted = 1
            WHERE id = ?1
            AND is_deleted = 0
            ",
            params![user_id],
        )
        .map_err(|e| {
            let error = e.to_string();
            println!("Delete error: {}", error);
            format!("Failed to delete user: {}", error)
        })?;

    println!(
        "Delete affected {} row(s)",
        affected
    );

    if affected == 0 {
        return Err(
            format!("User with ID {} not found or already deleted", user_id)
        );
    }

    println!(
        "User ID {} deleted successfully",
        user_id
    );

    Ok(())
}


// ============================================================
// RESTORE USER
// ============================================================

#[tauri::command]
pub fn restore_user(
    app: AppHandle,
    user_id: i64,
) -> Result<(), String> {

    println!(
        "Restoring user ID: {}",
        user_id
    );

    let conn = get_connection(&app)?;

    // ========================================================
    // CHECK IF USER EXISTS AND IS DELETED
    // ========================================================

    let username: Result<String, _> = conn.query_row(
        "
        SELECT username
        FROM users
        WHERE id = ?1
        AND is_deleted = 1
        ",
        params![user_id],
        |row| row.get(0),
    );

    let username = match username {
        Ok(name) => name,
        Err(_) => {
            return Err(
                format!("Deleted user with ID {} not found", user_id)
            );
        }
    };

    // ========================================================
    // CHECK IF USERNAME IS ALREADY IN USE BY ACTIVE USER
    // ========================================================

    let duplicate: bool = conn
        .query_row(
            "
            SELECT EXISTS(
                SELECT 1
                FROM users
                WHERE username = ?1
                AND is_deleted = 0
            )
            ",
            params![username],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check username: {}", e))?;

    if duplicate {
        return Err(
            format!("Cannot restore: Username '{}' is already in use by an active user", username)
        );
    }

    // ========================================================
    // RESTORE USER
    // ========================================================

    let affected = conn
        .execute(
            "
            UPDATE users
            SET is_deleted = 0
            WHERE id = ?1
            AND is_deleted = 1
            ",
            params![user_id],
        )
        .map_err(|e| {
            format!("Failed to restore user: {}", e)
        })?;

    if affected == 0 {
        return Err(
            format!("Failed to restore user with ID {}", user_id)
        );
    }

    println!(
        "User ID {} restored successfully",
        user_id
    );

    Ok(())
}


// ============================================================
// PERMANENTLY DELETE USER (Hard Delete)
// ============================================================

#[tauri::command]
pub fn permanently_delete_user(
    app: AppHandle,
    user_id: i64,
) -> Result<(), String> {

    println!(
        "Permanently deleting user ID: {}",
        user_id
    );

    let conn = get_connection(&app)?;

    // ========================================================
    // CHECK IF USER EXISTS AND IS DELETED
    // ========================================================

    let role: Result<String, _> = conn.query_row(
        "
        SELECT role
        FROM users
        WHERE id = ?1
        AND is_deleted = 1
        ",
        params![user_id],
        |row| row.get(0),
    );

    let role = match role {
        Ok(role) => role,
        Err(_) => {
            return Err(
                format!("Deleted user with ID {} not found", user_id)
            );
        }
    };

    // ========================================================
    // PREVENT ADMIN PERMANENT DELETION
    // ========================================================

    if role == "admin" {
        return Err(
            "Admin account cannot be permanently deleted".to_string()
        );
    }

    // ========================================================
    // PERMANENTLY DELETE USER
    // ========================================================

    let affected = conn
        .execute(
            "
            DELETE FROM users
            WHERE id = ?1
            AND is_deleted = 1
            ",
            params![user_id],
        )
        .map_err(|e| {
            let error = e.to_string();
            println!("Permanent delete error: {}", error);

            if error.contains("FOREIGN KEY constraint failed") {
                "Cannot delete this user because other records are linked to this account."
                    .to_string()
            } else {
                format!("Failed to permanently delete user: {}", error)
            }
        })?;

    println!(
        "Permanent delete affected {} row(s)",
        affected
    );

    if affected == 0 {
        return Err(
            format!("User with ID {} not found or not soft-deleted", user_id)
        );
    }

    println!(
        "User ID {} permanently deleted",
        user_id
    );

    Ok(())
}


// ============================================================
// SEARCH USERS
// ============================================================

#[tauri::command]
pub fn search_users(
    app: AppHandle,
    search: String,
) -> Result<Vec<User>, String> {

    let conn = get_connection(&app)?;

    let pattern = format!("%{}%", search.trim());

    let mut statement = conn
        .prepare(
            "
            SELECT id, username, role, is_deleted
            FROM users
            WHERE is_deleted = 0
            AND username LIKE ?1
            ORDER BY username ASC
            "
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let users = statement
        .query_map(params![pattern], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                role: row.get(2)?,
                is_deleted: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to retrieve users: {}", e))?
        .collect::<Result<Vec<User>, rusqlite::Error>>()
        .map_err(|e| format!("Failed to read users: {}", e))?;

    Ok(users)
}