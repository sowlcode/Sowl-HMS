use rusqlite::{params, Connection};
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

#[tauri::command]
pub fn add_room(app: AppHandle, room: AddRoomRequest) -> Result<i64, String> {
    // Validate room number
    let room_number = room.room_number.trim();

    if room_number.is_empty() {
        return Err("Room number is required".to_string());
    }

    // Validate room rate
    if room.room_rate < 0.0 {
        return Err("Room rate cannot be negative".to_string());
    }

    // Validate number of beds
    if room.no_of_beds <= 0 {
        return Err("Number of beds must be greater than 0".to_string());
    }

    // Get database path
    let db_path =
        crate::database::database_path(&app).map_err(|e| format!("Database path error: {}", e))?;

    // Open database
    let conn = Connection::open(db_path).map_err(|e| format!("Database error: {}", e))?;

    // Insert room
    conn.execute(
        r#"
        INSERT INTO rooms (
            room_number,
            room_rate,
            no_of_beds,
            features,
            status
        )
        VALUES (
            ?1,
            ?2,
            ?3,
            ?4,
            'available'
        )
        "#,
        params![room_number, room.room_rate, room.no_of_beds, room.features],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "A room with this room number already exists".to_string()
        } else {
            format!("Failed to add room: {}", e)
        }
    })?;

    Ok(conn.last_insert_rowid())
}

// ============================================================
// DELETE ROOM
// ============================================================

#[tauri::command]
pub fn delete_room(app: AppHandle, room_id: i64) -> Result<(), String> {
    // Get database path
    let db_path =
        crate::database::database_path(&app).map_err(|e| format!("Database path error: {}", e))?;

    // Open database
    let conn = Connection::open(db_path).map_err(|e| format!("Database error: {}", e))?;

    // Delete room
    let affected = conn
        .execute("DELETE FROM rooms WHERE room_id = ?1", params![room_id])
        .map_err(|e| format!("Failed to delete room: {}", e))?;

    if affected == 0 {
        return Err("Room not found".to_string());
    }

    Ok(())
}

// ============================================================
// UPDATE ROOM INFORMATION
// ============================================================

#[tauri::command]
pub fn update_room(app: AppHandle, room: UpdateRoomRequest) -> Result<(), String> {
    // Validate room number
    let room_number = room.room_number.trim();

    if room_number.is_empty() {
        return Err("Room number is required".to_string());
    }

    // Validate room rate
    if room.room_rate < 0.0 {
        return Err("Room rate cannot be negative".to_string());
    }

    // Validate number of beds
    if room.no_of_beds <= 0 {
        return Err("Number of beds must be greater than 0".to_string());
    }

    // Get database path
    let db_path =
        crate::database::database_path(&app).map_err(|e| format!("Database path error: {}", e))?;

    // Open database
    let conn = Connection::open(db_path).map_err(|e| format!("Database error: {}", e))?;

    // Update room information
    //
    // Status is intentionally NOT changed here.
    let affected = conn
        .execute(
            r#"
            UPDATE rooms
            SET
                room_number = ?1,
                room_rate = ?2,
                no_of_beds = ?3,
                features = ?4
            WHERE room_id = ?5
            "#,
            params![
                room_number,
                room.room_rate,
                room.no_of_beds,
                room.features,
                room.room_id
            ],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                "A room with this room number already exists".to_string()
            } else {
                format!("Failed to update room: {}", e)
            }
        })?;

    if affected == 0 {
        return Err("Room not found".to_string());
    }

    Ok(())
}

// ============================================================
// GET ALL ROOMS
// ============================================================

#[tauri::command]
pub fn get_rooms(app: AppHandle) -> Result<Vec<Room>, String> {
    // Get database path
    let db_path =
        crate::database::database_path(&app).map_err(|e| format!("Database path error: {}", e))?;

    // Open database
    let conn = Connection::open(db_path).map_err(|e| format!("Database error: {}", e))?;

    // Prepare query
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
            ORDER BY room_number
            "#,
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    // Get rooms
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

#[tauri::command]
pub fn get_available_rooms(app: AppHandle) -> Result<Vec<Room>, String> {
    // Get database path
    let db_path =
        crate::database::database_path(&app).map_err(|e| format!("Database path error: {}", e))?;

    // Open database
    let conn = Connection::open(db_path).map_err(|e| format!("Database error: {}", e))?;

    // Prepare query
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
            ORDER BY room_number
            "#,
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    // Get available rooms
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
        .map_err(|e| format!("Failed to retrieve available rooms: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read rooms: {}", e))?;

    Ok(rooms)
}

// ============================================================
// SET ROOM TO MAINTENANCE
// ============================================================

#[tauri::command]
pub fn set_room_maintenance(app: AppHandle, room_id: i64) -> Result<(), String> {
    // Get database path
    let db_path =
        crate::database::database_path(&app).map_err(|e| format!("Database path error: {}", e))?;

    // Open database
    let conn = Connection::open(db_path).map_err(|e| format!("Database error: {}", e))?;

    // Set room to maintenance (only if currently available)
    let affected = conn
        .execute(
            r#"
            UPDATE rooms
            SET status = 'maintenance'
            WHERE room_id = ?1
              AND status = 'available'
            "#,
            params![room_id],
        )
        .map_err(|e| format!("Failed to set room maintenance: {}", e))?;

    if affected == 0 {
        return Err("Room not found or room is not available".to_string());
    }

    Ok(())
}

// ============================================================
// REMOVE ROOM FROM MAINTENANCE
//
// Changes:
// maintenance -> available
// ============================================================

#[tauri::command]
pub fn remove_room_maintenance(app: AppHandle, room_id: i64) -> Result<(), String> {
    // Get database path
    let db_path =
        crate::database::database_path(&app).map_err(|e| format!("Database path error: {}", e))?;

    // Open database
    let conn = Connection::open(db_path).map_err(|e| format!("Database error: {}", e))?;

    // Change maintenance room back to available
    let affected = conn
        .execute(
            r#"
            UPDATE rooms
            SET status = 'available'
            WHERE room_id = ?1
              AND status = 'maintenance'
            "#,
            params![room_id],
        )
        .map_err(|e| format!("Failed to remove room maintenance: {}", e))?;

    if affected == 0 {
        return Err("Room not found or room is not under maintenance".to_string());
    }

    Ok(())
}

