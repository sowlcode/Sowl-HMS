use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::database::database_path;

// ============================================================
// RESPONSE STRUCTURES
// ============================================================

#[derive(Debug, Serialize)]
pub struct Booking {
    pub registration_id: i64,
    pub customer_id: i64,

    pub customer_name: String,
    pub phone_number: String,

    pub check_in: String,
    pub check_out: Option<String>,

    pub booking_datetime: String,

    pub male_count: i64,
    pub female_count: i64,

    pub relation: String,

    pub status: String,

    pub rooms: Vec<BookingRoom>,
}

#[derive(Debug, Serialize)]
pub struct BookingRoom {
    pub id: i64,
    pub registration_id: i64,
    pub room_id: i64,

    pub room_number: String,
    pub room_rate: f64,

    pub check_in: String,
    pub check_out: Option<String>,

    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct RoomHistory {
    pub id: i64,
    pub registration_id: i64,
    pub customer_id: i64,
    pub customer_name: String,

    pub room_id: i64,
    pub room_number: String,

    pub check_in: String,
    pub check_out: Option<String>,

    pub status: String,
}

// ============================================================
// DATABASE CONNECTION
// ============================================================

fn get_connection(app: &AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let db_path: PathBuf = database_path(app)?;

    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    Ok(conn)
}

// ============================================================
// CREATE BOOKING / REGISTRATION
// ============================================================

#[tauri::command]
pub fn create_booking(
    app: AppHandle,

    customer_id: i64,

    check_in: Option<String>,

    male_count: i64,
    female_count: i64,

    relation: String,

    room_ids: Vec<i64>,
) -> Result<i64, String> {
    if room_ids.is_empty() {
        return Err("At least one room must be selected.".to_string());
    }

    if male_count < 0 || female_count < 0 {
        return Err("Guest counts cannot be negative.".to_string());
    }

    if male_count + female_count <= 0 {
        return Err("At least one guest is required.".to_string());
    }

    if relation.trim().is_empty() {
        return Err("Relation is required.".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    // Remove duplicate room IDs
    let mut unique_rooms = room_ids.clone();
    unique_rooms.sort_unstable();
    unique_rooms.dedup();

    // Verify customer exists
    let customer_exists: bool = conn
        .query_row(
            "
            SELECT EXISTS(
                SELECT 1
                FROM customers
                WHERE customer_id = ?1
            )
            ",
            params![customer_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !customer_exists {
        return Err("Customer does not exist.".to_string());
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // Current system time.
    // SQLite CURRENT_TIMESTAMP is UTC.
    // We use SQLite's timestamp consistently throughout the system.
    let actual_check_in = match check_in {
        Some(value) if !value.trim().is_empty() => value,
        _ => "CURRENT_TIMESTAMP".to_string(),
    };

    // ========================================================
    // CREATE REGISTRATION
    // ========================================================

    if actual_check_in == "CURRENT_TIMESTAMP" {
        tx.execute(
            "
            INSERT INTO registrations
                (
                    customer_id,
                    check_in,
                    male_count,
                    female_count,
                    relation,
                    status
                )
            VALUES
                (
                    ?1,
                    CURRENT_TIMESTAMP,
                    ?2,
                    ?3,
                    ?4,
                    'active'
                )
            ",
            params![customer_id, male_count, female_count, relation.trim()],
        )
        .map_err(|e| e.to_string())?;
    } else {
        tx.execute(
            "
            INSERT INTO registrations
                (
                    customer_id,
                    check_in,
                    male_count,
                    female_count,
                    relation,
                    status
                )
            VALUES
                (
                    ?1,
                    ?2,
                    ?3,
                    ?4,
                    ?5,
                    'active'
                )
            ",
            params![
                customer_id,
                actual_check_in,
                male_count,
                female_count,
                relation.trim()
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    let registration_id = tx.last_insert_rowid();

    // ========================================================
    // ASSIGN ROOMS
    // ========================================================

    for room_id in unique_rooms {
        let room_status: Option<String> = tx
            .query_row(
                "
                SELECT status
                FROM rooms
                WHERE room_id = ?1
                ",
                params![room_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        let status = match room_status {
            Some(status) => status,
            None => {
                return Err(format!("Room ID {} does not exist.", room_id));
            }
        };

        if status != "available" {
            return Err(format!(
                "Room {} is not available. Current status: {}",
                room_id, status
            ));
        }

        // Add room to registration.
        //
        // check_out remains NULL until the entire registration
        // checks out.
        tx.execute(
            "
            INSERT INTO registration_rooms
                (
                    registration_id,
                    room_id,
                    check_in,
                    check_out,
                    status
                )
            VALUES
                (
                    ?1,
                    ?2,
                    CURRENT_TIMESTAMP,
                    NULL,
                    'active'
                )
            ",
            params![registration_id, room_id],
        )
        .map_err(|e| e.to_string())?;

        // Mark room as occupied.
        tx.execute(
            "
            UPDATE rooms
            SET status = 'reserved'
            WHERE room_id = ?1
            ",
            params![room_id],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(registration_id)
}

// ============================================================
// ADD ANOTHER ROOM TO EXISTING REGISTRATION
// ============================================================

#[tauri::command]
pub fn add_room_to_registration(
    app: AppHandle,
    registration_id: i64,
    room_id: i64,
) -> Result<(), String> {
    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // Check registration
    let registration_status: Option<String> = tx
        .query_row(
            "
            SELECT status
            FROM registrations
            WHERE registration_id = ?1
            ",
            params![registration_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match registration_status {
        Some(status) if status == "active" => {}
        Some(_) => {
            return Err("Cannot add a room to a completed or cancelled registration.".to_string());
        }
        None => {
            return Err("Registration does not exist.".to_string());
        }
    }

    // Check room
    let room_status: Option<String> = tx
        .query_row(
            "
            SELECT status
            FROM rooms
            WHERE room_id = ?1
            ",
            params![room_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match room_status {
        Some(status) if status == "available" => {}
        Some(status) => {
            return Err(format!("Room is not available. Current status: {}", status));
        }
        None => {
            return Err("Room does not exist.".to_string());
        }
    }

    // Add room
    tx.execute(
        "
        INSERT INTO registration_rooms
            (
                registration_id,
                room_id,
                check_in,
                check_out,
                status
            )
        VALUES
            (
                ?1,
                ?2,
                CURRENT_TIMESTAMP,
                NULL,
                'active'
            )
        ",
        params![registration_id, room_id],
    )
    .map_err(|e| e.to_string())?;

    // Occupy room
    tx.execute(
        "
        UPDATE rooms
        SET status = 'reserved'
        WHERE room_id = ?1
        ",
        params![room_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================
// CHANGE ROOM
//
// The old room assignment is CLOSED and preserved in history.
// A new registration_rooms record is created for the new room.
//
// Example:
//
// Room 101
// 10:00 -> 14:00
//
// Room 205
// 14:00 -> NULL
// ============================================================

#[tauri::command]
pub fn change_registration_room(
    app: AppHandle,
    registration_id: i64,
    old_room_id: i64,
    new_room_id: i64,
) -> Result<(), String> {
    if old_room_id == new_room_id {
        return Err("Old room and new room cannot be the same.".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // Check registration
    let registration_status: Option<String> = tx
        .query_row(
            "
            SELECT status
            FROM registrations
            WHERE registration_id = ?1
            ",
            params![registration_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match registration_status {
        Some(status) if status == "active" => {}
        Some(_) => {
            return Err("Registration is no longer active.".to_string());
        }
        None => {
            return Err("Registration does not exist.".to_string());
        }
    }

    // Check old room assignment
    let assignment_exists: bool = tx
        .query_row(
            "
            SELECT EXISTS(
                SELECT 1
                FROM registration_rooms
                WHERE registration_id = ?1
                  AND room_id = ?2
                  AND status = 'active'
                  AND check_out IS NULL
            )
            ",
            params![registration_id, old_room_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !assignment_exists {
        return Err("The old room is not currently assigned to this registration.".to_string());
    }

    // Check new room
    let new_room_status: Option<String> = tx
        .query_row(
            "
            SELECT status
            FROM rooms
            WHERE room_id = ?1
            ",
            params![new_room_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match new_room_status {
        Some(status) if status == "available" => {}
        Some(status) => {
            return Err(format!(
                "New room is not available. Current status: {}",
                status
            ));
        }
        None => {
            return Err("New room does not exist.".to_string());
        }
    }

    // Close old room assignment
    tx.execute(
        "
        UPDATE registration_rooms
        SET
            check_out = CURRENT_TIMESTAMP,
            status = 'completed'
        WHERE registration_id = ?1
          AND room_id = ?2
          AND status = 'active'
          AND check_out IS NULL
        ",
        params![registration_id, old_room_id],
    )
    .map_err(|e| e.to_string())?;

    // Release old room
    tx.execute(
        "
        UPDATE rooms
        SET status = 'available'
        WHERE room_id = ?1
        ",
        params![old_room_id],
    )
    .map_err(|e| e.to_string())?;

    // Add new room
    tx.execute(
        "
        INSERT INTO registration_rooms
            (
                registration_id,
                room_id,
                check_in,
                check_out,
                status
            )
        VALUES
            (
                ?1,
                ?2,
                CURRENT_TIMESTAMP,
                NULL,
                'active'
            )
        ",
        params![registration_id, new_room_id],
    )
    .map_err(|e| e.to_string())?;

    // Occupy new room
    tx.execute(
        "
        UPDATE rooms
        SET status = 'reserved'
        WHERE room_id = ?1
        ",
        params![new_room_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================
// GET ONE BOOKING / REGISTRATION
// ============================================================

#[tauri::command]
pub fn get_booking(app: AppHandle, registration_id: i64) -> Result<Booking, String> {
    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let booking = conn
        .query_row(
            "
            SELECT
                r.registration_id,
                r.customer_id,
                c.name,
                c.phone_number,
                r.check_in,
                r.check_out,
                r.booking_datetime,
                r.male_count,
                r.female_count,
                r.relation,
                r.status
            FROM registrations r
            INNER JOIN customers c
                ON c.customer_id = r.customer_id
            WHERE r.registration_id = ?1
            ",
            params![registration_id],
            |row| {
                Ok(Booking {
                    registration_id: row.get(0)?,
                    customer_id: row.get(1)?,
                    customer_name: row.get(2)?,
                    phone_number: row.get(3)?,
                    check_in: row.get(4)?,
                    check_out: row.get(5)?,
                    booking_datetime: row.get(6)?,
                    male_count: row.get(7)?,
                    female_count: row.get(8)?,
                    relation: row.get(9)?,
                    status: row.get(10)?,
                    rooms: Vec::new(),
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let mut booking = match booking {
        Some(value) => value,
        None => {
            return Err("Booking does not exist.".to_string());
        }
    };

    let mut stmt = conn
        .prepare(
            "
            SELECT
                rr.id,
                rr.registration_id,
                rr.room_id,
                rm.room_number,
                rm.room_rate,
                rr.check_in,
                rr.check_out,
                rr.status
            FROM registration_rooms rr
            INNER JOIN rooms rm
                ON rm.room_id = rr.room_id
            WHERE rr.registration_id = ?1
            ORDER BY rr.check_in ASC, rr.id ASC
            ",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![registration_id], |row| {
            Ok(BookingRoom {
                id: row.get(0)?,
                registration_id: row.get(1)?,
                room_id: row.get(2)?,
                room_number: row.get(3)?,
                room_rate: row.get(4)?,
                check_in: row.get(5)?,
                check_out: row.get(6)?,
                status: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        booking.rooms.push(row.map_err(|e| e.to_string())?);
    }

    Ok(booking)
}

// ============================================================
// GET ALL ACTIVE REGISTRATIONS
// ============================================================

#[tauri::command]
pub fn get_active_bookings(app: AppHandle) -> Result<Vec<Booking>, String> {
    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "
            SELECT
                r.registration_id,
                r.customer_id,
                c.name,
                c.phone_number,
                r.check_in,
                r.check_out,
                r.booking_datetime,
                r.male_count,
                r.female_count,
                r.relation,
                r.status
            FROM registrations r
            INNER JOIN customers c
                ON c.customer_id = r.customer_id
            WHERE r.status = 'active'
            ORDER BY r.check_in DESC
            ",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Booking {
                registration_id: row.get(0)?,
                customer_id: row.get(1)?,
                customer_name: row.get(2)?,
                phone_number: row.get(3)?,
                check_in: row.get(4)?,
                check_out: row.get(5)?,
                booking_datetime: row.get(6)?,
                male_count: row.get(7)?,
                female_count: row.get(8)?,
                relation: row.get(9)?,
                status: row.get(10)?,
                rooms: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut bookings = Vec::new();

    for row in rows {
        let mut booking = row.map_err(|e| e.to_string())?;

        let mut room_stmt = conn
            .prepare(
                "
                SELECT
                    rr.id,
                    rr.registration_id,
                    rr.room_id,
                    rm.room_number,
                    rm.room_rate,
                    rr.check_in,
                    rr.check_out,
                    rr.status
                FROM registration_rooms rr
                INNER JOIN rooms rm
                    ON rm.room_id = rr.room_id
                WHERE rr.registration_id = ?1
                ORDER BY rr.check_in ASC, rr.id ASC
                ",
            )
            .map_err(|e| e.to_string())?;

        let room_rows = room_stmt
            .query_map(params![booking.registration_id], |row| {
                Ok(BookingRoom {
                    id: row.get(0)?,
                    registration_id: row.get(1)?,
                    room_id: row.get(2)?,
                    room_number: row.get(3)?,
                    room_rate: row.get(4)?,
                    check_in: row.get(5)?,
                    check_out: row.get(6)?,
                    status: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for room in room_rows {
            booking.rooms.push(room.map_err(|e| e.to_string())?);
        }

        bookings.push(booking);
    }

    Ok(bookings)
}

// ============================================================
// GET ROOMS OF A REGISTRATION
// ============================================================

#[tauri::command]
pub fn get_registration_rooms(
    app: AppHandle,
    registration_id: i64,
) -> Result<Vec<BookingRoom>, String> {
    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "
            SELECT
                rr.id,
                rr.registration_id,
                rr.room_id,
                rm.room_number,
                rm.room_rate,
                rr.check_in,
                rr.check_out,
                rr.status
            FROM registration_rooms rr
            INNER JOIN rooms rm
                ON rm.room_id = rr.room_id
            WHERE rr.registration_id = ?1
            ORDER BY rr.check_in ASC, rr.id ASC
            ",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![registration_id], |row| {
            Ok(BookingRoom {
                id: row.get(0)?,
                registration_id: row.get(1)?,
                room_id: row.get(2)?,
                room_number: row.get(3)?,
                room_rate: row.get(4)?,
                check_in: row.get(5)?,
                check_out: row.get(6)?,
                status: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut rooms = Vec::new();

    for row in rows {
        rooms.push(row.map_err(|e| e.to_string())?);
    }

    Ok(rooms)
}

// ============================================================
// GET REGISTRATION HISTORY (Oldest to Latest)
// ============================================================

#[tauri::command]
pub fn get_registration_history(app: AppHandle) -> Result<Vec<RegistrationHistory>, String> {
    // Get database path
    let db_path =
        crate::database::database_path(&app).map_err(|e| format!("Database path error: {}", e))?;

    // Open database
    let conn = Connection::open(db_path).map_err(|e| format!("Database error: {}", e))?;

    // Prepare query - get all registrations oldest to latest
    let mut stmt = conn
        .prepare(
            r#"
            SELECT 
                r.registration_id,
                c.name as customer_name,
                c.phone_number,
                r.male_count,
                r.female_count,
                r.relation,
                r.status,
                r.check_in,
                r.check_out,
                COUNT(rr.room_id) as room_count
            FROM registrations r
            JOIN customers c ON r.customer_id = c.customer_id
            LEFT JOIN registration_rooms rr ON r.registration_id = rr.registration_id
            GROUP BY r.registration_id
            ORDER BY r.registration_id ASC
            "#,
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    // Get registrations
    let history = stmt
        .query_map([], |row| {
            Ok(RegistrationHistory {
                registration_id: row.get(0)?,
                customer_name: row.get(1)?,
                phone_number: row.get(2)?,
                male_count: row.get(3)?,
                female_count: row.get(4)?,
                relation: row.get(5)?,
                status: row.get(6)?,
                check_in: row.get(7)?,
                check_out: row.get(8)?,
                room_count: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to retrieve history: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read history: {}", e))?;

    Ok(history)
}

// ============================================================
// REGISTRATION HISTORY MODEL
// ============================================================

#[derive(Debug, Serialize)]
pub struct RegistrationHistory {
    pub registration_id: i64,
    pub customer_name: String,
    pub phone_number: String,
    pub male_count: i64,
    pub female_count: i64,
    pub relation: String,
    pub status: String,
    pub check_in: String,
    pub check_out: Option<String>,
    pub room_count: i64,
}

// ============================================================
// CHECKOUT ENTIRE REGISTRATION
// ============================================================
//
// This is the ONLY checkout operation.
//
// All rooms belonging to the registration are checked out
// together.
//
// The room assignment history is preserved.
// Rooms become available.
//
// Registration becomes completed.
// ============================================================

#[tauri::command]
pub fn checkout_registration(app: AppHandle, registration_id: i64) -> Result<(), String> {
    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // Verify registration
    let status: Option<String> = tx
        .query_row(
            "
            SELECT status
            FROM registrations
            WHERE registration_id = ?1
            ",
            params![registration_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match status {
        Some(value) if value == "active" => {}
        Some(_) => {
            return Err("Registration has already been checked out.".to_string());
        }
        None => {
            return Err("Registration does not exist.".to_string());
        }
    }

    // Get all active rooms
    let mut stmt = tx
        .prepare(
            "
            SELECT room_id
            FROM registration_rooms
            WHERE registration_id = ?1
              AND status = 'active'
              AND check_out IS NULL
            ",
        )
        .map_err(|e| e.to_string())?;

    let room_ids: Vec<i64> = stmt
        .query_map(params![registration_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<i64>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);

    if room_ids.is_empty() {
        return Err("No active rooms are associated with this registration.".to_string());
    }

    // ========================================================
    // CLOSE ALL ROOM ASSIGNMENTS
    // ========================================================

    tx.execute(
        "
        UPDATE registration_rooms
        SET
            check_out = CURRENT_TIMESTAMP,
            status = 'completed'
        WHERE registration_id = ?1
          AND status = 'active'
          AND check_out IS NULL
        ",
        params![registration_id],
    )
    .map_err(|e| e.to_string())?;

    // ========================================================
    // RELEASE ALL ROOMS
    // ========================================================

    for room_id in room_ids {
        tx.execute(
            "
            UPDATE rooms
            SET status = 'available'
            WHERE room_id = ?1
              AND status = 'reserved'
            ",
            params![room_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // ========================================================
    // COMPLETE REGISTRATION
    // ========================================================

    tx.execute(
        "
        UPDATE registrations
        SET
            check_out = CURRENT_TIMESTAMP,
            status = 'completed'
        WHERE registration_id = ?1
          AND status = 'active'
        ",
        params![registration_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================
// CHECKOUT INDIVIDUAL ROOM
// ============================================================

#[tauri::command]
pub fn checkout_room(
    app: AppHandle,
    registration_id: i64,
    room_id: i64,
) -> Result<(), String> {
    // Get database path
    let db_path = crate::database::database_path(&app)
        .map_err(|e| format!("Database path error: {}", e))?;

    // Open database
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Database error: {}", e))?;

    // Check if room is active in this registration
    let exists: bool = conn.query_row(
        r#"
        SELECT EXISTS(
            SELECT 1 
            FROM registration_rooms 
            WHERE registration_id = ?1 
              AND room_id = ?2 
              AND status = 'active'
        )
        "#,
        params![registration_id, room_id],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to verify room assignment: {}", e))?;

    if !exists {
        return Err("Room not found or not active in this registration".to_string());
    }

    // Checkout the room
    conn.execute(
        r#"
        UPDATE registration_rooms
        SET status = 'completed',
            check_out = CURRENT_TIMESTAMP
        WHERE registration_id = ?1 
          AND room_id = ?2
          AND status = 'active'
        "#,
        params![registration_id, room_id],
    ).map_err(|e| format!("Failed to checkout room: {}", e))?;

    // Update room status back to available
    conn.execute(
        r#"
        UPDATE rooms
        SET status = 'available'
        WHERE room_id = ?1
        "#,
        params![room_id],
    ).map_err(|e| format!("Failed to update room status: {}", e))?;

    // Check if all rooms in registration are checked out
    let active_rooms: i64 = conn.query_row(
        r#"
        SELECT COUNT(*) 
        FROM registration_rooms 
        WHERE registration_id = ?1 
          AND status = 'active'
        "#,
        params![registration_id],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to count active rooms: {}", e))?;

    // If no active rooms, update registration status to 'completed'
    if active_rooms == 0 {
        conn.execute(
            r#"
            UPDATE registrations
            SET status = 'completed',
                check_out = CURRENT_TIMESTAMP
            WHERE registration_id = ?1
            "#,
            params![registration_id],
        ).map_err(|e| format!("Failed to update registration status: {}", e))?;
    }

    Ok(())
}