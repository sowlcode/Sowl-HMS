use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::database::database_path;
use crate::room_charges::catch_up_room_charges;

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

    pub male_count: i64,
    pub female_count: i64,

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

#[derive(Debug, Serialize)]
pub struct RegistrationHistory {
    pub registration_id: i64,
    pub customer_name: String,
    pub phone_number: String,
    pub relation: String,
    pub status: String,
    pub check_in: String,
    pub check_out: Option<String>,
    pub room_count: i64,
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
// HELPER: CREATE CHECK-IN ROOM BILL ITEM
// ============================================================
//
// Item name format:  "Room Charge (101)"
// Nightly charges use  "Room Charge (101) - N night(s)"  so the
// two are distinguishable via the presence of " - ".

fn create_room_bill_item(
    tx: &Connection,
    registration_id: i64,
    _room_id: i64,
    room_rate: f64,
    room_number: &str,
    added_by: &str,
) -> Result<(), String> {
    let item_name = format!("Room Charge ({})", room_number);

    tx.execute(
        r#"
        INSERT INTO bill_items (
            registration_id,
            service_id,
            item_type,
            item_name,
            quantity,
            unit_price,
            total,
            added_by
        )
        VALUES (?, NULL, 'room', ?, 1, ?, ?, ?)
        "#,
        params![registration_id, item_name, room_rate, room_rate, added_by],
    )
    .map_err(|e| format!("Failed to create room bill item: {}", e))?;

    Ok(())
}

// ============================================================
// CREATE BOOKING
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
    username: String,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<i64, String> {
    crate::session::require_session(&state)?;

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
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // ============================================================
    // REMOVE DUPLICATE ROOM IDs
    // ============================================================

    let mut unique_rooms = room_ids.clone();
    unique_rooms.sort_unstable();
    unique_rooms.dedup();

    // ============================================================
    // VERIFY CUSTOMER EXISTS
    // ============================================================

    let customer_exists: bool = tx
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

    // ============================================================
    // CHECK FOR EXISTING ACTIVE REGISTRATION
    // ============================================================

    let existing_registration: Option<i64> = tx
        .query_row(
            "
            SELECT registration_id
            FROM registrations
            WHERE customer_id = ?1
              AND status = 'active'
            ORDER BY registration_id DESC
            LIMIT 1
            ",
            params![customer_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let registration_id = match existing_registration {
        Some(id) => id,

        None => {
            // ====================================================
            // NO ACTIVE REGISTRATION — CREATE NEW ONE
            // ====================================================

            let actual_check_in = match check_in {
                Some(value) if !value.trim().is_empty() => value,
                _ => "CURRENT_TIMESTAMP".to_string(),
            };

            if actual_check_in == "CURRENT_TIMESTAMP" {
                tx.execute(
                    "
                    INSERT INTO registrations
                    (
                        customer_id,
                        check_in,
                        relation,
                        status
                    )
                    VALUES
                    (
                        ?1,
                        CURRENT_TIMESTAMP,
                        ?2,
                        'active'
                    )
                    ",
                    params![customer_id, relation.trim()],
                )
                .map_err(|e| e.to_string())?;
            } else {
                tx.execute(
                    "
                    INSERT INTO registrations
                    (
                        customer_id,
                        check_in,
                        relation,
                        status
                    )
                    VALUES
                    (
                        ?1,
                        ?2,
                        ?3,
                        'active'
                    )
                    ",
                    params![customer_id, actual_check_in, relation.trim()],
                )
                .map_err(|e| e.to_string())?;
            }

            tx.last_insert_rowid()
        }
    };

    // ============================================================
    // CATCH UP PENDING ROOM CHARGES
    // ============================================================
    //
    // If we're reusing an existing registration, this bills any
    // nights that elapsed since the last sync. If it's a fresh
    // registration there are no active rooms yet, so it's a no-op.
    // ============================================================

    catch_up_room_charges(&tx, Some(registration_id))?;

    // ============================================================
    // ASSIGN ROOMS TO THE REGISTRATION & CREATE BILL ITEMS
    // ============================================================

    for room_id in unique_rooms {
        // --------------------------------------------------------
        // CHECK ROOM STATUS AND GET ROOM RATE & NUMBER
        // --------------------------------------------------------

        let (room_status, room_rate, room_number): (String, f64, String) = tx
            .query_row(
                "
                SELECT status, room_rate, room_number
                FROM rooms
                WHERE room_id = ?1
                ",
                params![room_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|e| format!("Room ID {} does not exist or error: {}", room_id, e))?;

        if room_status != "available" {
            return Err(format!(
                "Room {} is not available. Current status: {}",
                room_id, room_status
            ));
        }

        // --------------------------------------------------------
        // MAKE SURE ROOM IS NOT ALREADY IN THIS REGISTRATION
        // --------------------------------------------------------

        let already_assigned: bool = tx
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
                params![registration_id, room_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if already_assigned {
            return Err(format!(
                "Room {} is already assigned to this registration.",
                room_id
            ));
        }

        // --------------------------------------------------------
        // ADD ROOM TO REGISTRATION
        // --------------------------------------------------------
        //
        // last_charged_date is the *next* 12:00 PM boundary after
        // now. The check-in day is billed immediately below, so we
        // must not charge again for the current boundary.
        // --------------------------------------------------------

        tx.execute(
            r#"
            INSERT INTO registration_rooms
            (
                registration_id,
                room_id,
                male_count,
                female_count,
                check_in,
                check_out,
                status,
                last_charged_date,
                nightly_rate
            )
            VALUES
            (
                ?1,
                ?2,
                ?3,
                ?4,
                CURRENT_TIMESTAMP,
                NULL,
                'active',
                date('now', 'localtime'),
                ?5
            )
            "#,
            params![
                registration_id,
                room_id,
                male_count,
                female_count,
                room_rate
            ],
        )
        .map_err(|e| e.to_string())?;

        // Check-in day room charge
        create_room_bill_item(
            &tx,
            registration_id,
            room_id,
            room_rate,
            &room_number,
            &username,
        )?;

        // --------------------------------------------------------
        // MARK ROOM AS RESERVED
        // --------------------------------------------------------

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
    username: String,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

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

    // Bill any pending nightly charges for existing rooms first
    catch_up_room_charges(&tx, Some(registration_id))?;

    // Get the male_count and female_count from an existing active room
    let (male_count, female_count): (i64, i64) = tx
        .query_row(
            "
            SELECT male_count, female_count
            FROM registration_rooms
            WHERE registration_id = ?1
              AND status = 'active'
            LIMIT 1
            ",
            params![registration_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    // Check room and get room rate and number
    let (room_status, room_rate, room_number): (String, f64, String) = tx
        .query_row(
            "
            SELECT status, room_rate, room_number
            FROM rooms
            WHERE room_id = ?1
            ",
            params![room_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("Room does not exist: {}", e))?;

    if room_status != "available" {
        return Err(format!(
            "Room is not available. Current status: {}",
            room_status
        ));
    }

    // Add room with last_charged_date + nightly_rate
    tx.execute(
        r#"
        INSERT INTO registration_rooms
            (
                registration_id,
                room_id,
                male_count,
                female_count,
                check_in,
                check_out,
                status,
                last_charged_date,
                nightly_rate
            )
        VALUES
            (
                ?1,
                ?2,
                ?3,
                ?4,
                CURRENT_TIMESTAMP,
                NULL,
                'active',
                date('now', 'localtime'),
                ?5
            )
        "#,
        params![
            registration_id,
            room_id,
            male_count,
            female_count,
            room_rate
        ],
    )
    .map_err(|e| e.to_string())?;

    // Check-in day room charge for the new room
    create_room_bill_item(
        &tx,
        registration_id,
        room_id,
        room_rate,
        &room_number,
        &username,
    )?;

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
// ============================================================

// ============================================================
// CHANGE ROOM
// ============================================================

// ============================================================
// CHANGE ROOM
// ============================================================

#[tauri::command]
pub fn change_registration_room(
    app: AppHandle,
    registration_id: i64,
    old_room_id: i64,
    new_room_id: i64,
    username: String,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

    if old_room_id == new_room_id {
        return Err("Old room and new room cannot be the same.".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // ============================================================
    // VERIFY REGISTRATION IS ACTIVE
    // ============================================================

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

    // ============================================================
    // CATCH UP PENDING NIGHTLY CHARGES
    // ============================================================
    //
    // Bill the old room up to the current 12:00 PM boundary
    // BEFORE we close it. This ensures any nights the guest has
    // already stayed in the old room are recorded as bill items.
    // ============================================================

    catch_up_room_charges(&tx, Some(registration_id))?;

    // ============================================================
    // GET GUEST COUNTS FROM AN EXISTING ACTIVE ROOM
    // ============================================================

    let (male_count, female_count): (i64, i64) = tx
        .query_row(
            "
            SELECT male_count, female_count
            FROM registration_rooms
            WHERE registration_id = ?1
              AND status = 'active'
            LIMIT 1
            ",
            params![registration_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    // ============================================================
    // VERIFY OLD ROOM IS CURRENTLY ASSIGNED
    // ============================================================

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

    // ============================================================
    // VERIFY NEW ROOM EXISTS AND IS AVAILABLE
    // ============================================================

    let (new_room_status, new_room_rate, new_room_number): (String, f64, String) = tx
        .query_row(
            "
            SELECT status, room_rate, room_number
            FROM rooms
            WHERE room_id = ?1
            ",
            params![new_room_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("New room does not exist: {}", e))?;

    if new_room_status != "available" {
        return Err(format!(
            "New room is not available. Current status: {}",
            new_room_status
        ));
    }

    // ============================================================
    // GET OLD ROOM'S NUMBER
    // ============================================================

    let old_room_number: String = tx
        .query_row(
            "SELECT room_number FROM rooms WHERE room_id = ?1",
            params![old_room_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Old room does not exist: {}", e))?;

    // ============================================================
    // CLOSE OLD ROOM ASSIGNMENT (local time)
    // ============================================================

    tx.execute(
        "
        UPDATE registration_rooms
        SET
            check_out = datetime('now', 'localtime'),
            status = 'completed'
        WHERE registration_id = ?1
          AND room_id = ?2
          AND status = 'active'
          AND check_out IS NULL
        ",
        params![registration_id, old_room_id],
    )
    .map_err(|e| e.to_string())?;

    // ============================================================
    // RELEASE OLD ROOM
    // ============================================================

    tx.execute(
        "
        UPDATE rooms
        SET status = 'available'
        WHERE room_id = ?1
        ",
        params![old_room_id],
    )
    .map_err(|e| e.to_string())?;

    // ============================================================
    // ASSIGN NEW ROOM (local time, fresh last_charged_date)
    // ============================================================

    tx.execute(
        r#"
        INSERT INTO registration_rooms
            (
                registration_id,
                room_id,
                male_count,
                female_count,
                check_in,
                check_out,
                status,
                last_charged_date,
                nightly_rate
            )
        VALUES
            (
                ?1,
                ?2,
                ?3,
                ?4,
                datetime('now', 'localtime'),
                NULL,
                'active',
                date('now', 'localtime'),
                ?5
            )
        "#,
        params![
            registration_id,
            new_room_id,
            male_count,
            female_count,
            new_room_rate
        ],
    )
    .map_err(|e| e.to_string())?;

    // ============================================================
    // REMOVE TODAY'S CHECK-IN BILL ITEM FOR THE OLD ROOM
    // ============================================================
    //
    // The guest is moving to a new room, so today's room charge
    // for the old room should be swapped for the new room's
    // charge. Nightly charges (if any) are preserved so the
    // historical stay in the old room is still billed.
    //
    // Item naming convention:
    //   check-in : "Room Charge (101)"
    //   nightly  : "Room Charge (101) - N night(s)"
    // ============================================================

    let old_checkin_item_name = format!("Room Charge ({})", old_room_number);

    let deleted = tx
        .execute(
            r#"
            DELETE FROM bill_items
            WHERE registration_id = ?1
              AND item_type = 'room'
              AND item_name = ?2
            "#,
            params![registration_id, old_checkin_item_name],
        )
        .map_err(|e| format!("Failed to delete old check-in bill item: {}", e))?;

    if deleted > 0 {
        println!(
            "Room change: removed today's check-in charge for old room {}",
            old_room_number
        );
    } else {
        println!(
            "Room change: no check-in charge found for old room {} (nothing to remove)",
            old_room_number
        );
    }

    // ============================================================
    // CREATE CHECK-IN BILL ITEM FOR NEW ROOM
    // ============================================================

    create_room_bill_item(
        &tx,
        registration_id,
        new_room_id,
        new_room_rate,
        &new_room_number,
        &username,
    )?;

    // ============================================================
    // OCCUPY NEW ROOM
    // ============================================================

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
pub fn get_booking(app: AppHandle, registration_id: i64,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<Booking, String> {
    crate::session::require_session(&state)?;

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
                r.relation,
                r.status
            FROM registrations r
            INNER JOIN customers c
                ON c.customer_id = r.customer_id
            WHERE r.registration_id = ?1
            ",
            params![registration_id],
            |row| {
                let (male_count, female_count): (i64, i64) = conn
                    .query_row(
                        "
                        SELECT COALESCE(SUM(male_count), 0), COALESCE(SUM(female_count), 0)
                        FROM registration_rooms
                        WHERE registration_id = ?1
                          AND status = 'active'
                        ",
                        params![registration_id],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .unwrap_or((0, 0));

                Ok(Booking {
                    registration_id: row.get(0)?,
                    customer_id: row.get(1)?,
                    customer_name: row.get(2)?,
                    phone_number: row.get(3)?,
                    check_in: row.get(4)?,
                    check_out: row.get(5)?,
                    booking_datetime: row.get(6)?,
                    male_count,
                    female_count,
                    relation: row.get(7)?,
                    status: row.get(8)?,
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

    // Get rooms
    let mut stmt = conn
        .prepare(
            "
            SELECT
                rr.id,
                rr.registration_id,
                rr.room_id,
                rm.room_number,
                rm.room_rate,
                rr.male_count,
                rr.female_count,
                rr.check_in,
                rr.check_out,
                rr.status
            FROM registration_rooms rr
            INNER JOIN rooms rm
                ON rm.room_id = rr.room_id
            WHERE rr.registration_id = ?1
              AND rr.status = 'active'
              AND rr.check_out IS NULL
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
                male_count: row.get(5)?,
                female_count: row.get(6)?,
                check_in: row.get(7)?,
                check_out: row.get(8)?,
                status: row.get(9)?,
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
pub fn get_active_bookings(app: AppHandle,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<Vec<Booking>, String> {
    crate::session::require_session(&state)?;

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    // Catch up nightly charges for every active registration
    catch_up_room_charges(&conn, None)?;

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
                male_count: 0,
                female_count: 0,
                relation: row.get(7)?,
                status: row.get(8)?,
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
                    rr.male_count,
                    rr.female_count,
                    rr.check_in,
                    rr.check_out,
                    rr.status
                FROM registration_rooms rr
                INNER JOIN rooms rm
                    ON rm.room_id = rr.room_id
                WHERE rr.registration_id = ?1
                  AND rr.status = 'active'
                  AND rr.check_out IS NULL
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
                    male_count: row.get(5)?,
                    female_count: row.get(6)?,
                    check_in: row.get(7)?,
                    check_out: row.get(8)?,
                    status: row.get(9)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut total_male = 0;
        let mut total_female = 0;

        for room in room_rows {
            let room_data = room.map_err(|e| e.to_string())?;
            total_male += room_data.male_count;
            total_female += room_data.female_count;
            booking.rooms.push(room_data);
        }

        booking.male_count = total_male;
        booking.female_count = total_female;

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
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<Vec<BookingRoom>, String> {
    crate::session::require_session(&state)?;

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
                rr.male_count,
                rr.female_count,
                rr.check_in,
                rr.check_out,
                rr.status
            FROM registration_rooms rr
            INNER JOIN rooms rm
                ON rm.room_id = rr.room_id
            WHERE rr.registration_id = ?1
              AND rr.status = 'active'
              AND rr.check_out IS NULL
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
                male_count: row.get(5)?,
                female_count: row.get(6)?,
                check_in: row.get(7)?,
                check_out: row.get(8)?,
                status: row.get(9)?,
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
pub fn get_registration_history(app: AppHandle,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<Vec<RegistrationHistory>, String> {
    crate::session::require_session(&state)?;

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT 
                r.registration_id,
                c.name as customer_name,
                c.phone_number,
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

    let history = stmt
        .query_map([], |row| {
            Ok(RegistrationHistory {
                registration_id: row.get(0)?,
                customer_name: row.get(1)?,
                phone_number: row.get(2)?,
                relation: row.get(3)?,
                status: row.get(4)?,
                check_in: row.get(5)?,
                check_out: row.get(6)?,
                room_count: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to retrieve history: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read history: {}", e))?;

    Ok(history)
}

// ============================================================
// CHECKOUT ENTIRE REGISTRATION
// ============================================================

#[tauri::command]
pub fn checkout_registration(app: AppHandle, registration_id: i64,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

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

    // Final catch-up: bill every remaining night up to today's 12 PM boundary
    catch_up_room_charges(&tx, Some(registration_id))?;

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

    // Close all room assignments
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

    // Release all rooms
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

    // Complete registration
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
pub fn checkout_room(app: AppHandle, registration_id: i64, room_id: i64,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // Check if room is active in this registration
    let exists: bool = tx
        .query_row(
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
        )
        .map_err(|e| format!("Failed to verify room assignment: {}", e))?;

    if !exists {
        return Err("Room not found or not active in this registration".to_string());
    }

    // Final catch-up before closing this room
    catch_up_room_charges(&tx, Some(registration_id))?;

    // Checkout the room
    tx.execute(
        r#"
        UPDATE registration_rooms
        SET status = 'completed',
            check_out = CURRENT_TIMESTAMP
        WHERE registration_id = ?1 
          AND room_id = ?2
          AND status = 'active'
        "#,
        params![registration_id, room_id],
    )
    .map_err(|e| format!("Failed to checkout room: {}", e))?;

    // Update room status back to available
    tx.execute(
        r#"
        UPDATE rooms
        SET status = 'available'
        WHERE room_id = ?1
        "#,
        params![room_id],
    )
    .map_err(|e| format!("Failed to update room status: {}", e))?;

    // Check if all rooms in registration are checked out
    let active_rooms: i64 = tx
        .query_row(
            r#"
        SELECT COUNT(*) 
        FROM registration_rooms 
        WHERE registration_id = ?1 
          AND status = 'active'
        "#,
            params![registration_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count active rooms: {}", e))?;

    // If no active rooms, complete the registration
    if active_rooms == 0 {
        tx.execute(
            r#"
            UPDATE registrations
            SET status = 'completed',
                check_out = CURRENT_TIMESTAMP
            WHERE registration_id = ?1
            "#,
            params![registration_id],
        )
        .map_err(|e| format!("Failed to update registration status: {}", e))?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}
