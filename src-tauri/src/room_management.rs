use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

// ============================================================
// ROOM MODEL
// ============================================================

#[derive(Debug, Serialize)]
pub struct Room {
    pub room_id: i64,
    pub room_number: String,
    pub room_rate: f64,
    pub no_of_beds: i64,
    pub features: Option<String>,
    pub status: String,
}

// ============================================================
// ADD ROOM REQUEST
// ============================================================

#[derive(Debug, Deserialize)]
pub struct AddRoomRequest {
    pub room_number: String,
    pub room_rate: f64,
    pub no_of_beds: i64,
    pub features: Option<String>,
}

// ============================================================
// UPDATE ROOM REQUEST
// ============================================================

#[derive(Debug, Deserialize)]
pub struct UpdateRoomRequest {
    pub room_id: i64,
    pub room_number: String,
    pub room_rate: f64,
    pub no_of_beds: i64,
    pub features: Option<String>,
}

// ============================================================
// ADD ROOM
// ============================================================
//
// Behavior:
//
// 1. If room number does not exist:
//      -> Create new room.
//
// 2. If room number exists and is active:
//      -> Return "room already exists".
//
// 3. If room number exists but was soft deleted:
//      -> Restore the old room.
//      -> Update its information.
//      -> Set status to available.
//      -> Set is_deleted to 0.
//
// ============================================================

#[tauri::command]
pub fn add_room(app: AppHandle, room: AddRoomRequest,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<i64, String> {
    crate::session::require_session(&state)?;

    // --------------------------------------------------------
    // Validate room number
    // --------------------------------------------------------

    let room_number = room.room_number.trim();

    if room_number.is_empty() {
        return Err("Room number is required".to_string());
    }

    // --------------------------------------------------------
    // Validate room rate
    // --------------------------------------------------------

    if room.room_rate < 0.0 {
        return Err("Room rate cannot be negative".to_string());
    }

    // --------------------------------------------------------
    // Validate number of beds
    // --------------------------------------------------------

    // --------------------------------------------------------
    // Get database path
    // --------------------------------------------------------

    let db_path = crate::database::database_path(&app)
        .map_err(|e| format!("Database path error: {}", e))?;

    // --------------------------------------------------------
    // Open database
    // --------------------------------------------------------

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Database error: {}", e))?;

    // --------------------------------------------------------
    // Check if room number already exists
    //
    // We intentionally check both active and deleted rooms.
    // --------------------------------------------------------

    let existing_room: Option<(i64, bool)> = conn
        .query_row(
            r#"
            SELECT
                room_id,
                is_deleted
            FROM rooms
            WHERE room_number = ?1
            LIMIT 1
            "#,
            params![room_number],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("Failed to check existing room: {}", e))?;

    // ========================================================
    // EXISTING ROOM FOUND
    // ========================================================

    if let Some((room_id, is_deleted)) = existing_room {
        // ----------------------------------------------------
        // Soft-deleted room found -> RESTORE IT
        // ----------------------------------------------------

        if is_deleted {
            conn.execute(
                r#"
                UPDATE rooms
                SET
                    room_number = ?1,
                    room_rate = ?2,
                    no_of_beds = ?3,
                    features = ?4,
                    status = 'available',
                    is_deleted = 0
                WHERE room_id = ?5
                "#,
                params![
                    room_number,
                    room.room_rate,
                    room.no_of_beds,
                    room.features,
                    room_id
                ],
            )
            .map_err(|e| format!("Failed to restore room: {}", e))?;

            println!(
                "Room {} restored successfully.",
                room_number
            );

            return Ok(room_id);
        }

        // ----------------------------------------------------
        // Active room already exists
        // ----------------------------------------------------

        return Err(
            "A room with this room number already exists".to_string()
        );
    }

    // ========================================================
    // CREATE NEW ROOM
    // ========================================================

    conn.execute(
        r#"
        INSERT INTO rooms (
            room_number,
            room_rate,
            no_of_beds,
            features,
            status,
            is_deleted
        )
        VALUES (
            ?1,
            ?2,
            ?3,
            ?4,
            'available',
            0
        )
        "#,
        params![
            room_number,
            room.room_rate,
            room.no_of_beds,
            room.features
        ],
    )
    .map_err(|e| format!("Failed to add room: {}", e))?;

    let room_id = conn.last_insert_rowid();

    println!(
        "Room {} created successfully.",
        room_number
    );

    Ok(room_id)
}

// ============================================================
// DELETE ROOM - SOFT DELETE
// ============================================================
//
// The room is NOT physically removed.
//
// is_deleted:
//      0 = active
//      1 = deleted
//
// This preserves old booking/registration history.
//
// ============================================================

#[tauri::command]
pub fn delete_room(app: AppHandle, room_id: i64,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

    // --------------------------------------------------------
    // Get database path
    // --------------------------------------------------------

    let db_path = crate::database::database_path(&app)
        .map_err(|e| format!("Database path error: {}", e))?;

    // --------------------------------------------------------
    // Open database
    // --------------------------------------------------------

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Database error: {}", e))?;

    // --------------------------------------------------------
    // Soft delete
    // --------------------------------------------------------

    let affected = conn
        .execute(
            r#"
            UPDATE rooms
            SET
                is_deleted = 1
            WHERE room_id = ?1
              AND is_deleted = 0
            "#,
            params![room_id],
        )
        .map_err(|e| format!("Failed to delete room: {}", e))?;

    // --------------------------------------------------------
    // Check result
    // --------------------------------------------------------

    if affected == 0 {
        return Err("Room not found".to_string());
    }

    println!(
        "Room ID {} soft deleted successfully.",
        room_id
    );

    Ok(())
}

// ============================================================
// UPDATE ROOM INFORMATION
// ============================================================
//
// Status is intentionally NOT changed here.
//
// Example:
// available -> update -> available
// booked    -> update -> booked
// maintenance -> update -> maintenance
//
// ============================================================

#[tauri::command]
pub fn update_room(
    app: AppHandle,
    room: UpdateRoomRequest,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

    // --------------------------------------------------------
    // Validate room number
    // --------------------------------------------------------

    let room_number = room.room_number.trim();

    if room_number.is_empty() {
        return Err("Room number is required".to_string());
    }

    // --------------------------------------------------------
    // Validate room rate
    // --------------------------------------------------------

    if room.room_rate < 0.0 {
        return Err("Room rate cannot be negative".to_string());
    }

    // --------------------------------------------------------
    // Validate beds
    // --------------------------------------------------------

    if room.no_of_beds <= 0 {
        return Err("Number of beds must be greater than 0".to_string());
    }

    // --------------------------------------------------------
    // Get database path
    // --------------------------------------------------------

    let db_path = crate::database::database_path(&app)
        .map_err(|e| format!("Database path error: {}", e))?;

    // --------------------------------------------------------
    // Open database
    // --------------------------------------------------------

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Database error: {}", e))?;

    // --------------------------------------------------------
    // Make sure the room being updated exists and is active
    // --------------------------------------------------------

    let room_exists: bool = conn
        .query_row(
            r#"
            SELECT EXISTS(
                SELECT 1
                FROM rooms
                WHERE room_id = ?1
                  AND is_deleted = 0
            )
            "#,
            params![room.room_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check room: {}", e))?;

    if !room_exists {
        return Err("Room not found".to_string());
    }

    // --------------------------------------------------------
    // Check whether another active room already uses the
    // requested room number.
    //
    // This prevents:
    //
    // Room 101 -> Room 102
    //
    // when another active Room 102 already exists.
    // --------------------------------------------------------

    let duplicate_room: bool = conn
        .query_row(
            r#"
            SELECT EXISTS(
                SELECT 1
                FROM rooms
                WHERE room_number = ?1
                  AND room_id != ?2
                  AND is_deleted = 0
            )
            "#,
            params![room_number, room.room_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check duplicate room: {}", e))?;

    if duplicate_room {
        return Err(
            "A room with this room number already exists".to_string()
        );
    }

    // --------------------------------------------------------
    // Update room
    // --------------------------------------------------------

    conn.execute(
        r#"
        UPDATE rooms
        SET
            room_number = ?1,
            room_rate = ?2,
            no_of_beds = ?3,
            features = ?4
        WHERE room_id = ?5
          AND is_deleted = 0
        "#,
        params![
            room_number,
            room.room_rate,
            room.no_of_beds,
            room.features,
            room.room_id
        ],
    )
    .map_err(|e| format!("Failed to update room: {}", e))?;

    println!(
        "Room ID {} updated successfully.",
        room.room_id
    );

    Ok(())
}

// ============================================================
// GET ALL ACTIVE ROOMS
// ============================================================
//
// Deleted rooms are intentionally excluded.
//
// ============================================================

#[tauri::command]
pub fn get_rooms(app: AppHandle,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<Vec<Room>, String> {
    crate::session::require_session(&state)?;

    // --------------------------------------------------------
    // Get database path
    // --------------------------------------------------------

    let db_path = crate::database::database_path(&app)
        .map_err(|e| format!("Database path error: {}", e))?;

    // --------------------------------------------------------
    // Open database
    // --------------------------------------------------------

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Database error: {}", e))?;

    // --------------------------------------------------------
    // Prepare query
    // --------------------------------------------------------

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                room_id,
                room_number,
                room_rate,
                no_of_beds,
                features,
                status
            FROM rooms
            WHERE is_deleted = 0
            ORDER BY room_number
            "#,
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    // --------------------------------------------------------
    // Get rooms
    // --------------------------------------------------------

    let rooms = stmt
        .query_map([], |row| {
            Ok(Room {
                room_id: row.get(0)?,
                room_number: row.get(1)?,
                room_rate: row.get(2)?,
                no_of_beds: row.get(3)?,
                features: row.get(4)?,
                status: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to retrieve rooms: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read rooms: {}", e))?;

    Ok(rooms)
}

// ============================================================
// GET AVAILABLE ROOMS
// ============================================================
//
// Only rooms that are:
//
//     status = available
//     is_deleted = 0
//
// are returned.
//
// ============================================================

#[tauri::command]
pub fn get_available_rooms(
    app: AppHandle,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<Vec<Room>, String> {
    crate::session::require_session(&state)?;

    // --------------------------------------------------------
    // Get database path
    // --------------------------------------------------------

    let db_path = crate::database::database_path(&app)
        .map_err(|e| format!("Database path error: {}", e))?;

    // --------------------------------------------------------
    // Open database
    // --------------------------------------------------------

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Database error: {}", e))?;

    // --------------------------------------------------------
    // Prepare query
    // --------------------------------------------------------

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                room_id,
                room_number,
                room_rate,
                no_of_beds,
                features,
                status
            FROM rooms
            WHERE status = 'available'
              AND is_deleted = 0
            ORDER BY room_number
            "#,
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    // --------------------------------------------------------
    // Get available rooms
    // --------------------------------------------------------

    let rooms = stmt
        .query_map([], |row| {
            Ok(Room {
                room_id: row.get(0)?,
                room_number: row.get(1)?,
                room_rate: row.get(2)?,
                no_of_beds: row.get(3)?,
                features: row.get(4)?,
                status: row.get(5)?,
            })
        })
        .map_err(|e| {
            format!(
                "Failed to retrieve available rooms: {}",
                e
            )
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            format!(
                "Failed to read available rooms: {}",
                e
            )
        })?;

    Ok(rooms)
}

// ============================================================
// SET ROOM TO MAINTENANCE
// ============================================================
//
// Only active + available rooms can be placed into maintenance.
//
// ============================================================

#[tauri::command]
pub fn set_room_maintenance(
    app: AppHandle,
    room_id: i64,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

    // --------------------------------------------------------
    // Get database path
    // --------------------------------------------------------

    let db_path = crate::database::database_path(&app)
        .map_err(|e| format!("Database path error: {}", e))?;

    // --------------------------------------------------------
    // Open database
    // --------------------------------------------------------

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Database error: {}", e))?;

    // --------------------------------------------------------
    // Set maintenance
    // --------------------------------------------------------

    let affected = conn
        .execute(
            r#"
            UPDATE rooms
            SET
                status = 'maintenance'
            WHERE room_id = ?1
              AND status = 'available'
              AND is_deleted = 0
            "#,
            params![room_id],
        )
        .map_err(|e| {
            format!(
                "Failed to set room maintenance: {}",
                e
            )
        })?;

    // --------------------------------------------------------
    // Check result
    // --------------------------------------------------------

    if affected == 0 {
        return Err(
            "Room not found or room is not available".to_string()
        );
    }

    Ok(())
}

// ============================================================
// REMOVE ROOM FROM MAINTENANCE
// ============================================================
//
// maintenance -> available
//
// Deleted rooms cannot be modified.
//
// ============================================================

#[tauri::command]
pub fn remove_room_maintenance(
    app: AppHandle,
    room_id: i64,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

    // --------------------------------------------------------
    // Get database path
    // --------------------------------------------------------

    let db_path = crate::database::database_path(&app)
        .map_err(|e| format!("Database path error: {}", e))?;

    // --------------------------------------------------------
    // Open database
    // --------------------------------------------------------

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Database error: {}", e))?;

    // --------------------------------------------------------
    // Change maintenance -> available
    // --------------------------------------------------------

    let affected = conn
        .execute(
            r#"
            UPDATE rooms
            SET
                status = 'available'
            WHERE room_id = ?1
              AND status = 'maintenance'
              AND is_deleted = 0
            "#,
            params![room_id],
        )
        .map_err(|e| {
            format!(
                "Failed to remove room maintenance: {}",
                e
            )
        })?;

    // --------------------------------------------------------
    // Check result
    // --------------------------------------------------------

    if affected == 0 {
        return Err(
            "Room not found or room is not under maintenance"
                .to_string()
        );
    }

    Ok(())
}