mod bill_items;
mod booking;
mod commands;
mod customer;
mod database;
mod food_services;
mod room_management;
mod session;
mod room_charges;

pub fn run() {
    tauri::Builder::default()
        .manage(session::SessionState::new())

        .setup(|app| {
            // ====================================================
            // 1. INITIALIZE / MIGRATE DATABASE
            // ====================================================

            database::initialize_database(app.handle())?;

            // ====================================================
            // 2. CATCH UP ROOM CHARGES
            // ====================================================
            //
            // Run shortly after startup so the database has already
            // been initialized.
            //
            // This catches up ALL active rooms.
            //
            // ====================================================

            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(
                    std::time::Duration::from_millis(500)
                )
                .await;

                if let Err(e) =
                    room_charges::catch_up_room_charges_from_app(&handle)
                {
                    eprintln!(
                        "Room charge catch-up failed: {}",
                        e
                    );
                }
            });

            Ok(())
        })

        // ========================================================
        // TAURI COMMANDS
        // ========================================================

        .invoke_handler(tauri::generate_handler![

            // ----------------------------------------------------
            // AUTH
            // ----------------------------------------------------

            commands::auth::login,
            commands::auth::get_session,
            commands::auth::logout,

            // ----------------------------------------------------
            // USERS
            // ----------------------------------------------------

            commands::users::create_user,
            commands::users::list_users,
            commands::users::change_user_password,
            commands::users::delete_user,

            // ----------------------------------------------------
            // CUSTOMERS
            // ----------------------------------------------------

            customer::add_customer,
            customer::update_customer,
            customer::delete_customer,
            customer::get_customer,
            customer::list_customers,
            customer::search_customers,

            // ----------------------------------------------------
            // ROOMS
            // ----------------------------------------------------

            room_management::add_room,
            room_management::delete_room,
            room_management::update_room,
            room_management::get_rooms,
            room_management::get_available_rooms,
            room_management::set_room_maintenance,
            room_management::remove_room_maintenance,

            // ----------------------------------------------------
            // BOOKINGS / REGISTRATIONS
            // ----------------------------------------------------

            booking::create_booking,
            booking::add_room_to_registration,
            booking::change_registration_room,
            booking::get_booking,
            booking::get_active_bookings,
            booking::get_registration_rooms,
            booking::get_registration_history,
            booking::checkout_room,
            booking::checkout_registration,

            // ----------------------------------------------------
            // FOOD & SERVICES
            // ----------------------------------------------------

            food_services::add_food_service,
            food_services::add_food_service_stock,
            food_services::update_food_service,
            food_services::delete_food_service,
            food_services::get_food_services,

            // ----------------------------------------------------
            // BILL ITEMS
            // ----------------------------------------------------

            bill_items::add_service_to_registration,
            bill_items::add_custom_bill_item,
            bill_items::return_service_quantity,
            bill_items::get_registration_bill,
            bill_items::delete_custom_bill_item,
            bill_items::update_custom_bill_item_quantity,

            // ----------------------------------------------------
            // ROOM CHARGES
            // ----------------------------------------------------
            //
            // Frontend can manually trigger synchronization.
            //
            room_charges::sync_room_charges,
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}