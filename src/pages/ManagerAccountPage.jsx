import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    TrashIcon,
    PencilIcon,
    UserPlusIcon,
    XMarkIcon,
    CheckIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

function ManagerAccountPage({ session }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Create user modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [createLoading, setCreateLoading] = useState(false);

    // Edit password modal states
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [newUserPassword, setNewUserPassword] = useState("");
    const [editLoading, setEditLoading] = useState(false);

    // Delete confirmation states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingUser, setDeletingUser] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Load users on component mount
    useEffect(() => {
        loadUsers();
    }, []);

    // Clear messages after 5 seconds
    useEffect(() => {
        if (error || success) {
            const timer = setTimeout(() => {
                setError("");
                setSuccess("");
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, success]);

    async function loadUsers() {
        setLoading(true);
        setError("");
        try {
            console.log("Loading users...");
            const userList = await invoke("list_users");
            console.log("Users loaded:", userList);
            setUsers(userList);
        } catch (error) {
            console.error("Failed to load users:", error);
            setError("Failed to load users: " + String(error));
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateUser(e) {
        e.preventDefault();

        if (!newUsername.trim()) {
            setError("Username is required");
            return;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        setCreateLoading(true);
        setError("");
        setSuccess("");

        try {
            console.log("Creating user:", newUsername);
            await invoke("create_user", {
                username: newUsername.trim(),
                password: newPassword
            });

            setSuccess(`User "${newUsername}" created successfully!`);
            setNewUsername("");
            setNewPassword("");
            setShowCreateModal(false);
            await loadUsers();
        } catch (error) {
            console.error("Failed to create user:", error);
            setError("Failed to create user: " + String(error));
        } finally {
            setCreateLoading(false);
        }
    }

    async function handleEditPassword(e) {
        e.preventDefault();

        if (!editingUser) return;

        if (newUserPassword.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        setEditLoading(true);
        setError("");
        setSuccess("");

        try {
            console.log("Changing password for user:", editingUser.username);
            await invoke("change_user_password", {
                userId: editingUser.id,
                newPassword: newUserPassword
            });

            setSuccess(`Password for "${editingUser.username}" updated successfully!`);
            setNewUserPassword("");
            setShowEditModal(false);
            setEditingUser(null);
        } catch (error) {
            console.error("Failed to change password:", error);
            setError("Failed to change password: " + String(error));
        } finally {
            setEditLoading(false);
        }
    }

    async function handleDeleteUser() {
        if (!deletingUser) return;

        setDeleteLoading(true);
        setError("");
        setSuccess("");

        try {
            console.log("Deleting user:", deletingUser.username);
            await invoke("delete_user", {
                userId: deletingUser.id
            });

            setSuccess(`User "${deletingUser.username}" deleted successfully!`);
            setShowDeleteConfirm(false);
            setDeletingUser(null);
            await loadUsers();
        } catch (error) {
            console.error("Failed to delete user:", error);
            setError("Failed to delete user: " + String(error));
        } finally {
            setDeleteLoading(false);
        }
    }

    const openEditModal = (user) => {
        setEditingUser(user);
        setNewUserPassword("");
        setShowEditModal(true);
        setError("");
    };

    const openDeleteConfirm = (user) => {
        setDeletingUser(user);
        setShowDeleteConfirm(true);
        setError("");
    };

    // Format date if available
    function formatDate(dateString) {
        if (!dateString) return "-";
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    }

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading users...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Manager Account</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage hotel manager accounts and permissions
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                    <UserPlusIcon className="w-5 h-5" />
                    <span>Add Manager</span>
                </button>
            </div>

            {/* Messages */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                    <span className="font-medium">Error:</span>
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                    <span className="font-medium">Success:</span>
                    <span>{success}</span>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Username
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        No managers found. Add your first hotel manager!
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            #{user.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">
                                                {user.username}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`
                                                inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                ${user.role === 'admin'
                                                    ? 'bg-purple-100 text-purple-800'
                                                    : 'bg-green-100 text-green-800'
                                                }
                                            `}>
                                                {user.role === 'admin' ? 'Administrator' : 'Manager'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Change password"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openDeleteConfirm(user)}
                                                    className={`p-1.5 rounded-lg transition-colors
                                                        ${user.role === 'admin'
                                                            ? 'text-gray-300 cursor-not-allowed hover:bg-gray-50'
                                                            : 'text-red-600 hover:bg-red-50'
                                                        }
                                                    `}
                                                    title={user.role === 'admin' ? 'Admin account cannot be deleted' : 'Delete manager'}
                                                    disabled={user.role === 'admin'}
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    Add New Manager
                                </h2>
                                <p className="text-sm text-blue-100">
                                    Create a new manager account
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewUsername("");
                                    setNewPassword("");
                                    setError("");
                                }}
                                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Enter username"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                    disabled={createLoading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Minimum 8 characters"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                    minLength="8"
                                    disabled={createLoading}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Password must be at least 8 characters
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewUsername("");
                                        setNewPassword("");
                                        setError("");
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    disabled={createLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={createLoading}
                                >
                                    {createLoading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckIcon className="w-4 h-4" />
                                            <span>Add Manager</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Password Modal */}
            {showEditModal && editingUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    Change Password
                                </h2>
                                <p className="text-sm text-blue-100">
                                    For user: <span className="font-medium">{editingUser.username}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingUser(null);
                                    setNewUserPassword("");
                                    setError("");
                                }}
                                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleEditPassword} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    value={newUserPassword}
                                    onChange={(e) => setNewUserPassword(e.target.value)}
                                    placeholder="Minimum 8 characters"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                    minLength="8"
                                    disabled={editLoading}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Password must be at least 8 characters
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingUser(null);
                                        setNewUserPassword("");
                                        setError("");
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    disabled={editLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={editLoading}
                                >
                                    {editLoading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Updating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckIcon className="w-4 h-4" />
                                            <span>Update Password</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && deletingUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white/20 rounded-full">
                                    <TrashIcon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">
                                        Confirm Deletion
                                    </h2>
                                    <p className="text-sm text-red-100">
                                        This action cannot be undone
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <p className="text-gray-600 mb-2">
                                Are you sure you want to delete this manager?
                            </p>
                            <p className="font-semibold text-gray-800 text-lg mb-2">
                                "{deletingUser.username}"
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                                <ClockIcon className="w-4 h-4" />
                                <span>Created: {formatDate(deletingUser.created_at)}</span>
                            </div>
                            <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                                ⚠️ This action cannot be undone. All data associated with this manager will be permanently removed.
                            </p>

                            <div className="flex items-center justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeletingUser(null);
                                        setError("");
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    disabled={deleteLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    disabled={deleteLoading}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {deleteLoading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <TrashIcon className="w-4 h-4" />
                                            <span>Delete Manager</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManagerAccountPage;