use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::database::database_path;

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
// REQUEST STRUCTS
// ============================================================

#[derive(Debug, Deserialize)]
pub struct AddServiceRequest {
    pub registration_id: i64,
    pub service_id: i64,
    pub quantity: f64,
}

#[derive(Debug, Deserialize)]
pub struct AddCustomItemRequest {
    pub registration_id: i64,
    pub item_name: String,
    pub quantity: f64,
    pub unit_price: f64,
}

#[derive(Debug, Deserialize)]
pub struct ReturnServiceRequest {
    pub bill_id: i64,
    pub quantity: f64,
}

// ============================================================
// RESPONSE STRUCTS
// ============================================================

#[derive(Debug, Serialize)]
pub struct BillItem {
    pub bill_id: i64,
    pub registration_id: i64,
    pub service_id: Option<i64>,
    pub item_type: String,
    pub item_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub total: f64,
    pub added_at: String,
    pub is_inventory: bool,
    pub added_by: String,
}

#[derive(Debug, Serialize)]
pub struct RegistrationBill {
    pub registration_id: i64,
    pub items: Vec<BillItem>,
    pub subtotal: f64,
    pub total: f64,
}

// ============================================================
// VALIDATE ACTIVE REGISTRATION
// ============================================================

fn verify_active_registration(
    tx: &rusqlite::Transaction,
    registration_id: i64,
) -> Result<(), String> {
    let status: Option<String> = tx
        .query_row(
            r#"
            SELECT status
            FROM registrations
            WHERE registration_id = ?
            "#,
            params![registration_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Failed to check registration: {}", e))?;

    match status {
        Some(status) if status == "active" => Ok(()),

        Some(status) => Err(format!(
            "Registration {} is not active. Current status: {}",
            registration_id, status
        )),

        None => Err(format!(
            "Registration {} does not exist",
            registration_id
        )),
    }
}

// ============================================================
// ADD SERVICE TO REGISTRATION
// ============================================================

#[tauri::command]
pub fn add_service_to_registration(
    app: AppHandle,
    request: AddServiceRequest,
    username: String,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<i64, String> {
    crate::session::require_session(&state)?;

    if request.registration_id <= 0 {
        return Err("Invalid registration ID".to_string());
    }

    if request.service_id <= 0 {
        return Err("Invalid service ID".to_string());
    }

    if request.quantity <= 0.0 {
        return Err("Quantity must be greater than 0".to_string());
    }

    if username.trim().is_empty() {
        return Err("Username is required".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // --------------------------------------------------------
    // CHECK REGISTRATION
    // --------------------------------------------------------

    verify_active_registration(&tx, request.registration_id)?;

    // --------------------------------------------------------
    // GET SERVICE
    // --------------------------------------------------------

    let service: Option<(String, f64, Option<f64>, bool)> = tx
        .query_row(
            r#"
            SELECT
                service_name,
                service_charge,
                stock,
                is_inventory
            FROM food_services
            WHERE service_id = ?
              AND is_deleted = 0
            "#,
            params![request.service_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, f64>(1)?,
                    row.get::<_, Option<f64>>(2)?,
                    row.get::<_, bool>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("Failed to get service: {}", e))?;

    let (service_name, service_charge, stock, is_inventory) = match service {
        Some(service) => service,

        None => {
            return Err(format!(
                "Service {} does not exist or has been deleted",
                request.service_id
            ));
        }
    };

    // --------------------------------------------------------
    // CHECK INVENTORY
    // --------------------------------------------------------

    if is_inventory {
        let current_stock = stock.unwrap_or(0.0);

        if current_stock < request.quantity {
            return Err(format!(
                "Insufficient stock for '{}'. Available: {}, requested: {}",
                service_name, current_stock, request.quantity
            ));
        }

        // ----------------------------------------------------
        // DEDUCT STOCK
        // ----------------------------------------------------

        tx.execute(
            r#"
            UPDATE food_services
            SET stock = COALESCE(stock, 0) - ?
            WHERE service_id = ?
              AND COALESCE(stock, 0) >= ?
            "#,
            params![
                request.quantity,
                request.service_id,
                request.quantity
            ],
        )
        .map_err(|e| format!("Failed to update inventory: {}", e))?;

        if tx.changes() != 1 {
            return Err(format!(
                "Unable to deduct inventory for '{}'",
                service_name
            ));
        }
    }

    // --------------------------------------------------------
    // CALCULATE TOTAL
    // --------------------------------------------------------

    let total = request.quantity * service_charge;

    // --------------------------------------------------------
    // INSERT BILL ITEM
    // --------------------------------------------------------

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
            added_at,
            added_by
        )
        VALUES (?, ?, 'service', ?, ?, ?, ?, datetime('now', 'localtime'), ?)
        "#,
        params![
            request.registration_id,
            request.service_id,
            service_name,
            request.quantity,
            service_charge,
            total,
            username.trim()
        ],
    )
    .map_err(|e| format!("Failed to add service to bill: {}", e))?;

    let bill_id = tx.last_insert_rowid();

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    tx.commit()
        .map_err(|e| format!("Failed to commit service billing: {}", e))?;

    Ok(bill_id)
}

// ============================================================
// ADD CUSTOM BILL ITEM
// ============================================================

#[tauri::command]
pub fn add_custom_bill_item(
    app: AppHandle,
    request: AddCustomItemRequest,
    username: String,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<i64, String> {
    crate::session::require_session(&state)?;

    if request.registration_id <= 0 {
        return Err("Invalid registration ID".to_string());
    }

    if request.item_name.trim().is_empty() {
        return Err("Item name cannot be empty".to_string());
    }

    if request.quantity <= 0.0 {
        return Err("Quantity must be greater than 0".to_string());
    }

    if request.unit_price < 0.0 {
        return Err("Unit price cannot be negative".to_string());
    }

    if username.trim().is_empty() {
        return Err("Username is required".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // --------------------------------------------------------
    // CHECK REGISTRATION
    // --------------------------------------------------------

    verify_active_registration(&tx, request.registration_id)?;

    // --------------------------------------------------------
    // CALCULATE TOTAL
    // --------------------------------------------------------

    let total = request.quantity * request.unit_price;

    // --------------------------------------------------------
    // INSERT CUSTOM ITEM
    // --------------------------------------------------------

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
            added_at,
            added_by
        )
        VALUES (?, NULL, 'custom', ?, ?, ?, ?, datetime('now', 'localtime'), ?)
        "#,
        params![
            request.registration_id,
            request.item_name.trim(),
            request.quantity,
            request.unit_price,
            total,
            username.trim()
        ],
    )
    .map_err(|e| format!("Failed to add custom bill item: {}", e))?;

    let bill_id = tx.last_insert_rowid();

    tx.commit()
        .map_err(|e| format!("Failed to commit custom bill item: {}", e))?;

    Ok(bill_id)
}

// ============================================================
// RETURN SERVICE QUANTITY
// ============================================================

#[tauri::command]
pub fn return_service_quantity(
    app: AppHandle,
    request: ReturnServiceRequest,
    username: String,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

    if request.bill_id <= 0 {
        return Err("Invalid bill ID".to_string());
    }

    if request.quantity <= 0.0 {
        return Err("Return quantity must be greater than 0".to_string());
    }

    if username.trim().is_empty() {
        return Err("Username is required".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // --------------------------------------------------------
    // GET BILL ITEM
    // --------------------------------------------------------

    let bill_item: Option<(i64, i64, Option<i64>, String, f64, f64)> = tx
        .query_row(
            r#"
            SELECT
                bill_id,
                registration_id,
                service_id,
                item_type,
                quantity,
                unit_price
            FROM bill_items
            WHERE bill_id = ?
            "#,
            params![request.bill_id],
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
        .optional()
        .map_err(|e| format!("Failed to find bill item: {}", e))?;

    let (
        _bill_id,
        registration_id,
        service_id,
        item_type,
        billed_quantity,
        unit_price,
    ) = match bill_item {
        Some(item) => item,

        None => {
            return Err(format!(
                "Bill item {} does not exist",
                request.bill_id
            ));
        }
    };

    // --------------------------------------------------------
    // ONLY SERVICE ITEMS CAN BE RETURNED
    // --------------------------------------------------------

    if item_type != "service" {
        return Err(
            "Only service/inventory bill items can be returned".to_string()
        );
    }

    // --------------------------------------------------------
    // CHECK REGISTRATION
    // --------------------------------------------------------

    verify_active_registration(&tx, registration_id)?;

    // --------------------------------------------------------
    // CHECK SERVICE
    // --------------------------------------------------------

    let service_id = match service_id {
        Some(id) => id,

        None => {
            return Err(
                "This service bill item has no service ID".to_string()
            );
        }
    };

    let service: Option<(String, bool)> = tx
        .query_row(
            r#"
            SELECT
                service_name,
                is_inventory
            FROM food_services
            WHERE service_id = ?
            "#,
            params![service_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, bool>(1)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("Failed to get service information: {}", e))?;

    let (service_name, is_inventory) = match service {
        Some(service) => service,

        None => {
            return Err(format!(
                "Service {} no longer exists",
                service_id
            ));
        }
    };

    // --------------------------------------------------------
    // CHECK RETURN QUANTITY
    // --------------------------------------------------------

    if request.quantity > billed_quantity {
        return Err(format!(
            "Cannot return {} '{}'. Only {} was billed.",
            request.quantity,
            service_name,
            billed_quantity
        ));
    }

    // --------------------------------------------------------
    // RETURN STOCK
    // --------------------------------------------------------

    if is_inventory {
        tx.execute(
            r#"
            UPDATE food_services
            SET stock = COALESCE(stock, 0) + ?
            WHERE service_id = ?
            "#,
            params![request.quantity, service_id],
        )
        .map_err(|e| format!("Failed to return inventory: {}", e))?;
    }

    // --------------------------------------------------------
    // NEW QUANTITY / TOTAL
    // --------------------------------------------------------

    let new_quantity = billed_quantity - request.quantity;
    let new_total = new_quantity * unit_price;

    // --------------------------------------------------------
    // UPDATE OR DELETE BILL ITEM
    // --------------------------------------------------------
    //
    // If the entire quantity is returned, remove the line item
    // entirely rather than leaving a 0-quantity ghost.

    if new_quantity == 0.0 {
        tx.execute(
            r#"
            DELETE FROM bill_items
            WHERE bill_id = ?
            "#,
            params![request.bill_id],
        )
        .map_err(|e| format!("Failed to remove fully-returned item: {}", e))?;
    } else {
        tx.execute(
            r#"
            UPDATE bill_items
            SET
                quantity = ?,
                total = ?
            WHERE bill_id = ?
            "#,
            params![
                new_quantity,
                new_total,
                request.bill_id
            ],
        )
        .map_err(|e| format!("Failed to update bill item: {}", e))?;
    }

    // --------------------------------------------------------
    // AUDIT LOG
    // --------------------------------------------------------
    // Best-effort: if the audit table doesn't exist, this fails
    // silently so the return still succeeds.

    let _ = tx.execute(
        r#"
        INSERT INTO bill_audit_log (
            bill_id,
            registration_id,
            action,
            old_quantity,
            new_quantity,
            performed_by
        )
        VALUES (?, ?, 'return', ?, ?, ?)
        "#,
        params![
            request.bill_id,
            registration_id,
            billed_quantity,
            new_quantity,
            username.trim()
        ],
    );

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    tx.commit()
        .map_err(|e| format!("Failed to commit returned item: {}", e))?;

    Ok(())
}

// ============================================================
// GET REGISTRATION BILL
// ============================================================

#[tauri::command]
pub fn get_registration_bill(
    app: AppHandle,
    registration_id: i64,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<RegistrationBill, String> {
    crate::session::require_session(&state)?;

    if registration_id <= 0 {
        return Err("Invalid registration ID".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    crate::room_charges::catch_up_room_charges(&conn, Some(registration_id))?;

    // Check registration exists
    let exists: bool = conn
        .query_row(
            r#"
            SELECT EXISTS(
                SELECT 1
                FROM registrations
                WHERE registration_id = ?
            )
            "#,
            params![registration_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check registration: {}", e))?;

    if !exists {
        return Err(format!(
            "Registration {} does not exist",
            registration_id
        ));
    }

    // Get bill items
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                b.bill_id,
                b.registration_id,
                b.service_id,
                b.item_type,
                COALESCE(b.item_name, '') as item_name,
                b.quantity,
                b.unit_price,
                b.total,
                b.added_at,
                COALESCE(fs.is_inventory, 0) as is_inventory,
                COALESCE(b.added_by, 'system') as added_by
            FROM bill_items b
            LEFT JOIN food_services fs
                ON fs.service_id = b.service_id
            WHERE b.registration_id = ?
            ORDER BY b.added_at ASC, b.bill_id ASC
            "#,
        )
        .map_err(|e| format!("Failed to prepare bill query: {}", e))?;

    let rows = stmt
        .query_map(params![registration_id], |row| {
            Ok(BillItem {
                bill_id: row.get(0)?,
                registration_id: row.get(1)?,
                service_id: row.get(2)?,
                item_type: row.get(3)?,
                item_name: row.get(4)?,
                quantity: row.get(5)?,
                unit_price: row.get(6)?,
                total: row.get(7)?,
                added_at: row.get(8)?,
                is_inventory: row.get(9)?,
                added_by: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to read bill items: {}", e))?;

    let mut items = Vec::new();
    let mut subtotal = 0.0;

    for row in rows {
        let item = row
            .map_err(|e| format!("Failed to read bill item: {}", e))?;
        subtotal += item.total;
        items.push(item);
    }

    let total = subtotal;

    Ok(RegistrationBill {
        registration_id,
        items,
        subtotal,
        total,
    })
}

// ============================================================
// DELETE CUSTOM BILL ITEM
// ============================================================

#[tauri::command]
pub fn delete_custom_bill_item(
    app: AppHandle,
    bill_id: i64,
    username: String,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

    if bill_id <= 0 {
        return Err("Invalid bill ID".to_string());
    }

    if username.trim().is_empty() {
        return Err("Username is required".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // --------------------------------------------------------
    // CHECK BILL ITEM
    // --------------------------------------------------------

    let item: Option<(i64, String, f64)> = tx
        .query_row(
            r#"
            SELECT
                registration_id,
                item_type,
                quantity
            FROM bill_items
            WHERE bill_id = ?
            "#,
            params![bill_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("Failed to find bill item: {}", e))?;

    let (registration_id, item_type, quantity) = match item {
        Some(item) => item,

        None => {
            return Err(format!(
                "Bill item {} does not exist",
                bill_id
            ));
        }
    };

    // --------------------------------------------------------
    // CHECK REGISTRATION
    // --------------------------------------------------------

    verify_active_registration(&tx, registration_id)?;

    // --------------------------------------------------------
    // ONLY CUSTOM ITEMS CAN BE DELETED
    // --------------------------------------------------------

    if item_type != "custom" {
        return Err(
            "Only custom bill items can be deleted directly. \
             Use return_service_quantity for service items."
                .to_string(),
        );
    }

    // --------------------------------------------------------
    // DELETE
    // --------------------------------------------------------

    tx.execute(
        r#"
        DELETE FROM bill_items
        WHERE bill_id = ?
        "#,
        params![bill_id],
    )
    .map_err(|e| format!("Failed to delete bill item: {}", e))?;

    // --------------------------------------------------------
    // AUDIT LOG (best-effort)
    // --------------------------------------------------------

    let _ = tx.execute(
        r#"
        INSERT INTO bill_audit_log (
            bill_id,
            registration_id,
            action,
            old_quantity,
            new_quantity,
            performed_by
        )
        VALUES (?, ?, 'delete', ?, 0, ?)
        "#,
        params![bill_id, registration_id, quantity, username.trim()],
    );

    tx.commit()
        .map_err(|e| format!("Failed to commit deletion: {}", e))?;

    Ok(())
}

// ============================================================
// UPDATE CUSTOM BILL ITEM QUANTITY
// ============================================================

#[tauri::command]
pub fn update_custom_bill_item_quantity(
    app: AppHandle,
    bill_id: i64,
    quantity: f64,
    username: String,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<(), String> {
    crate::session::require_session(&state)?;

    if bill_id <= 0 {
        return Err("Invalid bill ID".to_string());
    }

    if quantity < 0.0 {
        return Err("Quantity cannot be negative".to_string());
    }

    if username.trim().is_empty() {
        return Err("Username is required".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Check bill item exists and is custom
    let item: Option<(i64, String, f64, f64)> = tx
        .query_row(
            r#"
            SELECT
                registration_id,
                item_type,
                unit_price,
                quantity
            FROM bill_items
            WHERE bill_id = ?
            "#,
            params![bill_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("Failed to find bill item: {}", e))?;

    let (registration_id, item_type, unit_price, old_quantity) = match item {
        Some(item) => item,
        None => {
            return Err(format!("Bill item {} does not exist", bill_id));
        }
    };

    // Only custom items can be updated this way
    if item_type != "custom" {
        return Err("Only custom bill items can be updated directly".to_string());
    }

    // Check registration
    verify_active_registration(&tx, registration_id)?;

    if quantity == 0.0 {
        // Delete the item if quantity is zero
        tx.execute(
            "DELETE FROM bill_items WHERE bill_id = ?",
            params![bill_id],
        )
        .map_err(|e| format!("Failed to delete bill item: {}", e))?;
    } else {
        // Update quantity and total
        let total = quantity * unit_price;
        tx.execute(
            r#"
            UPDATE bill_items
            SET
                quantity = ?,
                total = ?
            WHERE bill_id = ?
            "#,
            params![quantity, total, bill_id],
        )
        .map_err(|e| format!("Failed to update bill item: {}", e))?;
    }

    // --------------------------------------------------------
    // AUDIT LOG (best-effort)
    // --------------------------------------------------------

    let _ = tx.execute(
        r#"
        INSERT INTO bill_audit_log (
            bill_id,
            registration_id,
            action,
            old_quantity,
            new_quantity,
            performed_by
        )
        VALUES (?, ?, 'update', ?, ?, ?)
        "#,
        params![
            bill_id,
            registration_id,
            old_quantity,
            quantity,
            username.trim()
        ],
    );

    tx.commit()
        .map_err(|e| format!("Failed to commit update: {}", e))?;

    Ok(())
}