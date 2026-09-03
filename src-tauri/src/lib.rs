mod database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            database::initialize_database(&app.handle())
                .expect("Failed to initialize database");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            database::login
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sowl HMS");
}