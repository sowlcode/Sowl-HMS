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
import Sidebar from "./components/Sidebar";
import RoomPage from "./pages/RoomPage";
import FoodAndServicesPage from "./pages/FoodAndServicesPage";
import StaffPage from "./pages/StaffPage";
import CustomerPage from "./pages/CustomerPage";
import RoomRegistrationPage from "./pages/RoomRegistrationPage";
import ManagerAccountPage from "./pages/ManagerAccountPage";
import "./App.css";

function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activePage, setActivePage] = useState("dashboard");

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

    async function handleLogout() {
        try {
            console.log("Logging out...");
            await invoke("logout");
            setSession(null);
            setActivePage("dashboard");
            console.log("Logout successful");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    }

    // Function to render content based on active page

    const renderContent = () => {
        const handleNavigate = (page) => {
            setActivePage(page);
        };

        switch (activePage) {
            case "dashboard":
                return <DashboardPage session={session} />;
            case "rooms":
                return <RoomPage session={session} />;
            case "food-services":
                return <FoodAndServicesPage session={session} />;
            case "staff":
                return <StaffPage session={session} />;
            case "customers":
                return <CustomerPage session={session} />;
            case "room-registration":
                return <RoomRegistrationPage
                    session={session}
                    onNavigate={handleNavigate}
                />;
            case "manager-account":
                return <ManagerAccountPage session={session} />;
            default:
                return <DashboardPage session={session} />;
        }
    };

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
    const username = session?.username || 'User';
    const role = session?.role || 'staff';

    return (
        <BrowserRouter>
            <Routes>
                {/* Public route - Login */}
                <Route
                    path="/login"
                    element={
                        session ? (
                            <Navigate to="/dashboard" replace />
                        ) : (
                            <LoginPage setSession={setSession} />
                        )
                    }
                />

                {/* Protected routes with Sidebar */}
                <Route element={<ProtectedRoute session={session} />}>
                    <Route
                        path="/dashboard/*"
                        element={
                            <Sidebar
                                key={session?.user_id || 'no-session'}
                                activePage={activePage}
                                setActivePage={setActivePage}
                                isAdmin={isAdmin}
                                username={username}
                                role={role}
                                onLogout={handleLogout}
                            >
                                {renderContent()}
                            </Sidebar>
                        }
                    />
                </Route>

                {/* Default route - redirect based on session */}
                <Route
                    path="*"
                    element={
                        session ? (
                            <Navigate to="/dashboard" replace />
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