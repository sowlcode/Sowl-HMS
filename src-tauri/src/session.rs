use std::sync::Mutex;

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