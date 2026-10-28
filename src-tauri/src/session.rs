use std::sync::Mutex;
use tauri::State;

#[derive(Clone, Debug, serde::Serialize)]
pub struct Session {
    pub user_id: i64,
    pub username: String,
    pub role: String,
}

pub struct SessionState {
    pub session: Mutex<Option<Session>>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            session: Mutex::new(None),
        }
    }
}

/// Return the authenticated user for a command or reject the call.
pub fn require_session(state: &State<'_, SessionState>) -> Result<Session, String> {
    state
        .session
        .lock()
        .map_err(|_| "Failed to access session".to_string())?
        .clone()
        .ok_or_else(|| "Authentication required".to_string())
}

/// Return the authenticated administrator for an admin-only command.
pub fn require_admin(state: &State<'_, SessionState>) -> Result<Session, String> {
    let session = require_session(state)?;
    if session.role != "admin" {
        return Err("Administrator access required".to_string());
    }
    Ok(session)
}
