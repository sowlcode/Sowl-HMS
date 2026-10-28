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
pub struct AddPaymentRequest {
    pub registration_id: i64,
    pub booking_id: Option<i64>,
    pub payment_amount: f64,
    pub payment_method: String,
}

// ============================================================
// RESPONSE STRUCTS
// ============================================================

#[derive(Debug, Serialize)]
pub struct Payment {
    pub payment_id: i64,
    pub registration_id: i64,
    pub booking_id: Option<i64>,
    pub payment_amount: f64,
    pub payment_method: String,
    pub payment_datetime: String,
    pub payment_receiver: String,
}

#[derive(Debug, Serialize)]
pub struct RegistrationPayments {
    pub registration_id: i64,
    pub payments: Vec<Payment>,
    pub total_paid: f64,
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
// ADD PAYMENT
// ============================================================

#[tauri::command]
pub fn add_payment(
    app: AppHandle,
    request: AddPaymentRequest,
    payment_receiver: String,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<i64, String> {
    crate::session::require_session(&state)?;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if request.registration_id <= 0 {
        return Err("Invalid registration ID".to_string());
    }

    if let Some(booking_id) = request.booking_id {
        if booking_id <= 0 {
            return Err("Invalid booking ID".to_string());
        }
    }

    if request.payment_amount <= 0.0 {
        return Err("Payment amount must be greater than 0".to_string());
    }

    if payment_receiver.trim().is_empty() {
        return Err("Payment receiver is required".to_string());
    }

    let payment_method = request.payment_method.trim().to_lowercase();

    if payment_method != "cash" && payment_method != "online" {
        return Err(
            "Invalid payment method. Payment method must be 'cash' or 'online'"
                .to_string(),
        );
    }

    // --------------------------------------------------------
    // DATABASE
    // --------------------------------------------------------

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // --------------------------------------------------------
    // CHECK REGISTRATION
    // --------------------------------------------------------

    verify_active_registration(&tx, request.registration_id)?;

    
    // --------------------------------------------------------
    // INSERT PAYMENT
    // --------------------------------------------------------

    tx.execute(
        r#"
        INSERT INTO payments (
            registration_id,
            booking_id,
            payment_amount,
            payment_method,
            payment_datetime,
            payment_receiver
        )
        VALUES (
            ?,
            ?,
            ?,
            ?,
            datetime('now', 'localtime'),
            ?
        )
        "#,
        params![
            request.registration_id,
            request.booking_id,
            request.payment_amount,
            payment_method,
            payment_receiver.trim()
        ],
    )
    .map_err(|e| format!("Failed to add payment: {}", e))?;

    let payment_id = tx.last_insert_rowid();

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    tx.commit()
        .map_err(|e| format!("Failed to commit payment: {}", e))?;

    Ok(payment_id)
}

// ============================================================
// GET REGISTRATION PAYMENTS
// ============================================================

#[tauri::command]
pub fn get_registration_payments(
    app: AppHandle,
    registration_id: i64,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<RegistrationPayments, String> {
    crate::session::require_session(&state)?;

    if registration_id <= 0 {
        return Err("Invalid registration ID".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    // --------------------------------------------------------
    // CHECK REGISTRATION EXISTS
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // GET PAYMENTS
    // --------------------------------------------------------

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                payment_id,
                registration_id,
                booking_id,
                payment_amount,
                payment_method,
                payment_datetime,
                payment_receiver
            FROM payments
            WHERE registration_id = ?
            ORDER BY payment_datetime ASC, payment_id ASC
            "#,
        )
        .map_err(|e| format!("Failed to prepare payment query: {}", e))?;

    let rows = stmt
        .query_map(params![registration_id], |row| {
            Ok(Payment {
                payment_id: row.get(0)?,
                registration_id: row.get(1)?,
                booking_id: row.get(2)?,
                payment_amount: row.get(3)?,
                payment_method: row.get(4)?,
                payment_datetime: row.get(5)?,
                payment_receiver: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to read payments: {}", e))?;

    let mut payments = Vec::new();
    let mut total_paid = 0.0;

    for row in rows {
        let payment =
            row.map_err(|e| format!("Failed to read payment: {}", e))?;

        total_paid += payment.payment_amount;
        payments.push(payment);
    }

    Ok(RegistrationPayments {
        registration_id,
        payments,
        total_paid,
    })
}

// ============================================================
// GET PAYMENT BY ID
// ============================================================

#[tauri::command]
pub fn get_payment(
    app: AppHandle,
    payment_id: i64,
    state: tauri::State<'_, crate::session::SessionState>
) -> Result<Payment, String> {
    crate::session::require_session(&state)?;

    if payment_id <= 0 {
        return Err("Invalid payment ID".to_string());
    }

    let conn = get_connection(&app).map_err(|e| e.to_string())?;

    let payment = conn
        .query_row(
            r#"
            SELECT
                payment_id,
                registration_id,
                booking_id,
                payment_amount,
                payment_method,
                payment_datetime,
                payment_receiver
            FROM payments
            WHERE payment_id = ?
            "#,
            params![payment_id],
            |row| {
                Ok(Payment {
                    payment_id: row.get(0)?,
                    registration_id: row.get(1)?,
                    booking_id: row.get(2)?,
                    payment_amount: row.get(3)?,
                    payment_method: row.get(4)?,
                    payment_datetime: row.get(5)?,
                    payment_receiver: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|e| format!("Failed to get payment: {}", e))?;

    match payment {
        Some(payment) => Ok(payment),

        None => Err(format!(
            "Payment {} does not exist",
            payment_id
        )),
    }
}

