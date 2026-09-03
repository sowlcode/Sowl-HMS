import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

function LoginPage({ setSession }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleLogin(e) {
        e.preventDefault();

        setError("");

        try {
            console.log("Attempting login...");

            const session = await invoke("login", {
                username,
                password,
            });

            console.log("Login successful:", session);

            setSession(session);

            console.log("Navigating to dashboard...");

            navigate("/dashboard");

        } catch (error) {
            console.error("Login failed:", error);
            setError(String(error));
        }
    }
    return (
        <div className="min-h-screen bg-white text-black flex items-center justify-center p-6">

            <div className="w-full max-w-5xl min-h-[600px] bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xl grid md:grid-cols-2">

                {/* =========================
                    LEFT BRANDING
                ========================== */}

                <div className="relative bg-black text-white p-12 flex items-center overflow-hidden">

                    {/* Decorative circles */}
                    <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full border border-white/10" />

                    <div className="absolute -bottom-40 -right-32 w-[420px] h-[420px] rounded-full border border-white/10" />

                    <div className="absolute top-1/2 right-[-120px] w-64 h-64 rounded-full border border-white/5" />

                    <div className="relative z-10">

                        {/* Logo */}
                        <div className="w-16 h-16 rounded-xl bg-white text-black flex items-center justify-center mb-8">
                            <span className="text-3xl font-bold">
                                S
                            </span>
                        </div>

                        <h1 className="text-4xl font-bold tracking-tight">
                            Sowl HMS
                        </h1>

                        <p className="mt-2 text-zinc-400 text-sm">
                            Hotel Management System
                        </p>

                        <div className="w-10 h-[2px] bg-white my-8" />

                        <p className="text-zinc-400 text-sm leading-7">
                            A simple and powerful system
                            <br />
                            for managing your hotel.
                        </p>

                    </div>
                </div>


                {/* =========================
                    LOGIN
                ========================== */}

                <div className="flex items-center justify-center p-10 md:p-14">

                    <div className="w-full max-w-sm">

                        {/* Header */}
                        <div className="mb-9">

                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 mb-3">
                                Sowl HMS
                            </p>

                            <h2 className="text-3xl font-bold tracking-tight">
                                Welcome back
                            </h2>

                            <p className="mt-2 text-sm text-zinc-500">
                                Sign in to continue to your dashboard.
                            </p>

                        </div>


                        {/* Form */}
                        <form
                            onSubmit={handleLogin}
                            className="space-y-5"
                        >

                            {/* Username */}
                            <div>

                                <label
                                    htmlFor="username"
                                    className="block text-sm font-medium text-zinc-700 mb-2"
                                >
                                    Username
                                </label>

                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(event) =>
                                        setUsername(event.target.value)
                                    }
                                    placeholder="Enter your username"
                                    autoComplete="username"
                                    disabled={loading}
                                    className="
                                        w-full
                                        h-12
                                        px-4
                                        rounded-lg
                                        border
                                        border-zinc-300
                                        bg-white
                                        text-black
                                        placeholder-zinc-400
                                        outline-none
                                        transition
                                        focus:border-black
                                        focus:ring-1
                                        focus:ring-black
                                        disabled:bg-zinc-100
                                    "
                                />

                            </div>


                            {/* Password */}
                            <div>

                                <div className="flex items-center justify-between mb-2">

                                    <label
                                        htmlFor="password"
                                        className="text-sm font-medium text-zinc-700"
                                    >
                                        Password
                                    </label>

                                    <button
                                        type="button"
                                        className="text-xs text-zinc-500 hover:text-black hover:underline"
                                        onClick={() =>
                                            alert(
                                                "Please contact your administrator to reset your password."
                                            )
                                        }
                                    >
                                        Forgot password?
                                    </button>

                                </div>

                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    disabled={loading}
                                    className="
                                        w-full
                                        h-12
                                        px-4
                                        rounded-lg
                                        border
                                        border-zinc-300
                                        bg-white
                                        text-black
                                        placeholder-zinc-400
                                        outline-none
                                        transition
                                        focus:border-black
                                        focus:ring-1
                                        focus:ring-black
                                        disabled:bg-zinc-100
                                    "
                                />

                            </div>


                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-100 border border-zinc-200 text-sm text-black">

                                    <span className="w-5 h-5 shrink-0 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                                        !
                                    </span>

                                    <span>
                                        {error}
                                    </span>

                                </div>
                            )}


                            {/* Login Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="
                                    w-full
                                    h-12
                                    mt-2
                                    rounded-lg
                                    bg-black
                                    text-white
                                    font-medium
                                    text-sm
                                    transition
                                    hover:bg-zinc-800
                                    active:scale-[0.99]
                                    disabled:bg-zinc-400
                                    disabled:cursor-not-allowed
                                    flex
                                    items-center
                                    justify-center
                                    gap-2
                                "
                            >

                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    "Sign in"
                                )}

                            </button>

                        </form>


                        {/* Footer */}
                        <div className="flex items-center justify-center gap-2 mt-10 text-xs text-zinc-400">

                            <span className="font-medium text-zinc-500">
                                Sowl HMS
                            </span>

                            <span>•</span>

                            <span>
                                Hotel Management System
                            </span>

                        </div>

                    </div>

                </div>

            </div>

        </div>
    );
}

export default LoginPage;