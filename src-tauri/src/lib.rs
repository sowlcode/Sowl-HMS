mod booking;
mod commands;
mod customer;
mod database;
mod food_services;
mod room_management;
mod session;



pub fn run() {
    tauri::Builder::default()
        .manage(session::SessionState::new())
        .setup(|app| {
            database::initialize_database(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::login,
            commands::auth::get_session,
            commands::auth::logout,
            commands::users::create_user,
            commands::users::list_users,
            commands::users::change_user_password,
            commands::users::delete_user,

            customer::add_customer,
            customer::update_customer,
            customer::delete_customer,
            customer::get_customer,
            customer::list_customers,
            customer::search_customers,
            
            room_management::add_room,
            room_management::delete_room,
            room_management::update_room,
            room_management::get_rooms,
            room_management::get_available_rooms,
            room_management::set_room_maintenance,
            room_management::remove_room_maintenance,

            booking::create_booking,
            booking::add_room_to_registration,
            booking::change_registration_room,
            booking::get_booking,
            booking::get_active_bookings,
            booking::get_registration_rooms,
            booking::get_registration_history,
            booking::checkout_room,
            booking::checkout_registration,

            food_services::add_food_service,
            food_services::add_food_service_stock,
            food_services::update_food_service,
            food_services::delete_food_service,
            food_services::get_food_services,

        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
