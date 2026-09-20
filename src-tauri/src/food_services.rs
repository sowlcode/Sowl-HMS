use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::database::database_path;

// ============================================================
// FOOD / SERVICE MODEL
// ============================================================

#[derive(Debug, Serialize)]
pub struct FoodService {
    pub service_id: i64,
    pub service_name: String,
    pub category: String,
    pub service_charge: f64,
    pub stock: Option<i64>,
    pub picture: Option<String>,
    pub is_inventory: bool,
    pub is_deleted: bool,  // Added field
}

// ============================================================
// ADD ITEM REQUEST
// ============================================================

#[derive(Debug, Deserialize)]
pub struct AddFoodServiceRequest {
    pub service_name: String,
    pub category: String,
    pub service_charge: f64,
    pub stock: Option<i64>,
    pub picture: Option<String>,
    pub is_inventory: bool,
}

// ============================================================
// UPDATE ITEM REQUEST
// ============================================================

#[derive(Debug, Deserialize)]
pub struct UpdateFoodServiceRequest {
    pub service_id: i64,
    pub service_name: String,
    pub category: String,
    pub service_charge: f64,
    pub stock: Option<i64>,
    pub picture: Option<String>,
    pub is_inventory: bool,
}

// ============================================================
// ADD STOCK REQUEST
// ============================================================

#[derive(Debug, Deserialize)]
pub struct AddStockRequest {
    pub service_id: i64,
    pub quantity: i64,
}

// ============================================================
// ADD FOOD / SERVICE
// ============================================================

#[tauri::command]
pub fn add_food_service(
    app: AppHandle,
    request: AddFoodServiceRequest,
) -> Result<FoodService, String> {
    if request.service_name.trim().is_empty() {
        return Err("Service name is required".to_string());
    }

    if request.category.trim().is_empty() {
        return Err("Category is required".to_string());
    }

    if request.service_charge < 0.0 {
        return Err("Service charge cannot be negative".to_string());
    }

    // Validate stock based on is_inventory flag
    if request.is_inventory {
        // For inventory items, stock is required and must be non-negative
        match request.stock {
            Some(stock) if stock < 0 => {
                return Err("Stock cannot be negative for inventory items".to_string());
            }
            None => {
                return Err("Stock is required for inventory items".to_string());
            }
            _ => {}
        }
    } else {
        // For non-inventory items, stock should be None (NULL in database)
        if request.stock.is_some() {
            return Err("Non-inventory items cannot have stock".to_string());
        }
    }

    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    // Check for duplicate service name (excluding soft-deleted)
    let exists: bool = conn.query_row(
        r#"
        SELECT EXISTS(
            SELECT 1 
            FROM food_services 
            WHERE service_name = ?1 
            AND is_deleted = 0
        )
        "#,
        params![request.service_name.trim()],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    if exists {
        return Err("A service with this name already exists.".to_string());
    }

    conn.execute(
        r#"
        INSERT INTO food_services
        (
            service_name,
            category,
            service_charge,
            stock,
            picture,
            is_inventory
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        "#,
        params![
            request.service_name.trim(),
            request.category.trim(),
            request.service_charge,
            request.stock,
            request.picture,
            request.is_inventory
        ],
    )
    .map_err(|e| e.to_string())?;

    let service_id = conn.last_insert_rowid();

    get_food_service_by_id(&conn, service_id)
}

// ============================================================
// ADD STOCK
// ============================================================

#[tauri::command]
pub fn add_food_service_stock(
    app: AppHandle,
    request: AddStockRequest,
) -> Result<FoodService, String> {
    if request.quantity <= 0 {
        return Err("Stock quantity must be greater than 0".to_string());
    }

    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    // Check whether the service exists and get current stock and inventory flag
    let result: Option<(Option<i64>, bool, bool)> = conn
        .query_row(
            r#"
            SELECT stock, is_inventory, is_deleted
            FROM food_services
            WHERE service_id = ?1
            "#,
            params![request.service_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let (current_stock, is_inventory, is_deleted) = match result {
        Some((stock, inventory, deleted)) => (stock, inventory, deleted),
        None => {
            return Err("Food/service item not found".to_string());
        }
    };

    // Check if the item is deleted
    if is_deleted {
        return Err("Cannot add stock to a deleted item".to_string());
    }

    // Only allow stock addition for inventory items
    if !is_inventory {
        return Err(
            "Only inventory items can have stock added".to_string()
        );
    }

    // NULL stock means this service does not track quantity
    if current_stock.is_none() {
        return Err(
            "This service does not use stock tracking".to_string()
        );
    }

    conn.execute(
        r#"
        UPDATE food_services
        SET stock = stock + ?1
        WHERE service_id = ?2
        AND is_deleted = 0
        "#,
        params![
            request.quantity,
            request.service_id
        ],
    )
    .map_err(|e| e.to_string())?;

    get_food_service_by_id(&conn, request.service_id)
}

// ============================================================
// UPDATE FOOD / SERVICE
// ============================================================

#[tauri::command]
pub fn update_food_service(
    app: AppHandle,
    request: UpdateFoodServiceRequest,
) -> Result<FoodService, String> {
    if request.service_name.trim().is_empty() {
        return Err("Service name is required".to_string());
    }

    if request.category.trim().is_empty() {
        return Err("Category is required".to_string());
    }

    if request.service_charge < 0.0 {
        return Err("Service charge cannot be negative".to_string());
    }

    // Validate stock based on is_inventory flag
    if request.is_inventory {
        // For inventory items, stock is required and must be non-negative
        match request.stock {
            Some(stock) if stock < 0 => {
                return Err("Stock cannot be negative for inventory items".to_string());
            }
            None => {
                return Err("Stock is required for inventory items".to_string());
            }
            _ => {}
        }
    } else {
        // For non-inventory items, stock should be None (NULL in database)
        if request.stock.is_some() {
            return Err("Non-inventory items cannot have stock".to_string());
        }
    }

    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    // Check for duplicate service name (excluding self and soft-deleted)
    let exists: bool = conn.query_row(
        r#"
        SELECT EXISTS(
            SELECT 1 
            FROM food_services 
            WHERE service_name = ?1 
            AND service_id != ?2
            AND is_deleted = 0
        )
        "#,
        params![request.service_name.trim(), request.service_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    if exists {
        return Err("A service with this name already exists.".to_string());
    }

    let affected = conn
        .execute(
            r#"
            UPDATE food_services
            SET
                service_name = ?1,
                category = ?2,
                service_charge = ?3,
                stock = ?4,
                picture = ?5,
                is_inventory = ?6
            WHERE service_id = ?7
            AND is_deleted = 0
            "#,
            params![
                request.service_name.trim(),
                request.category.trim(),
                request.service_charge,
                request.stock,
                request.picture,
                request.is_inventory,
                request.service_id
            ],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Food/service item not found or has been deleted".to_string());
    }

    get_food_service_by_id(&conn, request.service_id)
}

// ============================================================
// DELETE FOOD / SERVICE (Soft Delete)
// ============================================================

#[tauri::command]
pub fn delete_food_service(
    app: AppHandle,
    service_id: i64,
) -> Result<String, String> {
    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    let affected = conn
        .execute(
            r#"
            UPDATE food_services
            SET is_deleted = 1
            WHERE service_id = ?1
            AND is_deleted = 0
            "#,
            params![service_id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Food/service item not found or already deleted".to_string());
    }

    Ok("Food/service item deleted successfully".to_string())
}

// ============================================================
// GET ALL FOOD / SERVICES (Active only)
// ============================================================

#[tauri::command]
pub fn get_food_services(
    app: AppHandle,
) -> Result<Vec<FoodService>, String> {
    let db_path = database_path(&app)
        .map_err(|e| e.to_string())?;

    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                service_id,
                service_name,
                category,
                service_charge,
                stock,
                picture,
                is_inventory,
                is_deleted
            FROM food_services
            WHERE is_deleted = 0
            ORDER BY service_name ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let services = stmt
        .query_map([], |row| {
            Ok(FoodService {
                service_id: row.get(0)?,
                service_name: row.get(1)?,
                category: row.get(2)?,
                service_charge: row.get(3)?,
                stock: row.get(4)?,
                picture: row.get(5)?,
                is_inventory: row.get(6)?,
                is_deleted: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(services)
}


// ============================================================
// GET SINGLE FOOD / SERVICE
// ============================================================

fn get_food_service_by_id(
    conn: &Connection,
    service_id: i64,
) -> Result<FoodService, String> {
    conn.query_row(
        r#"
        SELECT
            service_id,
            service_name,
            category,
            service_charge,
            stock,
            picture,
            is_inventory,
            is_deleted
        FROM food_services
        WHERE service_id = ?1
        AND is_deleted = 0
        "#,
        params![service_id],
        |row| {
            Ok(FoodService {
                service_id: row.get(0)?,
                service_name: row.get(1)?,
                category: row.get(2)?,
                service_charge: row.get(3)?,
                stock: row.get(4)?,
                picture: row.get(5)?,
                is_inventory: row.get(6)?,
                is_deleted: row.get(7)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}



use rusqlite::OptionalExtension;