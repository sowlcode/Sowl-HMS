
use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::database::database_path;

// ============================================================
// DASHBOARD RESPONSE STRUCTURES
// ============================================================

#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub period: String,
    pub overview: DashboardOverview,
    pub revenue_chart: Vec<ChartPoint>,
    pub collection_chart: Vec<ChartPoint>,
    pub booking_chart: Vec<ChartPoint>,
    pub revenue_breakdown: Vec<BreakdownItem>,
    pub payment_breakdown: Vec<BreakdownItem>,
    pub room_statistics: RoomStatistics,
    pub customer_statistics: CustomerStatistics,
    pub staff_statistics: StaffStatistics,
}

#[derive(Debug, Serialize)]
pub struct DashboardOverview {
    pub total_revenue: f64,
    pub total_collected: f64,
    pub outstanding_balance: f64,

    pub total_bookings: i64,
    pub active_bookings: i64,
    pub completed_bookings: i64,
    pub cancelled_bookings: i64,

    pub total_customers: i64,
    pub new_customers: i64,

    pub total_rooms: i64,
    pub occupied_rooms: i64,
    pub available_rooms: i64,

    pub occupancy_rate: f64,
}

#[derive(Debug, Serialize)]
pub struct ChartPoint {
    pub label: String,
    pub value: f64,
}

#[derive(Debug, Serialize)]
pub struct BreakdownItem {
    pub label: String,
    pub value: f64,
}

#[derive(Debug, Serialize)]
pub struct RoomStatistics {
    pub total_rooms: i64,
    pub available: i64,
    pub reserved: i64,
    pub booked: i64,
    pub maintenance: i64,
    pub occupancy_rate: f64,
}

#[derive(Debug, Serialize)]
pub struct CustomerStatistics {
    pub total_customers: i64,
    pub new_customers: i64,
    pub returning_customers: i64,
    pub total_registrations: i64,
    pub average_registrations_per_customer: f64,
}

#[derive(Debug, Serialize)]
pub struct StaffStatistics {
    pub total_staff: i64,
    pub monthly_salary_obligation: f64,
    pub salary_paid: f64,
    pub bonus_paid: f64,
    pub total_salary_expenditure: f64,
    pub total_absences: i64,
}

// ============================================================
// DATABASE CONNECTION
// ============================================================

fn get_connection(
    app: &AppHandle,
) -> Result<Connection, String> {
    let db_path: PathBuf =
        database_path(app).map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;

    Ok(conn)
}

// ============================================================
// PERIOD CONFIGURATION
// ============================================================

struct PeriodConfig {
    start_expr: &'static str,
    end_expr: &'static str,
    step: &'static str,
    monthly_grouping: bool,
}

fn get_period_config(period: &str) -> Result<PeriodConfig, String> {
    match period.to_lowercase().as_str() {

        // Last 7 days, daily points
        "weekly" => Ok(PeriodConfig {
            start_expr: "date('now','localtime','-6 days')",
            end_expr: "date('now','localtime')",
            step: "+1 day",
            monthly_grouping: false,
        }),

        // Last 30 days, daily points
        "monthly" => Ok(PeriodConfig {
            start_expr: "date('now','localtime','-29 days')",
            end_expr: "date('now','localtime')",
            step: "+1 day",
            monthly_grouping: false,
        }),

        // Current month + previous 2 months
        "3months" => Ok(PeriodConfig {
            start_expr:
                "date('now','localtime','start of month','-2 months')",
            end_expr:
                "date('now','localtime','start of month')",
            step: "+1 month",
            monthly_grouping: true,
        }),

        // Current month + previous 5 months
        "6months" => Ok(PeriodConfig {
            start_expr:
                "date('now','localtime','start of month','-5 months')",
            end_expr:
                "date('now','localtime','start of month')",
            step: "+1 month",
            monthly_grouping: true,
        }),

        // Current year, January through December
        "yearly" => Ok(PeriodConfig {
            start_expr:
                "date('now','localtime','start of year')",
            end_expr:
                "date('now','localtime','start of month')",
            step: "+1 month",
            monthly_grouping: true,
        }),

        _ => Err(
            "Invalid dashboard period. Use weekly, monthly, 3months, 6months or yearly."
                .to_string()
        ),
    }
}

// ============================================================
// HELPER: GET SINGLE INTEGER
// ============================================================

fn get_i64(
    conn: &Connection,
    sql: &str,
) -> Result<i64, String> {
    conn.query_row(sql, [], |row| row.get(0))
        .map_err(|e| e.to_string())
}

// ============================================================
// HELPER: GET SINGLE FLOAT
// ============================================================

fn get_f64(
    conn: &Connection,
    sql: &str,
) -> Result<f64, String> {
    conn.query_row(sql, [], |row| row.get(0))
        .map_err(|e| e.to_string())
}

// ============================================================
// HELPER: CHART DATA
//
// Generates all dates/months, including periods with zero
// activity, so frontend charts have continuous data.
// ============================================================

fn get_chart_series(
    conn: &Connection,
    config: &PeriodConfig,
    table: &str,
    date_column: &str,
    aggregate: &str,
    extra_filter: &str,
) -> Result<Vec<ChartPoint>, String> {

    let bucket_expression = if config.monthly_grouping {
        format!(
            "date(x.{}, 'start of month')",
            date_column
        )
    } else {
        format!("date(x.{})", date_column)
    };

    let sql = format!(
        "
        WITH RECURSIVE buckets(bucket) AS (

            SELECT {}

            UNION ALL

            SELECT date(bucket, '{}')
            FROM buckets
            WHERE bucket < {}

        ),

        aggregated AS (

            SELECT
                {} AS bucket,
                {} AS value

            FROM {} x

            WHERE date(x.{}) >= {}
              AND date(x.{}) <= date('now','localtime')
              {}

            GROUP BY bucket

        )

        SELECT
            buckets.bucket,
            COALESCE(aggregated.value, 0)

        FROM buckets

        LEFT JOIN aggregated
            ON aggregated.bucket = buckets.bucket

        ORDER BY buckets.bucket ASC
        ",
        config.start_expr,
        config.step,
        config.end_expr,
        bucket_expression,
        aggregate,
        table,
        date_column,
        config.start_expr,
        date_column,
        extra_filter,
    );

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {

        Ok(ChartPoint {
            label: row.get(0)?,
            value: row.get(1)?,
        })

    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }

    Ok(result)
}

// ============================================================
// HELPER: REVENUE BREAKDOWN
// ============================================================

fn get_revenue_breakdown(
    conn: &Connection,
    config: &PeriodConfig,
) -> Result<Vec<BreakdownItem>, String> {

    let sql = format!(
        "
        SELECT
            item_type,
            COALESCE(SUM(total), 0)

        FROM bill_items

        WHERE date(added_at) >= {}
          AND date(added_at) <= date('now','localtime')

        GROUP BY item_type

        ORDER BY SUM(total) DESC
        ",
        config.start_expr
    );

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {

        Ok(BreakdownItem {
            label: row.get(0)?,
            value: row.get(1)?,
        })

    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }

    Ok(result)
}

// ============================================================
// HELPER: PAYMENT METHOD BREAKDOWN
// ============================================================

fn get_payment_breakdown(
    conn: &Connection,
    config: &PeriodConfig,
) -> Result<Vec<BreakdownItem>, String> {

    let sql = format!(
        "
        SELECT
            payment_method,
            COALESCE(SUM(payment_amount), 0)

        FROM payments

        WHERE date(payment_datetime) >= {}
          AND date(payment_datetime) <= date('now','localtime')

        GROUP BY payment_method

        ORDER BY SUM(payment_amount) DESC
        ",
        config.start_expr
    );

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {

        Ok(BreakdownItem {
            label: row.get(0)?,
            value: row.get(1)?,
        })

    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }

    Ok(result)
}

// ============================================================
// HELPER: ROOM STATISTICS
// ============================================================

fn get_room_statistics(
    conn: &Connection,
) -> Result<RoomStatistics, String> {

    let mut stmt = conn.prepare(
        "
        SELECT
            COUNT(*),

            COALESCE(SUM(
                CASE WHEN status = 'available'
                THEN 1 ELSE 0 END
            ), 0),

            COALESCE(SUM(
                CASE WHEN status = 'reserved'
                THEN 1 ELSE 0 END
            ), 0),

            COALESCE(SUM(
                CASE WHEN status = 'booked'
                THEN 1 ELSE 0 END
            ), 0),

            COALESCE(SUM(
                CASE WHEN status = 'maintenance'
                THEN 1 ELSE 0 END
            ), 0)

        FROM rooms

        WHERE is_deleted = 0
        "
    ).map_err(|e| e.to_string())?;

    let (total, available, reserved, booked, maintenance):
        (i64, i64, i64, i64, i64) =
        stmt.query_row([], |row| {

            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))

        }).map_err(|e| e.to_string())?;

    // A room is occupied if it is assigned to an active
    // registration, even if its room status is inconsistent.

    let occupied = get_i64(
        conn,
        "
        SELECT COUNT(DISTINCT rr.room_id)

        FROM registration_rooms rr

        INNER JOIN registrations r
            ON r.registration_id = rr.registration_id

        INNER JOIN rooms rm
            ON rm.room_id = rr.room_id

        WHERE rr.status = 'active'
          AND rr.check_out IS NULL
          AND r.status = 'active'
          AND rm.is_deleted = 0
        "
    )?;

    let usable_rooms = total - maintenance;

    let occupancy_rate = if usable_rooms > 0 {
        (occupied as f64 / usable_rooms as f64) * 100.0
    } else {
        0.0
    };

    Ok(RoomStatistics {
        total_rooms: total,
        available,
        reserved,
        booked,
        maintenance,
        occupancy_rate,
    })
}

// ============================================================
// HELPER: CUSTOMER STATISTICS
// ============================================================

fn get_customer_statistics(
    conn: &Connection,
    config: &PeriodConfig,
) -> Result<CustomerStatistics, String> {

    let total_customers = get_i64(
        conn,
        "
        SELECT COUNT(*)
        FROM customers
        WHERE is_deleted = 0
        "
    )?;

    let new_customers = get_i64(
        conn,
        &format!(
            "
            SELECT COUNT(*)
            FROM customers

            WHERE is_deleted = 0
              AND date(created_at) >= {}
              AND date(created_at) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    let returning_customers = get_i64(
        conn,
        "
        SELECT COUNT(*)
        FROM (
            SELECT customer_id
            FROM registrations
            GROUP BY customer_id
            HAVING COUNT(*) > 1
        ) repeated
        INNER JOIN customers c
            ON c.customer_id = repeated.customer_id
        WHERE c.is_deleted = 0
        "
    )?;

    let total_registrations = get_i64(
        conn,
        &format!(
            "
            SELECT COUNT(*)
            FROM registrations

            WHERE date(booking_datetime) >= {}
              AND date(booking_datetime) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    let average_registrations = if total_customers > 0 {
        total_registrations as f64 / total_customers as f64
    } else {
        0.0
    };

    Ok(CustomerStatistics {
        total_customers,
        new_customers,
        returning_customers,
        total_registrations,
        average_registrations_per_customer: average_registrations,
    })
}

// ============================================================
// HELPER: STAFF STATISTICS
// ============================================================

fn get_staff_statistics(
    conn: &Connection,
    config: &PeriodConfig,
) -> Result<StaffStatistics, String> {

    let total_staff = get_i64(
        conn,
        "
        SELECT COUNT(*)
        FROM staff
        WHERE end_date IS NULL
           OR date(end_date) > date('now','localtime')
        "
    )?;

    // Current active salary obligations
    let monthly_salary_obligation = get_f64(
        conn,
        "
        SELECT COALESCE(SUM(monthly_salary), 0)

        FROM staff_salary_history

        WHERE date(effective_from) <= date('now','localtime')
          AND (
              effective_to IS NULL
              OR date(effective_to) > date('now','localtime')
          )
          AND staff_id IN (
              SELECT staff_id
              FROM staff
              WHERE end_date IS NULL
                 OR date(end_date) > date('now','localtime')
          )
        "
    )?;

    let salary_paid = get_f64(
        conn,
        &format!(
            "
            SELECT COALESCE(SUM(paid_amount), 0)

            FROM staff_salary_payments

            WHERE date(pay_date) >= {}
              AND date(pay_date) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    let bonus_paid = get_f64(
        conn,
        &format!(
            "
            SELECT COALESCE(SUM(bonus), 0)

            FROM staff_salary_payments

            WHERE date(pay_date) >= {}
              AND date(pay_date) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    let total_absences = get_i64(
        conn,
        &format!(
            "
            SELECT COUNT(*)

            FROM staff_absences

            WHERE date(absent_date) >= {}
              AND date(absent_date) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    Ok(StaffStatistics {
        total_staff,
        monthly_salary_obligation,
        salary_paid,
        bonus_paid,
        total_salary_expenditure: salary_paid + bonus_paid,
        total_absences,
    })
}

// ============================================================
// MAIN DASHBOARD COMMAND
// ============================================================

#[tauri::command]
pub fn get_dashboard_data(
    app: AppHandle,
    period: String,
    state: tauri::State<'_, crate::session::SessionState>,
) -> Result<DashboardData, String> {

    // Authentication
    crate::session::require_session(&state)?;

    // Validate period
    let config = get_period_config(&period)?;

    // Database connection
    let conn = get_connection(&app)?;

    // ========================================================
    // 1. REVENUE
    // ========================================================

    let total_revenue = get_f64(
        &conn,
        &format!(
            "
            SELECT COALESCE(SUM(total), 0)

            FROM bill_items

            WHERE date(added_at) >= {}
              AND date(added_at) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    // ========================================================
    // 2. TOTAL COLLECTIONS
    // ========================================================

    let total_collected = get_f64(
        &conn,
        &format!(
            "
            SELECT COALESCE(SUM(payment_amount), 0)

            FROM payments

            WHERE date(payment_datetime) >= {}
              AND date(payment_datetime) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    // ========================================================
    // 3. OUTSTANDING BALANCE
    //
    // Registration-level balance:
    // Total bill items - total payments
    //
    // Excludes cancelled registrations.
    // ========================================================

    let outstanding_balance = get_f64(
        &conn,
        "
        SELECT COALESCE(
            SUM(
                CASE
                    WHEN balance > 0 THEN balance
                    ELSE 0
                END
            ),
            0
        )

        FROM (
            SELECT
                r.registration_id,

                COALESCE((
                    SELECT SUM(b.total)
                    FROM bill_items b
                    WHERE b.registration_id = r.registration_id
                ), 0)

                -

                COALESCE((
                    SELECT SUM(p.payment_amount)
                    FROM payments p
                    WHERE p.registration_id = r.registration_id
                ), 0) AS balance

            FROM registrations r

            WHERE r.status != 'cancelled'
        )
        "
    )?;

    // ========================================================
    // 4. REGISTRATION STATISTICS
    // ========================================================

    let total_bookings = get_i64(
        &conn,
        &format!(
            "
            SELECT COUNT(*)

            FROM registrations

            WHERE date(booking_datetime) >= {}
              AND date(booking_datetime) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    let active_bookings = get_i64(
        &conn,
        "
        SELECT COUNT(*)
        FROM registrations
        WHERE status = 'active'
        "
    )?;

    let completed_bookings = get_i64(
        &conn,
        &format!(
            "
            SELECT COUNT(*)

            FROM registrations

            WHERE status = 'completed'
              AND date(booking_datetime) >= {}
              AND date(booking_datetime) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    let cancelled_bookings = get_i64(
        &conn,
        &format!(
            "
            SELECT COUNT(*)

            FROM registrations

            WHERE status = 'cancelled'
              AND date(booking_datetime) >= {}
              AND date(booking_datetime) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    // ========================================================
    // 5. CUSTOMER COUNTS
    // ========================================================

    let total_customers = get_i64(
        &conn,
        "
        SELECT COUNT(*)
        FROM customers
        WHERE is_deleted = 0
        "
    )?;

    let new_customers = get_i64(
        &conn,
        &format!(
            "
            SELECT COUNT(*)

            FROM customers

            WHERE is_deleted = 0
              AND date(created_at) >= {}
              AND date(created_at) <= date('now','localtime')
            ",
            config.start_expr
        )
    )?;

    // ========================================================
    // 6. ROOM STATISTICS
    // ========================================================

    let room_statistics = get_room_statistics(&conn)?;

    let occupied_rooms = get_i64(
        &conn,
        "
        SELECT COUNT(DISTINCT rr.room_id)

        FROM registration_rooms rr

        INNER JOIN registrations r
            ON r.registration_id = rr.registration_id

        INNER JOIN rooms rm
            ON rm.room_id = rr.room_id

        WHERE rr.status = 'active'
          AND rr.check_out IS NULL
          AND r.status = 'active'
          AND rm.is_deleted = 0
        "
    )?;

    let available_rooms = room_statistics.available;

    // ========================================================
    // 7. REVENUE CHART
    // ========================================================

    let revenue_chart = get_chart_series(
        &conn,
        &config,
        "bill_items",
        "added_at",
        "COALESCE(SUM(x.total), 0)",
        "",
    )?;

    // ========================================================
    // 8. COLLECTION CHART
    // ========================================================

    let collection_chart = get_chart_series(
        &conn,
        &config,
        "payments",
        "payment_datetime",
        "COALESCE(SUM(x.payment_amount), 0)",
        "",
    )?;

    // ========================================================
    // 9. BOOKING CHART
    // ========================================================

    let booking_chart = get_chart_series(
        &conn,
        &config,
        "registrations",
        "booking_datetime",
        "COUNT(*)",
        "",
    )?;

    // ========================================================
    // 10. REVENUE BREAKDOWN
    // ========================================================

    let revenue_breakdown =
        get_revenue_breakdown(&conn, &config)?;

    // ========================================================
    // 11. PAYMENT BREAKDOWN
    // ========================================================

    let payment_breakdown =
        get_payment_breakdown(&conn, &config)?;

    // ========================================================
    // 12. CUSTOMER ANALYTICS
    // ========================================================

    let customer_statistics =
        get_customer_statistics(&conn, &config)?;

    // ========================================================
    // 13. STAFF ANALYTICS
    // ========================================================

    let staff_statistics =
        get_staff_statistics(&conn, &config)?;

    // ========================================================
    // 14. OCCUPANCY RATE
    // ========================================================

    // ========================================================
    // 15. RETURN DASHBOARD DATA
    // ========================================================

    Ok(DashboardData {

        period: period.to_lowercase(),

        overview: DashboardOverview {

            total_revenue,
            total_collected,
            outstanding_balance,

            total_bookings,
            active_bookings,
            completed_bookings,
            cancelled_bookings,

            total_customers,
            new_customers,

            total_rooms: room_statistics.total_rooms,
            occupied_rooms,
            available_rooms,

            occupancy_rate: room_statistics.occupancy_rate,
        },

        revenue_chart,
        collection_chart,
        booking_chart,

        revenue_breakdown,
        payment_breakdown,

        room_statistics,
        customer_statistics,
        staff_statistics,
    })
}
