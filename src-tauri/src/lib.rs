mod commands;
mod database;
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
            commands::auth::logout
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}