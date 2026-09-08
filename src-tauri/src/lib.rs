mod booking;
mod commands;
mod customer;
mod database;
mod food_services;
mod room_management;
mod session;
mod bill_items;

pub fn run() {
    tauri::Builder::default()
        .manage(session::SessionState::new())
        .setup(|app| {
            database::initialize_database(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            commands::auth::login,
            commands::auth::get_session,
            commands::auth::logout,
            
            // User commands
            commands::users::create_user,
            commands::users::list_users,
            commands::users::change_user_password,
            commands::users::delete_user,

            // Customer commands
            customer::add_customer,
            customer::update_customer,
            customer::delete_customer,
            customer::get_customer,
            customer::list_customers,
            customer::search_customers,
            
            // Room commands
            room_management::add_room,
            room_management::delete_room,
            room_management::update_room,
            room_management::get_rooms,
            room_management::get_available_rooms,
            room_management::set_room_maintenance,
            room_management::remove_room_maintenance,

            // Booking commands
            booking::create_booking,
            booking::add_room_to_registration,
            booking::change_registration_room,
            booking::get_booking,
            booking::get_active_bookings,
            booking::get_registration_rooms,
            booking::get_registration_history,
            booking::checkout_room,
            booking::checkout_registration,

            // Food Services commands
            food_services::add_food_service,
            food_services::add_food_service_stock,
            food_services::update_food_service,
            food_services::delete_food_service,
            food_services::get_food_services,

            // Bill Items Functions - THESE ARE THE CRITICAL ONES
            bill_items::add_service_to_registration,
            bill_items::add_custom_bill_item,
            bill_items::return_service_quantity,
            bill_items::get_registration_bill,
            bill_items::delete_custom_bill_item,
            bill_items::update_custom_bill_item_quantity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}