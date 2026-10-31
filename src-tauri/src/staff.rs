use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::database::database_path;

// ============================================================
// DATABASE CONNECTION
// ============================================================

fn get_connection(app: &AppHandle) -> Result<Connection, String> {
    let db_path: PathBuf = database_path(app).map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;

    Ok(conn)
}

// ============================================================
// RESPONSE STRUCTS
// ============================================================

#[derive(Debug, Serialize)]
pub struct Staff {
    pub staff_id: i64,
    pub name: String,
    pub phone_number: String,
    pub address: Option<String>,
    pub position: String,
    pub document_picture: Option<String>,
    pub salary: f64,
    pub start_date: String,
    pub end_date: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct StaffSalaryHistory {
    pub salary_id: i64,
    pub staff_id: i64,
    pub monthly_salary: f64,
    pub effective_from: String,
    pub effective_to: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct StaffAbsence {
    pub absence_id: i64,
    pub staff_id: i64,
    pub absent_date: String,
    pub absence_type: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct StaffSalaryPayment {
    pub payment_id: i64,
    pub staff_id: i64,
    pub paid_amount: f64,
    pub bonus: f64,
    pub pay_date: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct StaffSalarySummary {
    pub staff_id: i64,
    pub staff_name: String,
    pub monthly_salary: f64,
    pub start_date: String,
    pub end_date: Option<String>,
    pub calculated_through: String,

    pub full_day_absences: i64,
    pub half_day_absences: i64,
    pub absent_days: f64,

    pub gross_salary: f64,
    pub absence_deduction: f64,
    pub earned_salary: f64,

    pub total_paid: f64,
    pub total_bonus: f64,
    pub salary_balance: f64,
}

#[derive(Debug, Serialize)]
pub struct StaffDetails {
    pub staff: Staff,
    pub salary_history: Vec<StaffSalaryHistory>,
    pub absences: Vec<StaffAbsence>,
    pub payments: Vec<StaffSalaryPayment>,
    pub salary_summary: StaffSalarySummary,
}

// ============================================================
// VALIDATION
// ============================================================

fn validate_id(id: i64, label: &str) -> Result<(), String> {
    if id <= 0 {
        return Err(format!("Invalid {} ID", label));
    }
    Ok(())
}

fn validate_amount(amount: f64, label: &str, allow_zero: bool) -> Result<(), String> {
    if !amount.is_finite() || amount < 0.0 || (!allow_zero && amount == 0.0) {
        return Err(format!("Invalid {}", label));
    }

    Ok(())
}

fn validate_date(conn: &Connection, date: &str, label: &str) -> Result<(), String> {
    let valid: bool = conn
        .query_row(
            "SELECT date(?1) IS NOT NULL AND date(?1) = ?1",
            params![date.trim()],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !valid {
        return Err(format!("Invalid {}. Use YYYY-MM-DD.", label));
    }

    Ok(())
}

fn validate_absence_type(value: Option<String>) -> Result<String, String> {
    let value = value.unwrap_or_else(|| "full_day".to_string());

    match value.as_str() {
        "full_day" | "half_day" => Ok(value),
        _ => Err("Absence type must be full_day or half_day".to_string()),
    }
}

// ============================================================
// STAFF RECORD
// Salary is retrieved from salary history, not staff table.
// ============================================================

fn get_staff_record(conn: &Connection, staff_id: i64) -> Result<Staff, String> {
    conn.query_row(
        r#"
        SELECT
            s.staff_id,
            s.name,
            s.phone_number,
            s.address,
            s.position,
            s.document_picture,

            COALESCE((
                SELECT h.monthly_salary
                FROM staff_salary_history h
                WHERE h.staff_id = s.staff_id
                ORDER BY h.effective_from DESC
                LIMIT 1
            ), 0),

            s.start_date,
            s.end_date,
            s.created_at

        FROM staff s
        WHERE s.staff_id = ?1
        "#,
        params![staff_id],
        |row| {
            Ok(Staff {
                staff_id: row.get(0)?,
                name: row.get(1)?,
                phone_number: row.get(2)?,
                address: row.get(3)?,
                position: row.get(4)?,
                document_picture: row.get(5)?,
                salary: row.get(6)?,
                start_date: row.get(7)?,
                end_date: row.get(8)?,
                created_at: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Staff {} does not exist", staff_id))
}

// ============================================================
// SALARY HISTORY HELPER
// ============================================================

fn get_salary_history_records(
    conn: &Connection,
    staff_id: i64,
) -> Result<Vec<StaffSalaryHistory>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                salary_id,
                staff_id,
                monthly_salary,
                effective_from,
                effective_to,
                created_at
            FROM staff_salary_history
            WHERE staff_id = ?1
            ORDER BY effective_from DESC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![staff_id], |row| {
            Ok(StaffSalaryHistory {
                salary_id: row.get(0)?,
                staff_id: row.get(1)?,
                monthly_salary: row.get(2)?,
                effective_from: row.get(3)?,
                effective_to: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }

    Ok(result)
}

// ============================================================
// ADD STAFF
// Creates staff and initial salary history together.
// ============================================================

#[tauri::command]
pub fn add_staff(
    app: AppHandle,
    name: String,
    phone_number: String,
    address: Option<String>,
    position: String,
    document_picture: Option<String>,
    salary: f64,
    start_date: String,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<i64, String> {
    crate::session::require_session(&state)?;

    let name = name.trim();
    let phone_number = phone_number.trim();
    let position = position.trim();

    if name.is_empty() || phone_number.is_empty() || position.is_empty() {
        return Err("Name, phone number and position are required".to_string());
    }

    validate_amount(salary, "Monthly salary", false)?;

    let mut conn = get_connection(&app)?;

    validate_date(&conn, &start_date, "Start date")?;

    let today: String = conn
        .query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if start_date > today {
        return Err("Start date cannot be in the future".to_string());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        r#"
        INSERT INTO staff (
            name, phone_number, address, position,
            document_picture, start_date
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        "#,
        params![
            name,
            phone_number,
            address.as_deref().map(str::trim),
            position,
            document_picture,
            start_date.trim()
        ],
    )
    .map_err(|e| format!("Failed to add staff: {}", e))?;

    let staff_id = tx.last_insert_rowid();

    tx.execute(
        r#"
        INSERT INTO staff_salary_history (
            staff_id, monthly_salary, effective_from
        )
        VALUES (?1, ?2, ?3)
        "#,
        params![staff_id, salary, start_date.trim()],
    )
    .map_err(|e| format!("Failed to create initial salary: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(staff_id)
}

// ============================================================
// UPDATE STAFF DETAILS
// Salary is intentionally excluded.
// Use change_staff_salary for salary changes.
// ============================================================

#[tauri::command]
pub fn update_staff(
    app: AppHandle,
    staff_id: i64,
    name: String,
    phone_number: String,
    address: Option<String>,
    position: String,
    document_picture: Option<String>,
    start_date: String,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<(), String> {
    crate::session::require_session(&state)?;
    validate_id(staff_id, "staff")?;

    if name.trim().is_empty() || phone_number.trim().is_empty() || position.trim().is_empty() {
        return Err("Name, phone number and position are required".to_string());
    }

    let conn = get_connection(&app)?;

    validate_date(&conn, &start_date, "Start date")?;

    let staff = get_staff_record(&conn, staff_id)?;

    if start_date != staff.start_date {
        return Err(
            "Changing the employment start date requires a separate salary-history correction."
                .to_string(),
        );
    }

    conn.execute(
        r#"
        UPDATE staff
        SET name = ?1,
            phone_number = ?2,
            address = ?3,
            position = ?4,
            document_picture = ?5
        WHERE staff_id = ?6
        "#,
        params![
            name.trim(),
            phone_number.trim(),
            address.as_deref().map(str::trim),
            position.trim(),
            document_picture,
            staff_id
        ],
    )
    .map_err(|e| format!("Failed to update staff: {}", e))?;

    Ok(())
}

// ============================================================
// GET ALL STAFF
// ============================================================

#[tauri::command]
pub fn get_all_staff(
    app: AppHandle,
    include_former_staff: Option<bool>,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<Vec<Staff>, String> {
    crate::session::require_session(&state)?;

    let conn = get_connection(&app)?;
    let include_former = include_former_staff.unwrap_or(true);

    let sql = if include_former {
        "SELECT staff_id FROM staff
         ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END,
         name COLLATE NOCASE"
    } else {
        "SELECT staff_id FROM staff
         WHERE end_date IS NULL
         ORDER BY name COLLATE NOCASE"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let ids = stmt
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for id in ids {
        result.push(get_staff_record(&conn, id.map_err(|e| e.to_string())?)?);
    }

    Ok(result)
}

#[tauri::command]
pub fn get_staff(
    app: AppHandle,
    staff_id: i64,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<Staff, String> {
    crate::session::require_session(&state)?;
    validate_id(staff_id, "staff")?;

    let conn = get_connection(&app)?;
    get_staff_record(&conn, staff_id)
}

// ============================================================
// CHANGE STAFF SALARY
//
// Only permits a new salary effective after the latest salary
// record. Previous salary periods are preserved.
// ============================================================

#[tauri::command]
pub fn change_staff_salary(
    app: AppHandle,
    staff_id: i64,
    monthly_salary: f64,
    effective_from: String,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<i64, String> {
    crate::session::require_session(&state)?;

    validate_id(staff_id, "staff")?;
    validate_amount(monthly_salary, "Monthly salary", false)?;

    let mut conn = get_connection(&app)?;

    validate_date(&conn, &effective_from, "Effective date")?;

    let staff = get_staff_record(&conn, staff_id)?;

    if effective_from <= staff.start_date {
        return Err("New salary effective date must be after the staff start date".to_string());
    }

    if let Some(end_date) = &staff.end_date {
        if effective_from > *end_date {
            return Err("Salary effective date cannot be after employment ends".to_string());
        }
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let latest: Option<String> = tx
        .query_row(
            r#"
            SELECT effective_from
            FROM staff_salary_history
            WHERE staff_id = ?1
            ORDER BY effective_from DESC
            LIMIT 1
            "#,
            params![staff_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(latest_date) = latest {
        if effective_from <= latest_date {
            return Err(
                "Salary changes must have an effective date after the latest salary record"
                    .to_string(),
            );
        }
    }

    tx.execute(
        r#"
        UPDATE staff_salary_history
        SET effective_to = ?1
        WHERE staff_id = ?2
          AND effective_to IS NULL
        "#,
        params![effective_from.trim(), staff_id],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        r#"
        INSERT INTO staff_salary_history (
            staff_id, monthly_salary, effective_from
        )
        VALUES (?1, ?2, ?3)
        "#,
        params![staff_id, monthly_salary, effective_from.trim()],
    )
    .map_err(|e| format!("Failed to record salary change: {}", e))?;

    let salary_id = tx.last_insert_rowid();

    tx.commit().map_err(|e| e.to_string())?;

    Ok(salary_id)
}

// ============================================================
// GET SALARY HISTORY
// ============================================================

#[tauri::command]
pub fn get_staff_salary_history(
    app: AppHandle,
    staff_id: i64,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<Vec<StaffSalaryHistory>, String> {
    crate::session::require_session(&state)?;
    validate_id(staff_id, "staff")?;

    let conn = get_connection(&app)?;
    get_salary_history_records(&conn, staff_id)
}

// ============================================================
// GET CURRENTLY APPLICABLE SALARY
// ============================================================

#[tauri::command]
pub fn get_current_staff_salary(
    app: AppHandle,
    staff_id: i64,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<f64, String> {
    crate::session::require_session(&state)?;
    validate_id(staff_id, "staff")?;

    let conn = get_connection(&app)?;

    let today: String = conn
        .query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    conn.query_row(
        r#"
        SELECT monthly_salary
        FROM staff_salary_history
        WHERE staff_id = ?1
          AND effective_from <= ?2
          AND (effective_to IS NULL OR ?2 < effective_to)
        ORDER BY effective_from DESC
        LIMIT 1
        "#,
        params![staff_id, today],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "No applicable salary record found".to_string())
}

// ============================================================
// END EMPLOYMENT
// End date is inclusive.
// ============================================================

#[tauri::command]
pub fn set_staff_end_date(
    app: AppHandle,
    staff_id: i64,
    end_date: Option<String>,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<(), String> {
    crate::session::require_session(&state)?;
    validate_id(staff_id, "staff")?;

    let conn = get_connection(&app)?;
    let staff = get_staff_record(&conn, staff_id)?;

    if let Some(ref date) = end_date {
        validate_date(&conn, date, "End date")?;

        if date < &staff.start_date {
            return Err("End date cannot be before start date".to_string());
        }
    }

    conn.execute(
        "UPDATE staff SET end_date = ?1 WHERE staff_id = ?2",
        params![end_date.as_deref(), staff_id],
    )
    .map_err(|e| format!("Failed to update employment end date: {}", e))?;

    Ok(())
}
// ============================================================
// ADD STAFF ABSENCE
//
// absence_type:
// "full_day" = one full daily rate deduction
// "half_day" = half daily rate deduction
//
// Omitting absence_type defaults to full_day.
// ============================================================

#[tauri::command]
pub fn add_staff_absence(
    app: AppHandle,
    staff_id: i64,
    absent_date: String,
    absence_type: Option<String>,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<i64, String> {
    crate::session::require_session(&state)?;
    validate_id(staff_id, "staff")?;

    let absence_type = validate_absence_type(absence_type)?;
    let conn = get_connection(&app)?;

    let staff = get_staff_record(&conn, staff_id)?;

    validate_date(&conn, &absent_date, "Absence date")?;

    if absent_date < staff.start_date {
        return Err("Absence date cannot be before start date".to_string());
    }

    if let Some(end_date) = staff.end_date {
        if absent_date > end_date {
            return Err("Absence date cannot be after employment ends".to_string());
        }
    }

    conn.execute(
        r#"
        INSERT INTO staff_absences (
            staff_id, absent_date, absence_type
        )
        VALUES (?1, ?2, ?3)
        "#,
        params![staff_id, absent_date.trim(), absence_type],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "Attendance is already recorded for this date".to_string()
        } else {
            format!("Failed to add absence: {}", e)
        }
    })?;

    Ok(conn.last_insert_rowid())
}

// ============================================================
// UPDATE ABSENCE DATE AND TYPE
// ============================================================

#[tauri::command]
pub fn update_staff_absence(
    app: AppHandle,
    absence_id: i64,
    absent_date: String,
    absence_type: Option<String>,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<(), String> {
    crate::session::require_session(&state)?;
    validate_id(absence_id, "absence")?;

    let absence_type = validate_absence_type(absence_type)?;
    let conn = get_connection(&app)?;

    validate_date(&conn, &absent_date, "Absence date")?;

    let staff_id: Option<i64> = conn
        .query_row(
            "SELECT staff_id FROM staff_absences WHERE absence_id = ?1",
            params![absence_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let staff_id = staff_id.ok_or("Absence does not exist")?;
    let staff = get_staff_record(&conn, staff_id)?;

    if absent_date < staff.start_date {
        return Err("Absence date cannot be before start date".to_string());
    }

    if let Some(end_date) = staff.end_date {
        if absent_date > end_date {
            return Err("Absence date cannot be after employment ends".to_string());
        }
    }

    conn.execute(
        r#"
        UPDATE staff_absences
        SET absent_date = ?1,
            absence_type = ?2
        WHERE absence_id = ?3
        "#,
        params![absent_date.trim(), absence_type, absence_id],
    )
    .map_err(|e| format!("Failed to update absence: {}", e))?;

    Ok(())
}

// ============================================================
// DELETE ABSENCE
// ============================================================

#[tauri::command]
pub fn delete_staff_absence(
    app: AppHandle,
    absence_id: i64,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<(), String> {
    crate::session::require_session(&state)?;
    validate_id(absence_id, "absence")?;

    let conn = get_connection(&app)?;

    let changed = conn
        .execute(
            "DELETE FROM staff_absences WHERE absence_id = ?1",
            params![absence_id],
        )
        .map_err(|e| e.to_string())?;

    if changed == 0 {
        return Err("Absence does not exist".to_string());
    }

    Ok(())
}

// ============================================================
// SALARY PAYMENTS
// ============================================================

#[tauri::command]
pub fn add_staff_salary_payment(
    app: AppHandle,
    staff_id: i64,
    paid_amount: f64,
    bonus: f64,
    pay_date: String,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<i64, String> {
    crate::session::require_session(&state)?;
    validate_id(staff_id, "staff")?;
    validate_amount(paid_amount, "Paid amount", true)?;
    validate_amount(bonus, "Bonus", true)?;

    if paid_amount == 0.0 && bonus == 0.0 {
        return Err("Enter a payment or bonus".to_string());
    }

    let conn = get_connection(&app)?;
    let staff = get_staff_record(&conn, staff_id)?;

    validate_date(&conn, &pay_date, "Payment date")?;

    if pay_date < staff.start_date {
        return Err("Payment date cannot be before start date".to_string());
    }

    if let Some(end_date) = staff.end_date {
        if pay_date > end_date {
            return Err("Payment date cannot be after employment ends".to_string());
        }
    }

    conn.execute(
        r#"
        INSERT INTO staff_salary_payments (
            staff_id, paid_amount, bonus, pay_date
        )
        VALUES (?1, ?2, ?3, ?4)
        "#,
        params![staff_id, paid_amount, bonus, pay_date.trim()],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_staff_salary_payment(
    app: AppHandle,
    payment_id: i64,
    paid_amount: f64,
    bonus: f64,
    pay_date: String,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<(), String> {
    crate::session::require_session(&state)?;
    validate_id(payment_id, "payment")?;
    validate_amount(paid_amount, "Paid amount", true)?;
    validate_amount(bonus, "Bonus", true)?;

    if paid_amount == 0.0 && bonus == 0.0 {
        return Err("Enter a payment or bonus".to_string());
    }

    let conn = get_connection(&app)?;

    validate_date(&conn, &pay_date, "Payment date")?;

    let staff_id: Option<i64> = conn
        .query_row(
            "SELECT staff_id FROM staff_salary_payments WHERE payment_id = ?1",
            params![payment_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let staff_id = staff_id.ok_or("Payment does not exist")?;
    let staff = get_staff_record(&conn, staff_id)?;

    if pay_date < staff.start_date {
        return Err("Payment date cannot be before start date".to_string());
    }

    if let Some(end_date) = staff.end_date {
        if pay_date > end_date {
            return Err("Payment date cannot be after employment ends".to_string());
        }
    }

    conn.execute(
        r#"
        UPDATE staff_salary_payments
        SET paid_amount = ?1,
            bonus = ?2,
            pay_date = ?3
        WHERE payment_id = ?4
        "#,
        params![paid_amount, bonus, pay_date.trim(), payment_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}


// ============================================================
// EDIT EXISTING STAFF SALARY HISTORY
// Updates an existing salary record and rebuilds salary periods.
// ============================================================

#[tauri::command]
pub fn update_staff_salary_history(
    app: AppHandle,
    salary_id: i64,
    monthly_salary: f64,
    effective_from: String,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<(), String> {
    crate::session::require_session(&state)?;

    validate_id(salary_id, "salary")?;
    validate_amount(monthly_salary, "Monthly salary", false)?;

    let mut conn = get_connection(&app)?;

    validate_date(&conn, &effective_from, "Effective date")?;

    let effective_from = effective_from.trim();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Find the existing salary record and its staff member.
    let record: Option<(i64, String)> = tx
        .query_row(
            r#"
            SELECT staff_id, effective_from
            FROM staff_salary_history
            WHERE salary_id = ?1
            "#,
            params![salary_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let (staff_id, old_effective_from) =
        record.ok_or("Salary history record does not exist")?;

    // Get employment start date.
    let start_date: String = tx
        .query_row(
            "SELECT start_date FROM staff WHERE staff_id = ?1",
            params![staff_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or("Staff record does not exist")?;

    if effective_from < start_date.as_str() {
        return Err(
            "Salary effective date cannot be before employment start date"
                .to_string(),
        );
    }

    // The first salary record must begin on the employment start date.
    let earliest_date: String = tx
        .query_row(
            r#"
            SELECT MIN(effective_from)
            FROM staff_salary_history
            WHERE staff_id = ?1
            "#,
            params![staff_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if old_effective_from == earliest_date
        && effective_from != start_date
    {
        return Err(
            "The initial salary effective date must match the employment start date"
                .to_string(),
        );
    }

    // Do not allow duplicate effective dates.
    let duplicate: bool = tx
        .query_row(
            r#"
            SELECT EXISTS(
                SELECT 1
                FROM staff_salary_history
                WHERE staff_id = ?1
                  AND salary_id != ?2
                  AND effective_from = ?3
            )
            "#,
            params![staff_id, salary_id, effective_from],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if duplicate {
        return Err(
            "Another salary record already exists with this effective date"
                .to_string(),
        );
    }

    // Update the existing salary record.
    tx.execute(
        r#"
        UPDATE staff_salary_history
        SET monthly_salary = ?1,
            effective_from = ?2
        WHERE salary_id = ?3
        "#,
        params![monthly_salary, effective_from, salary_id],
    )
    .map_err(|e| format!("Failed to update salary history: {}", e))?;

    // Rebuild effective_to for every salary record belonging
    // to this staff member.
    //
    // Each salary remains applicable until the next salary
    // becomes effective. The final record has effective_to = NULL.
    tx.execute(
        r#"
        UPDATE staff_salary_history AS current
        SET effective_to = (
            SELECT MIN(next.effective_from)
            FROM staff_salary_history AS next
            WHERE next.staff_id = current.staff_id
              AND next.effective_from > current.effective_from
        )
        WHERE current.staff_id = ?1
        "#,
        params![staff_id],
    )
    .map_err(|e| format!("Failed to rebuild salary periods: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}


#[tauri::command]
pub fn delete_staff_salary_payment(
    app: AppHandle,
    payment_id: i64,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<(), String> {
    crate::session::require_session(&state)?;
    validate_id(payment_id, "payment")?;

    let conn = get_connection(&app)?;

    let changed = conn
        .execute(
            "DELETE FROM staff_salary_payments WHERE payment_id = ?1",
            params![payment_id],
        )
        .map_err(|e| e.to_string())?;

    if changed == 0 {
        return Err("Salary payment does not exist".to_string());
    }

    Ok(())
}

// ============================================================
// CALCULATE SALARY SUMMARY
//
// Every calendar day uses the salary history applicable to it.
// Daily rate = monthly salary / days in that calendar month.
//
// Full day absence = 100% deduction.
// Half day absence = 50% deduction.
// Employment start/end dates are inclusive.
// ============================================================

fn calculate_salary_summary(
    conn: &Connection,
    staff_id: i64,
) -> Result<StaffSalarySummary, String> {
    let staff = get_staff_record(conn, staff_id)?;

    let calculated_through: String = conn
        .query_row(
            r#"
            SELECT CASE
                WHEN ?1 IS NOT NULL THEN ?1
                ELSE date('now', 'localtime')
            END
            "#,
            params![staff.end_date.as_deref()],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let (gross_salary, absence_deduction, full_day_absences, half_day_absences, absent_days): (
        f64,
        f64,
        i64,
        i64,
        f64,
    ) = conn
        .query_row(
            r#"
            WITH RECURSIVE calendar(day) AS (
                SELECT date(?1)
                WHERE date(?1) <= date(?2)

                UNION ALL

                SELECT date(day, '+1 day')
                FROM calendar
                WHERE day < date(?2)
            ),

            daily_values AS (
                SELECT
                    c.day,

                    COALESCE((
                        SELECT h.monthly_salary
                        FROM staff_salary_history h
                        WHERE h.staff_id = ?3
                          AND h.effective_from <= c.day
                          AND (
                              h.effective_to IS NULL
                              OR c.day < h.effective_to
                          )
                        ORDER BY h.effective_from DESC
                        LIMIT 1
                    ), 0) AS monthly_salary,

                    COALESCE((
                        SELECT a.absence_type
                        FROM staff_absences a
                        WHERE a.staff_id = ?3
                          AND a.absent_date = c.day
                        LIMIT 1
                    ), 'none') AS absence_type,

                    CAST(
                        strftime(
                            '%d',
                            date(c.day, 'start of month', '+1 month', '-1 day')
                        ) AS REAL
                    ) AS days_in_month

                FROM calendar c
            ),

            calculated AS (
                SELECT
                    monthly_salary / days_in_month AS daily_rate,
                    absence_type
                FROM daily_values
            )

            SELECT
                COALESCE(SUM(daily_rate), 0),

                COALESCE(SUM(
                    CASE
                        WHEN absence_type = 'full_day'
                            THEN daily_rate
                        WHEN absence_type = 'half_day'
                            THEN daily_rate * 0.5
                        ELSE 0
                    END
                ), 0),

                COALESCE(SUM(
                    CASE WHEN absence_type = 'full_day'
                    THEN 1 ELSE 0 END
                ), 0),

                COALESCE(SUM(
                    CASE WHEN absence_type = 'half_day'
                    THEN 1 ELSE 0 END
                ), 0),

                COALESCE(SUM(
                    CASE
                        WHEN absence_type = 'full_day' THEN 1.0
                        WHEN absence_type = 'half_day' THEN 0.5
                        ELSE 0.0
                    END
                ), 0)

            FROM calculated
            "#,
            params![staff.start_date, calculated_through, staff_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .map_err(|e| format!("Failed to calculate salary: {}", e))?;

    // Do not silently calculate an incomplete salary period.
    let uncovered_days: i64 = conn
        .query_row(
            r#"
            WITH RECURSIVE calendar(day) AS (
                SELECT date(?1)
                WHERE date(?1) <= date(?2)

                UNION ALL

                SELECT date(day, '+1 day')
                FROM calendar
                WHERE day < date(?2)
            )
            SELECT COUNT(*)
            FROM calendar c
            WHERE NOT EXISTS (
                SELECT 1
                FROM staff_salary_history h
                WHERE h.staff_id = ?3
                  AND h.effective_from <= c.day
                  AND (
                      h.effective_to IS NULL
                      OR c.day < h.effective_to
                  )
            )
            "#,
            params![staff.start_date, calculated_through, staff_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if uncovered_days > 0 {
        return Err(format!(
            "{} employment day(s) have no salary history. Please correct the salary records.",
            uncovered_days
        ));
    }

    let total_paid: f64 = conn
        .query_row(
            r#"
        SELECT COALESCE(SUM(paid_amount), 0)
        FROM staff_salary_payments
        WHERE staff_id = ?1 AND pay_date <= ?2
        "#,
            params![staff_id, calculated_through],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_bonus: f64 = conn
        .query_row(
            r#"
        SELECT COALESCE(SUM(bonus), 0)
        FROM staff_salary_payments
        WHERE staff_id = ?1 AND pay_date <= ?2
        "#,
            params![staff_id, calculated_through],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let earned_salary = (gross_salary - absence_deduction).max(0.0);

    // Bonuses are additional compensation.
    let salary_balance = earned_salary + total_bonus - total_paid;

    let monthly_salary: f64 = conn
        .query_row(
            r#"
            SELECT monthly_salary
            FROM staff_salary_history
            WHERE staff_id = ?1
              AND effective_from <= ?2
              AND (effective_to IS NULL OR ?2 < effective_to)
            ORDER BY effective_from DESC
            LIMIT 1
            "#,
            params![staff_id, calculated_through],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(0.0);

    Ok(StaffSalarySummary {
        staff_id,
        staff_name: staff.name,
        monthly_salary,
        start_date: staff.start_date,
        end_date: staff.end_date,
        calculated_through,

        full_day_absences,
        half_day_absences,
        absent_days,

        gross_salary,
        absence_deduction,
        earned_salary,

        total_paid,
        total_bonus,
        salary_balance,
    })
}

// ============================================================
// GET SALARY SUMMARY
// ============================================================

#[tauri::command]
pub fn get_staff_salary_summary(
    app: AppHandle,
    staff_id: i64,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<StaffSalarySummary, String> {
    crate::session::require_session(&state)?;
    validate_id(staff_id, "staff")?;

    let conn = get_connection(&app)?;

    calculate_salary_summary(&conn, staff_id)
}

// ============================================================
// GET COMPLETE STAFF DETAILS
// ============================================================

#[tauri::command]
pub fn get_staff_details(
    app: AppHandle,
    staff_id: i64,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<StaffDetails, String> {
    crate::session::require_session(&state)?;
    validate_id(staff_id, "staff")?;

    let conn = get_connection(&app)?;

    let staff = get_staff_record(&conn, staff_id)?;

    let salary_history = get_salary_history_records(&conn, staff_id)?;

    let absences = {
        let mut stmt = conn
            .prepare(
                r#"
            SELECT
                absence_id,
                staff_id,
                absent_date,
                absence_type,
                created_at
            FROM staff_absences
            WHERE staff_id = ?1
            ORDER BY absent_date DESC, absence_id DESC
            "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![staff_id], |row| {
                Ok(StaffAbsence {
                    absence_id: row.get(0)?,
                    staff_id: row.get(1)?,
                    absent_date: row.get(2)?,
                    absence_type: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();

        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }

        result
    };

    let payments = {
        let mut stmt = conn
            .prepare(
                r#"
            SELECT
                payment_id,
                staff_id,
                paid_amount,
                bonus,
                pay_date,
                created_at
            FROM staff_salary_payments
            WHERE staff_id = ?1
            ORDER BY pay_date DESC, payment_id DESC
            "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![staff_id], |row| {
                Ok(StaffSalaryPayment {
                    payment_id: row.get(0)?,
                    staff_id: row.get(1)?,
                    paid_amount: row.get(2)?,
                    bonus: row.get(3)?,
                    pay_date: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();

        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }

        result
    };

    let salary_summary = calculate_salary_summary(&conn, staff_id)?;

    Ok(StaffDetails {
        staff,
        salary_history,
        absences,
        payments,
        salary_summary,
    })
}
