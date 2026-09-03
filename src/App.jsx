import { useEffect, useState } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from "react-router-dom";

import { invoke } from "@tauri-apps/api/core";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";


function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkSession();
    }, []);

    async function checkSession() {
        try {
            const currentSession = await invoke("get_session");
            setSession(currentSession);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <BrowserRouter>
            <Routes>

                {/* Public route */}
                <Route
                    path="/login"
                    element={
                        <LoginPage setSession={setSession} />
                    }
                />

                {/* Protected routes */}
                <Route element={<ProtectedRoute session={session} />}>

                    <Route
                        path="/dashboard"
                        element={
                            <DashboardPage
                                session={session}
                                setSession={setSession}
                            />
                        }
                    />

                </Route>

                {/* Default route */}
                <Route
                    path="*"
                    element={
                        session
                            ? <Navigate to="/dashboard" replace />
                            : <Navigate to="/login" replace />
                    }
                />

            </Routes>
        </BrowserRouter>
    );
}

export default App;