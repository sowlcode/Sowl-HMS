import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

function LoginPage({ setSession }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // In LoginPage.js
    async function handleLogin(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            console.log("Attempting login...");
            const session = await invoke("login", { username, password });
            console.log("Login successful:", session);

            // Make sure we have all the data
            const sessionData = {
                user_id: session.user_id,
                username: session.username || username,
                role: session.role || 'staff',  // Important: get role from backend
                // Add any other fields from session
            };

            console.log("Setting session with role:", sessionData.role);
            setSession(sessionData);
            navigate("/dashboard");
        } catch (error) {
            console.error("Login failed:", error);
            setError(String(error));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/30 to-blue-100/40 flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-4xl min-h-[460px] md:min-h-[480px] bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl overflow-hidden shadow-2xl shadow-blue-200/40 grid md:grid-cols-5">

                <div className="relative md:col-span-2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-6 sm:p-8 lg:p-10 flex items-center overflow-hidden">
                    {/* Geometric decorations */}
                    <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-400/20 blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-gradient-to-tr from-indigo-500/10 to-blue-500/10 blur-2xl" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5" />

                    <div className="relative z-10 w-full">

                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                            Sowl HMS
                        </h1>
                        <p className="mt-1.5 text-blue-200/80 text-sm font-light tracking-wide">
                            Hotel Management System
                        </p>

                        <div className="w-10 h-0.5 bg-gradient-to-r from-blue-300 to-transparent my-5" />

                        <div className="space-y-2">
                            <p className="text-blue-100/90 text-sm leading-relaxed font-light">
                                Modern hotel management
                                <br />
                                designed for efficiency.
                            </p>
                            <div className="flex items-center gap-3 text-xs text-blue-200/60">
                                <span className="flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-blue-300/60" />
                                    Secure
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-blue-300/60" />
                                    Fast
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-blue-300/60" />
                                    Reliable
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-3 flex items-center justify-center p-6 sm:p-8">
                    <div className="w-full max-w-xs">

                        {/* Header */}
                        <div className="mb-6">
                            <p className="text-xs uppercase tracking-[0.3em] text-blue-600 font-semibold mb-1.5">
                                Welcome
                            </p>
                            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800">
                                Sign in
                            </h2>
                            <p className="mt-1.5 text-sm text-gray-500 font-light">
                                Enter your credentials to access the dashboard.
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleLogin} className="space-y-4">
                            {/* Username */}
                            <div>
                                <label
                                    htmlFor="username"
                                    className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5"
                                >
                                    Username
                                </label>
                                <div className="relative">
                                    <input
                                        id="username"
                                        type="text"
                                        value={username}
                                        onChange={(event) => setUsername(event.target.value)}
                                        placeholder="Enter your username"
                                        autoComplete="username"
                                        disabled={loading}
                                        className="
                                            w-full h-10 px-3 pr-8 rounded-lg
                                            border border-gray-200
                                            bg-gray-50/50
                                            text-gray-800
                                            placeholder-gray-400
                                            outline-none transition-all
                                            focus:border-blue-400
                                            focus:ring-2 focus:ring-blue-100
                                            focus:bg-white
                                            disabled:bg-gray-100
                                            text-sm
                                        "
                                    />
                                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5"
                                >
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        disabled={loading}
                                        className="
                                            w-full h-10 px-3 pr-8 rounded-lg
                                            border border-gray-200
                                            bg-gray-50/50
                                            text-gray-800
                                            placeholder-gray-400
                                            outline-none transition-all
                                            focus:border-blue-400
                                            focus:ring-2 focus:ring-blue-100
                                            focus:bg-white
                                            disabled:bg-gray-100
                                            text-sm
                                        "
                                    />
                                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50/80 border border-red-100 text-sm text-red-700">
                                    <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span className="font-light">{error}</span>
                                </div>
                            )}

                            {/* Login Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="
                                    w-full h-10 mt-3 rounded-lg
                                    bg-gradient-to-r from-blue-600 to-indigo-600
                                    text-white
                                    font-medium text-sm
                                    transition-all
                                    hover:from-blue-700 hover:to-indigo-700
                                    hover:shadow-lg hover:shadow-blue-500/30
                                    active:scale-[0.98]
                                    disabled:from-blue-400 disabled:to-indigo-400
                                    disabled:cursor-not-allowed
                                    disabled:hover:shadow-none
                                    flex items-center justify-center gap-2
                                "
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Signing in...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Sign in</span>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-3 bg-white/80 text-gray-400 font-light">
                                    Secure Access
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 text-xs text-gray-400">
                            <span className="font-medium text-blue-600">Sowl HMS</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="font-light">Hotel Management System</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                                <span className="font-light">Online</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;