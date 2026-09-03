import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

function DashboardPage({ session, setSession }) {
    const navigate = useNavigate();

    async function handleLogout() {
        try {
            await invoke("logout");

            // Clear frontend session
            setSession(null);


        } catch (error) {
            console.error("Logout failed:", error);
        }
    }

    return (
        <div>
            <h1>Dashboard</h1>

            <p>Welcome, {session?.username}!</p>

            <button onClick={handleLogout}>
                Logout
            </button>
        </div>
    );
}

export default DashboardPage;