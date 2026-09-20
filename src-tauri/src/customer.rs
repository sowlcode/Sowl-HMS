use rusqlite::{params, Connection, OptionalExtension};
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
    pub is_deleted: bool,
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
// VALIDATE DOCUMENT FIELDS
// ============================================================

fn validate_document_fields(
    doc_type: &Option<String>,
    doc_number: &Option<String>,
) -> Result<(), String> {
    match (doc_type, doc_number) {
        (Some(t), Some(n)) => {
            if t.trim().is_empty() || n.trim().is_empty() {
                return Err("Document type and number cannot be empty if provided.".to_string());
            }
            Ok(())
        }
        (None, None) => Ok(()),
        (Some(_), None) => Err("Document number is required when document type is provided.".to_string()),
        (None, Some(_)) => Err("Document type is required when document number is provided.".to_string()),
    }
}

// ============================================================
// ADD CUSTOMER
// ============================================================

#[tauri::command]
pub fn add_customer(
    app: AppHandle,
    customer: NewCustomer,
) -> Result<i64, String> {
    // Validate document fields
    validate_document_fields(
        &customer.document_type,
        &customer.document_number,
    )?;

    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    // --------------------------------------------------------
    // 1. Check if an ACTIVE customer already has this phone
    // --------------------------------------------------------

    let active_exists: bool = conn
        .query_row(
            r#"
            SELECT EXISTS(
                SELECT 1
                FROM customers
                WHERE phone_number = ?1
                AND is_deleted = 0
            )
            "#,
            params![customer.phone_number],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if active_exists {
        return Err(
            "A customer with this phone number already exists.".to_string()
        );
    }

    // --------------------------------------------------------
    // 2. Check for duplicate document among ACTIVE customers
    // --------------------------------------------------------

    if let (Some(doc_type), Some(doc_number)) =
        (&customer.document_type, &customer.document_number)
    {
        let doc_exists: bool = conn
            .query_row(
                r#"
                SELECT EXISTS(
                    SELECT 1
                    FROM customers
                    WHERE document_type = ?1
                    AND document_number = ?2
                    AND is_deleted = 0
                )
                "#,
                params![doc_type, doc_number],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if doc_exists {
            return Err(
                "A customer with this document type and number already exists."
                    .to_string()
            );
        }
    }

    // --------------------------------------------------------
    // 3. Look for a SOFT-DELETED customer with the same phone
    // --------------------------------------------------------

    let deleted_customer_id: Option<i64> = conn
        .query_row(
            r#"
            SELECT customer_id
            FROM customers
            WHERE phone_number = ?1
            AND is_deleted = 1
            ORDER BY customer_id DESC
            LIMIT 1
            "#,
            params![customer.phone_number],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    // --------------------------------------------------------
    // 4. If deleted customer exists, REACTIVATE + UPDATE it
    // --------------------------------------------------------

    if let Some(customer_id) = deleted_customer_id {
        conn.execute(
            r#"
            UPDATE customers
            SET
                name = ?,
                address = ?,
                phone_number = ?,
                document_type = ?,
                document_number = ?,
                document_pic = ?,
                nationality = ?,
                is_deleted = 0
            WHERE customer_id = ?
            AND is_deleted = 1
            "#,
            params![
                customer.name,
                customer.address,
                customer.phone_number,
                customer.document_type,
                customer.document_number,
                customer.document_pic,
                customer.nationality,
                customer_id,
            ],
        )
        .map_err(|e| e.to_string())?;

        return Ok(customer_id);
    }

    // --------------------------------------------------------
    // 5. No old customer found -> CREATE NEW CUSTOMER
    // --------------------------------------------------------

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
    .map_err(|e| e.to_string())?;

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
    // Validate document fields
    validate_document_fields(&customer.document_type, &customer.document_number)?;

    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    // Check for duplicate phone number (excluding self and soft-deleted)
    let exists: bool = conn.query_row(
        r#"
        SELECT EXISTS(
            SELECT 1 
            FROM customers 
            WHERE phone_number = ?1 
            AND customer_id != ?2
            AND is_deleted = 0
        )
        "#,
        params![customer.phone_number, customer.customer_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    if exists {
        return Err("A customer with this phone number already exists.".to_string());
    }

    // Check for duplicate document (type + number) if both are provided
    if let (Some(doc_type), Some(doc_number)) = (&customer.document_type, &customer.document_number) {
        let doc_exists: bool = conn.query_row(
            r#"
            SELECT EXISTS(
                SELECT 1 
                FROM customers 
                WHERE document_type = ?1 
                AND document_number = ?2 
                AND customer_id != ?3
                AND is_deleted = 0
            )
            "#,
            params![doc_type, doc_number, customer.customer_id],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;

        if doc_exists {
            return Err("A customer with this document type and number already exists.".to_string());
        }
    }

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
            AND is_deleted = 0
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
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Customer not found.".to_string());
    }

    Ok(())
}


// ============================================================
// DELETE CUSTOMER (Soft Delete)
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
            "UPDATE customers SET is_deleted = 1 WHERE customer_id = ? AND is_deleted = 0",
            params![customer_id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Customer not found or already deleted.".to_string());
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
            created_at,
            is_deleted
        FROM customers
        WHERE customer_id = ?
        AND is_deleted = 0
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
                is_deleted: row.get(9)?,
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
            "SELECT COUNT(*) FROM customers WHERE is_deleted = 0",
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
                created_at,
                is_deleted
            FROM customers
            WHERE is_deleted = 0
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
                    is_deleted: row.get(9)?,
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
            WHERE is_deleted = 0
            AND (
                name LIKE ?
                OR phone_number LIKE ?
                OR document_number LIKE ?
                OR nationality LIKE ?
            )
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
                created_at,
                is_deleted
            FROM customers
            WHERE is_deleted = 0
            AND (
                name LIKE ?
                OR phone_number LIKE ?
                OR document_number LIKE ?
                OR nationality LIKE ?
            )
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
                    is_deleted: row.get(9)?,
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