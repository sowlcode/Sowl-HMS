mod commands;
mod database;
mod session;
mod customer;

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

            
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
