use rusqlite::{params, Connection};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// ============================================================
// DATABASE PATH
// ============================================================

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join("sowl_hms.db"))
}

// ============================================================
// CATCH-UP ROOM CHARGES
// ============================================================

pub fn catch_up_room_charges(
    conn: &Connection,
    registration_id: Option<i64>,
) -> Result<(), String> {

    // ============================================================
    // DETERMINE BILLING BOUNDARY
    // ============================================================
    //
    // Hotel billing boundary = 12:00 PM.
    //
    // Before 12 PM:
    //     boundary = yesterday
    //
    // At/after 12 PM:
    //     boundary = today
    //
    // ============================================================

    let boundary: String = conn
        .query_row(
            r#"
            SELECT CASE
                WHEN CAST(
                    strftime('%H', 'now', 'localtime')
                    AS INTEGER
                ) < 12
                    THEN date('now', 'localtime', '-1 day')
                ELSE date('now', 'localtime')
            END
            "#,
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            format!("Failed to compute billing boundary: {}", e)
        })?;

    // ============================================================
    // FETCH ACTIVE ROOM ASSIGNMENTS
    // ============================================================

    let rows: Vec<(i64, i64, i64, String, f64, String)> =
        match registration_id {

            // ====================================================
            // ONE REGISTRATION
            // ====================================================

            Some(reg_id) => {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT
                            rr.id,
                            rr.registration_id,
                            rr.room_id,
                            rr.last_charged_date,
                            rr.nightly_rate,
                            rm.room_number
                        FROM registration_rooms rr
                        INNER JOIN rooms rm
                            ON rm.room_id = rr.room_id
                        WHERE rr.registration_id = ?1
                          AND rr.status = 'active'
                          AND rr.check_out IS NULL
                          AND rr.last_charged_date IS NOT NULL
                          AND rr.last_charged_date < ?2
                        "#,
                    )
                    .map_err(|e| {
                        format!(
                            "Failed to prepare catch-up query: {}",
                            e
                        )
                    })?;

                // IMPORTANT:
                // Store the result in a variable first.
                // This makes MappedRows drop before stmt does.

                let result = stmt
                    .query_map(
                        params![reg_id, boundary],
                        |row| {
                            Ok((
                                row.get(0)?,
                                row.get(1)?,
                                row.get(2)?,
                                row.get(3)?,
                                row.get(4)?,
                                row.get(5)?,
                            ))
                        },
                    )
                    .map_err(|e| {
                        format!(
                            "Catch-up query error: {}",
                            e
                        )
                    })?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        format!(
                            "Catch-up row error: {}",
                            e
                        )
                    })?;

                result
            }

            // ====================================================
            // ALL ACTIVE REGISTRATIONS
            // ====================================================

            None => {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT
                            rr.id,
                            rr.registration_id,
                            rr.room_id,
                            rr.last_charged_date,
                            rr.nightly_rate,
                            rm.room_number
                        FROM registration_rooms rr
                        INNER JOIN rooms rm
                            ON rm.room_id = rr.room_id
                        WHERE rr.status = 'active'
                          AND rr.check_out IS NULL
                          AND rr.last_charged_date IS NOT NULL
                          AND rr.last_charged_date < ?1
                        "#,
                    )
                    .map_err(|e| {
                        format!(
                            "Failed to prepare catch-up query: {}",
                            e
                        )
                    })?;

                // IMPORTANT:
                // Store the result in a variable first.

                let result = stmt
                    .query_map(
                        params![boundary],
                        |row| {
                            Ok((
                                row.get(0)?,
                                row.get(1)?,
                                row.get(2)?,
                                row.get(3)?,
                                row.get(4)?,
                                row.get(5)?,
                            ))
                        },
                    )
                    .map_err(|e| {
                        format!(
                            "Catch-up query error: {}",
                            e
                        )
                    })?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        format!(
                            "Catch-up row error: {}",
                            e
                        )
                    })?;

                result
            }
        };

    // ============================================================
    // PROCESS EACH ROOM
    // ============================================================

    for (
        rr_id,
        reg_id,
        _room_id,
        last_charged,
        nightly_rate,
        room_number,
    ) in rows
    {
        // ========================================================
        // CALCULATE PENDING NIGHTS
        // ========================================================

        let pending_nights: i64 = conn
            .query_row(
                r#"
                SELECT CAST(
                    julianday(?2) - julianday(?1)
                    AS INTEGER
                )
                "#,
                params![last_charged, boundary],
                |row| row.get(0),
            )
            .map_err(|e| {
                format!(
                    "Failed to compute pending nights: {}",
                    e
                )
            })?;

        if pending_nights <= 0 {
            continue;
        }

        // ========================================================
        // INSERT MISSING ROOM CHARGES
        // ========================================================

        for _ in 0..pending_nights {
            let item_name =
                format!(
                    "Room Charge ({}) - 1 night(s)",
                    room_number
                );

            conn.execute(
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
                VALUES (
                    ?1,
                    NULL,
                    'room',
                    ?2,
                    1,
                    ?3,
                    ?4,
                    'system'
                )
                "#,
                params![
                    reg_id,
                    item_name,
                    nightly_rate,
                    nightly_rate
                ],
            )
            .map_err(|e| {
                format!(
                    "Failed to insert nightly room charge: {}",
                    e
                )
            })?;
        }

        // ========================================================
        // UPDATE LAST CHARGED DATE
        // ========================================================

        conn.execute(
            r#"
            UPDATE registration_rooms
            SET last_charged_date = ?2
            WHERE id = ?1
            "#,
            params![rr_id, boundary],
        )
        .map_err(|e| {
            format!(
                "Failed to update last_charged_date: {}",
                e
            )
        })?;
    }

    Ok(())
}

// ============================================================
// STARTUP CATCH-UP
// ============================================================
//
// Opens the SQLite database and catches up all active rooms.
//
// ============================================================

pub fn catch_up_room_charges_from_app(
    app: &AppHandle,
) -> Result<(), String> {

    let db_path = database_path(app)?;

    let conn = Connection::open(&db_path)
        .map_err(|e| {
            format!(
                "Failed to open database for room charge catch-up: {}",
                e
            )
        })?;

    catch_up_room_charges(&conn, None)
}

// ============================================================
// TAURI COMMAND
// ============================================================
//
// Frontend can call:
//
// invoke("sync_room_charges", {
//     registrationId: null
// })
//
// or:
//
// invoke("sync_room_charges", {
//     registrationId: 123
// })
//
// ============================================================

#[tauri::command]
pub fn sync_room_charges(
    app: AppHandle,
    registration_id: Option<i64>,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;


    let db_path = database_path(&app)?;

    let conn = Connection::open(&db_path)
        .map_err(|e| {
            format!(
                "Failed to open database for room charge sync: {}",
                e
            )
        })?;

    catch_up_room_charges(&conn, registration_id)
}