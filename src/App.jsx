import "./App.css";

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    async function handleLogin(event) {
        event.preventDefault();
        setError("");

        try {
            const role = await invoke("login", {
                username,
                password,
            });

            alert(`Login successful. Role: ${role}`);
        } catch (error) {
            setError(String(error));
        }
    }

    return (
        <div>
            <h1>Sowl HMS</h1>

            <h2>Login</h2>

            <form onSubmit={handleLogin}>
                <div>
                    <label>Username</label>

                    <input
                        type="text"
                        value={username}
                        onChange={(event) =>
                            setUsername(event.target.value)
                        }
                    />
                </div>

                <div>
                    <label>Password</label>

                    <input
                        type="password"
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                    />
                </div>

                {error && (
                    <p style={{ color: "red" }}>
                        {error}
                    </p>
                )}

                <button type="submit">
                    Login
                </button>
            </form>
        </div>
    );
}

export default App;