use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::database::database_path;

#[derive(Debug, Serialize, Deserialize)]
pub struct Customer {
    pub customer_id: i64,
    pub name: String,
    pub address: Option<String>,
    pub phone_number: String,
    pub document_type: Option<String>,
    pub document_number: Option<String>,
    pub document_pic: Option<String>,
    pub nationality: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewCustomer {
    pub name: String,
    pub address: Option<String>,
    pub phone_number: String,
    pub document_type: Option<String>,
    pub document_number: Option<String>,
    pub document_pic: Option<String>,
    pub nationality: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCustomer {
    pub customer_id: i64,
    pub name: String,
    pub address: Option<String>,
    pub phone_number: String,
    pub document_type: Option<String>,
    pub document_number: Option<String>,
    pub document_pic: Option<String>,
    pub nationality: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CustomerPage {
    pub customers: Vec<Customer>,
    pub page: i64,
    pub limit: i64,
    pub total: i64,
    pub total_pages: i64,
}


// ============================================================
// ADD CUSTOMER
// ============================================================

#[tauri::command]
pub fn add_customer(
    app: AppHandle,
    customer: NewCustomer,
) -> Result<i64, String> {
    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    conn.execute(
        r#"
        INSERT INTO customers (
            name,
            address,
            phone_number,
            document_type,
            document_number,
            document_pic,
            nationality
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
        params![
            customer.name,
            customer.address,
            customer.phone_number,
            customer.document_type,
            customer.document_number,
            customer.document_pic,
            customer.nationality,
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "A customer with this phone number already exists.".to_string()
        } else {
            e.to_string()
        }
    })?;

    Ok(conn.last_insert_rowid())
}


// ============================================================
// UPDATE CUSTOMER
// ============================================================

#[tauri::command]
pub fn update_customer(
    app: AppHandle,
    customer: UpdateCustomer,
) -> Result<(), String> {
    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    let affected = conn
        .execute(
            r#"
            UPDATE customers
            SET
                name = ?,
                address = ?,
                phone_number = ?,
                document_type = ?,
                document_number = ?,
                document_pic = ?,
                nationality = ?
            WHERE customer_id = ?
            "#,
            params![
                customer.name,
                customer.address,
                customer.phone_number,
                customer.document_type,
                customer.document_number,
                customer.document_pic,
                customer.nationality,
                customer.customer_id,
            ],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                "A customer with this phone number already exists.".to_string()
            } else {
                e.to_string()
            }
        })?;

    if affected == 0 {
        return Err("Customer not found.".to_string());
    }

    Ok(())
}


// ============================================================
// DELETE CUSTOMER
// ============================================================

#[tauri::command]
pub fn delete_customer(
    app: AppHandle,
    customer_id: i64,
) -> Result<(), String> {
    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    let affected = conn
        .execute(
            "DELETE FROM customers WHERE customer_id = ?",
            params![customer_id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Customer not found.".to_string());
    }

    Ok(())
}


// ============================================================
// GET CUSTOMER
// ============================================================

#[tauri::command]
pub fn get_customer(
    app: AppHandle,
    customer_id: i64,
) -> Result<Customer, String> {
    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    conn.query_row(
        r#"
        SELECT
            customer_id,
            name,
            address,
            phone_number,
            document_type,
            document_number,
            document_pic,
            nationality,
            created_at
        FROM customers
        WHERE customer_id = ?
        "#,
        params![customer_id],
        |row| {
            Ok(Customer {
                customer_id: row.get(0)?,
                name: row.get(1)?,
                address: row.get(2)?,
                phone_number: row.get(3)?,
                document_type: row.get(4)?,
                document_number: row.get(5)?,
                document_pic: row.get(6)?,
                nationality: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| {
        if matches!(
            e,
            rusqlite::Error::QueryReturnedNoRows
        ) {
            "Customer not found.".to_string()
        } else {
            e.to_string()
        }
    })
}


// ============================================================
// LIST CUSTOMERS
// ============================================================

#[tauri::command]
pub fn list_customers(
    app: AppHandle,
    page: i64,
) -> Result<CustomerPage, String> {
    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    let limit: i64 = 100;

    let page = if page < 1 {
        1
    } else {
        page
    };

    let offset = (page - 1) * limit;

    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM customers",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_pages = if total == 0 {
        0
    } else {
        (total + limit - 1) / limit
    };

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                customer_id,
                name,
                address,
                phone_number,
                document_type,
                document_number,
                document_pic,
                nationality,
                created_at
            FROM customers
            ORDER BY customer_id DESC
            LIMIT ? OFFSET ?
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(
            params![limit, offset],
            |row| {
                Ok(Customer {
                    customer_id: row.get(0)?,
                    name: row.get(1)?,
                    address: row.get(2)?,
                    phone_number: row.get(3)?,
                    document_type: row.get(4)?,
                    document_number: row.get(5)?,
                    document_pic: row.get(6)?,
                    nationality: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let mut customers = Vec::new();

    for customer in rows {
        customers.push(
            customer.map_err(|e| e.to_string())?
        );
    }

    Ok(CustomerPage {
        customers,
        page,
        limit,
        total,
        total_pages,
    })
}


// ============================================================
// SEARCH CUSTOMERS
// ============================================================

#[tauri::command]
pub fn search_customers(
    app: AppHandle,
    search: String,
    page: i64,
) -> Result<CustomerPage, String> {
    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    let limit: i64 = 100;

    let page = if page < 1 {
        1
    } else {
        page
    };

    let offset = (page - 1) * limit;

    let search = search.trim().to_string();

    let pattern = format!("%{}%", search);

    // --------------------------------------------------------
    // Count matching customers
    // --------------------------------------------------------

    let total: i64 = conn
        .query_row(
            r#"
            SELECT COUNT(*)
            FROM customers
            WHERE
                name LIKE ?
                OR phone_number LIKE ?
                OR document_number LIKE ?
                OR nationality LIKE ?
            "#,
            params![
                pattern,
                pattern,
                pattern,
                pattern
            ],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_pages = if total == 0 {
        0
    } else {
        (total + limit - 1) / limit
    };

    // --------------------------------------------------------
    // Get matching customers
    // --------------------------------------------------------

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                customer_id,
                name,
                address,
                phone_number,
                document_type,
                document_number,
                document_pic,
                nationality,
                created_at
            FROM customers
            WHERE
                name LIKE ?
                OR phone_number LIKE ?
                OR document_number LIKE ?
                OR nationality LIKE ?
            ORDER BY customer_id DESC
            LIMIT ? OFFSET ?
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(
            params![
                pattern,
                pattern,
                pattern,
                pattern,
                limit,
                offset
            ],
            |row| {
                Ok(Customer {
                    customer_id: row.get(0)?,
                    name: row.get(1)?,
                    address: row.get(2)?,
                    phone_number: row.get(3)?,
                    document_type: row.get(4)?,
                    document_number: row.get(5)?,
                    document_pic: row.get(6)?,
                    nationality: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let mut customers = Vec::new();

    for customer in rows {
        customers.push(
            customer.map_err(|e| e.to_string())?
        );
    }

    Ok(CustomerPage {
        customers,
        page,
        limit,
        total,
        total_pages,
    })
}