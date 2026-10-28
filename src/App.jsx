import { useEffect, useState, useCallback } from "react";
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
import Sidebar from "./components/Sidebar";
import RoomPage from "./pages/RoomPage";
import FoodAndServicesPage from "./pages/FoodAndServicesPage";
import StaffPage from "./pages/StaffPage";
import CustomerPage from "./pages/CustomerPage";
import RoomRegistrationPage from "./pages/RoomRegistrationPage";
import ManagerAccountPage from "./pages/ManagerAccountPage";
import RegistrationHistoryPage from "./pages/RegistrationHistoryPage";
import "./App.css";

function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check session on app load
    useEffect(() => {
        checkSession();
    }, []);

    // Debug logging for session changes
    useEffect(() => {
        console.log("Session updated:", session);
        console.log("Role from session:", session?.role);
        console.log("Is admin?", session?.role === "admin");
    }, [session]);

    async function checkSession() {
        try {
            console.log("Checking session...");
            const currentSession = await invoke("get_session");
            console.log("Session from backend:", currentSession);

            if (currentSession) {
                setSession(currentSession);
                console.log("Role set to:", currentSession.role);
            } else {
                console.log("No session found");
                setSession(null);
            }
        } catch (error) {
            console.error("Error checking session:", error);
            setSession(null);
        } finally {
            setLoading(false);
        }
    }

    const handleLogout = useCallback(async () => {
        try {
            console.log("Logging out...");
            await invoke("logout");
            setSession(null);
            console.log("Logout successful");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    }, []);

    // Show loading spinner while checking session
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Determine admin status and user info from session
    const isAdmin = session?.role === "admin";
    const username = session?.username || "User";
    const role = session?.role || "staff";

    // Default landing page based on role
    const defaultLanding = isAdmin ? "/dashboard" : "/room-registration";

    return (
        <BrowserRouter>
            <Routes>
                {/* Public route - Login */}
                <Route
                    path="/login"
                    element={
                        session ? (
                            <Navigate to={defaultLanding} replace />
                        ) : (
                            <LoginPage setSession={setSession} />
                        )
                    }
                />

                {/* Protected routes with Sidebar */}
                <Route element={<ProtectedRoute session={session} />}>
                    <Route
                        element={
                            <Sidebar
                                key={session?.user_id ?? "no-session"}
                                isAdmin={isAdmin}
                                username={username}
                                role={role}
                                onLogout={handleLogout}
                            />
                        }
                    >
                        {/* Admin-only routes */}
                        <Route
                            path="/dashboard"
                            element={
                                isAdmin ? (
                                    <DashboardPage session={session} />
                                ) : (
                                    <Navigate to="/room-registration" replace />
                                )
                            }
                        />
                        <Route
                            path="/rooms"
                            element={
                                isAdmin ? (
                                    <RoomPage session={session} />
                                ) : (
                                    <Navigate to="/room-registration" replace />
                                )
                            }
                        />
                        <Route
                            path="/staff"
                            element={
                                isAdmin ? (
                                    <StaffPage session={session} />
                                ) : (
                                    <Navigate to="/room-registration" replace />
                                )
                            }
                        />
                        <Route
                            path="/manager-account"
                            element={
                                isAdmin ? (
                                    <ManagerAccountPage session={session} />
                                ) : (
                                    <Navigate to="/room-registration" replace />
                                )
                            }
                        />

                        {/* Routes accessible to all authenticated users */}
                        <Route
                            path="/food-services"
                            element={<FoodAndServicesPage session={session} />}
                        />
                        <Route
                            path="/customers"
                            element={<CustomerPage session={session} />}
                        />
                        <Route
                            path="/room-registration"
                            element={<RoomRegistrationPage session={session} />}
                        />
                        <Route
                            path="/registration-history"
                            element={<RegistrationHistoryPage session={session} />}
                        />
                    </Route>
                </Route>

                {/* Default route - redirect based on session */}
                <Route
                    path="*"
                    element={
                        session ? (
                            <Navigate to={defaultLanding} replace />
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;