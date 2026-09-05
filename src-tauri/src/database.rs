use argon2::password_hash::PasswordHasher;
use argon2::Argon2;
use rusqlite::Connection;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn database_path(app: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;

    std::fs::create_dir_all(&app_data_dir)?;

    Ok(app_data_dir.join("sowl_hms.db"))
}

pub fn initialize_database(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = database_path(app)?;

    println!("Database path: {:?}", db_path);

    let conn = Connection::open(&db_path)?;

    println!("Database opened successfully.");

    // Enable foreign keys
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    // ============================================================
    // USERS
    // ============================================================

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'manager'))
        );
        ",
    )?;

    // ============================================================
    // CUSTOMERS
    // ============================================================

    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS customers (
            customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            phone_number TEXT NOT NULL UNIQUE,
            document_type TEXT,
            document_number TEXT,
            document_pic TEXT,
            nationality TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        "#,
        [],
    )?;

    // ============================================================
    // ROOMS
    // ============================================================

    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS rooms (
            room_id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_number TEXT NOT NULL UNIQUE,
            room_rate DECIMAL(10,2) NOT NULL,
            no_of_beds INTEGER NOT NULL,
            features TEXT,
            status TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN (
                    'available',
                    'reserved',
                    'booked',
                    'maintenance'
                ))
        );
        "#,
        [],
    )?;

    // ============================================================
    // Registrations table to store customer registrations
    // ============================================================

    conn.execute(
        r#"
    CREATE TABLE IF NOT EXISTS registrations (
        registration_id INTEGER PRIMARY KEY AUTOINCREMENT,

        customer_id INTEGER NOT NULL,

        check_in DATETIME NOT NULL,
        check_out DATETIME,

        booking_datetime DATETIME NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

        male_count INTEGER NOT NULL DEFAULT 0,
        female_count INTEGER NOT NULL DEFAULT 0,

        relation TEXT NOT NULL,

        status TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN (
                'active',
                'completed',
                'cancelled'
            )),

        FOREIGN KEY (customer_id)
            REFERENCES customers(customer_id)
            ON DELETE RESTRICT
            ON UPDATE CASCADE
    );
    "#,
        [],
    )?;

    // ============================================================
    // REGISTRATION ROOMS
    // ============================================================

    conn.execute(
        r#"
    CREATE TABLE IF NOT EXISTS registration_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    registration_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,

    check_in DATETIME NOT NULL,
    check_out DATETIME,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN (
            'active',
            'completed',
            'cancelled'
        )),

    FOREIGN KEY (registration_id)
        REFERENCES registrations(registration_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (room_id)
        REFERENCES rooms(room_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);
    );
    "#,
        [],
    )?;

    // ============================================================
    // SEED ADMIN
    // ============================================================

    seed_admin(&conn)?;

    Ok(())
}

fn seed_admin(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
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
