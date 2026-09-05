import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    XMarkIcon,
    CheckIcon,
    WrenchScrewdriverIcon,
    CheckBadgeIcon,
    HomeIcon,
    CurrencyRupeeIcon,
    UserGroupIcon,
    Cog6ToothIcon,
    MagnifyingGlassIcon,
    ClockIcon,
    MapPinIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';

function RoomPage({ session }) {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);

    // Message system - centralized
    const [messages, setMessages] = useState([]);

    // Search
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");

    // Room form
    const [roomNumber, setRoomNumber] = useState("");
    const [roomRate, setRoomRate] = useState("");
    const [noOfBeds, setNoOfBeds] = useState("");
    const [features, setFeatures] = useState("");

    const [editingRoom, setEditingRoom] = useState(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [formMode, setFormMode] = useState('create');

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingRoom, setDeletingRoom] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    // Form validation errors
    const [formErrors, setFormErrors] = useState({});

    const isAdmin = session?.role === "admin";

    // Message functions
    const addMessage = (text, type = 'info', duration = 5000) => {
        const id = Date.now() + Math.random();
        setMessages(prev => [...prev, { id, text, type, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeMessage(id);
            }, duration);
        }
    };

    const removeMessage = (id) => {
        setMessages(prev => prev.filter(msg => msg.id !== id));
    };

    const clearMessages = () => {
        setMessages([]);
    };

    const showSuccess = (text, duration = 5000) => {
        addMessage(text, 'success', duration);
    };

    const showError = (text, duration = 5000) => {
        addMessage(text, 'error', duration);
    };

    const showInfo = (text, duration = 5000) => {
        addMessage(text, 'info', duration);
    };

    // Form validation
    const validateForm = () => {
        const errors = {};

        // Room number validation
        if (!roomNumber.trim()) {
            errors.roomNumber = 'Room number is required';
        }

        // Room rate validation
        if (!roomRate.trim()) {
            errors.roomRate = 'Room rate is required';
        } else if (Number(roomRate) < 0) {
            errors.roomRate = 'Rate cannot be negative';
        } else if (Number(roomRate) === 0) {
            errors.roomRate = 'Rate must be greater than 0';
        }

        // Number of beds validation
        if (!noOfBeds.trim()) {
            errors.noOfBeds = 'Number of beds is required';
        } else if (Number(noOfBeds) < 1) {
            errors.noOfBeds = 'Must have at least 1 bed';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Clear a specific form error
    const clearFieldError = (field) => {
        setFormErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
        });
    };

    // ============================================================
    // LOAD ROOMS
    // ============================================================

    const loadRooms = async () => {
        setLoading(true);
        clearMessages();
        try {
            let result;

            if (search.trim() === "") {
                result = await invoke("get_rooms");
            } else {
                // If your backend supports search, add it here
                result = await invoke("get_rooms");
                // Filter locally if backend doesn't support search
                if (result && Array.isArray(result)) {
                    const searchLower = search.toLowerCase();
                    result = result.filter(room =>
                        room.room_number.toLowerCase().includes(searchLower) ||
                        (room.features && room.features.toLowerCase().includes(searchLower)) ||
                        room.status?.toLowerCase().includes(searchLower)
                    );
                }
            }

            setRooms(result);
        } catch (error) {
            console.error("Failed to load rooms:", error);
            showError("Failed to load rooms: " + String(error));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRooms();
    }, [search]);

    // ============================================================
    // OPEN/CLOSE FORM
    // ============================================================

    function openCreateForm() {
        clearForm();
        setFormMode('create');
        setEditingRoom(null);
        setIsFormVisible(true);
        setFormErrors({});
        clearMessages();
        setTimeout(() => {
            document.getElementById('room-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    function openEditForm(room) {
        setFormMode('edit');
        setEditingRoom(room);
        setRoomNumber(room.room_number);
        setRoomRate(String(room.room_rate));
        setNoOfBeds(String(room.no_of_beds));
        setFeatures(room.features || "");
        setFormErrors({});
        setIsFormVisible(true);
        clearMessages();
        setTimeout(() => {
            document.getElementById('room-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    function closeForm() {
        setIsFormVisible(false);
        setFormMode('create');
        setEditingRoom(null);
        setRoomNumber("");
        setRoomRate("");
        setNoOfBeds("");
        setFeatures("");
        setFormErrors({});
        clearMessages();
    }

    function clearForm() {
        setEditingRoom(null);
        setRoomNumber("");
        setRoomRate("");
        setNoOfBeds("");
        setFeatures("");
        setFormErrors({});
        clearMessages();
    }

    // ============================================================
    // ADD / UPDATE ROOM
    // ============================================================

    async function handleSubmit(e) {
        e.preventDefault();

        // Validate form
        if (!validateForm()) {
            const firstError = Object.values(formErrors)[0];
            if (firstError) {
                showError(firstError);
            }
            return;
        }

        setFormLoading(true);
        clearMessages();

        try {
            if (editingRoom) {
                await invoke("update_room", {
                    room: {
                        room_id: editingRoom.room_id,
                        room_number: roomNumber.trim(),
                        room_rate: Number(roomRate),
                        no_of_beds: Number(noOfBeds),
                        features: features.trim() || null,
                    },
                });
                showSuccess("Room updated successfully.");
            } else {
                await invoke("add_room", {
                    room: {
                        room_number: roomNumber.trim(),
                        room_rate: Number(roomRate),
                        no_of_beds: Number(noOfBeds),
                        features: features.trim() || null,
                    },
                });
                showSuccess("Room added successfully.");
            }

            closeForm();
            await loadRooms();
        } catch (error) {
            console.error("Room operation failed:", error);
            showError(String(error));
        } finally {
            setFormLoading(false);
        }
    }

    // ============================================================
    // DELETE ROOM
    // ============================================================

    async function handleDeleteConfirm() {
        if (!deletingRoom) return;

        setDeleteLoading(true);
        clearMessages();

        try {
            await invoke("delete_room", {
                roomId: deletingRoom.room_id,
            });
            showSuccess(`Room "${deletingRoom.room_number}" deleted successfully.`);
            setShowDeleteConfirm(false);
            setDeletingRoom(null);
            await loadRooms();
        } catch (error) {
            console.error("Failed to delete room:", error);
            showError(String(error));
        } finally {
            setDeleteLoading(false);
        }
    }

    // ============================================================
    // SET ROOM TO MAINTENANCE
    // ============================================================

    async function handleSetMaintenance(roomId) {
        // Show custom confirmation dialog instead of window.confirm
        const confirmed = await showConfirmationDialog(
            "Set this room to maintenance?",
            "This room will be marked as under maintenance and will not be available for booking."
        );

        if (!confirmed) return;

        clearMessages();

        try {
            await invoke("set_room_maintenance", {
                roomId: roomId,
            });
            showSuccess("Room is now under maintenance.");
            await loadRooms();
        } catch (error) {
            console.error("Failed to set maintenance:", error);
            showError(String(error));
        }
    }

    // ============================================================
    // REMOVE MAINTENANCE
    // ============================================================

    async function handleRemoveMaintenance(roomId) {
        // Show custom confirmation dialog instead of window.confirm
        const confirmed = await showConfirmationDialog(
            "Remove this room from maintenance and make it available?",
            "This room will become available for booking again."
        );

        if (!confirmed) return;

        clearMessages();

        try {
            await invoke("remove_room_maintenance", {
                roomId: roomId,
            });
            showSuccess("Room is now available.");
            await loadRooms();
        } catch (error) {
            console.error("Failed to remove maintenance:", error);
            showError(String(error));
        }
    }

    // ============================================================
    // CUSTOM CONFIRMATION DIALOG
    // ============================================================

    const [confirmationDialog, setConfirmationDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        confirmText: 'Confirm',
        cancelText: 'Cancel'
    });

    const showConfirmationDialog = (title, message, confirmText = 'Confirm', cancelText = 'Cancel') => {
        return new Promise((resolve) => {
            setConfirmationDialog({
                isOpen: true,
                title,
                message,
                confirmText,
                cancelText,
                onConfirm: () => {
                    setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
                }
            });
        });
    };

    // ============================================================
    // SEARCH
    // ============================================================

    function handleSearchInput(e) {
        setSearchInput(e.target.value);
    }

    function handleSearchSubmit(e) {
        e.preventDefault();
        setSearch(searchInput);
        if (searchInput.trim()) {
            showInfo(`Searching for "${searchInput}"...`);
        }
    }

    function handleClearSearch() {
        setSearchInput("");
        setSearch("");
        clearMessages();
    }

    // ============================================================
    // STATUS STYLE
    // ============================================================

    function getStatusConfig(status) {
        switch (status) {
            case "available":
                return {
                    bg: "bg-green-50",
                    text: "text-green-700",
                    border: "border-green-200",
                    icon: <CheckBadgeIcon className="w-4 h-4 text-green-600" />,
                    label: "Available"
                };
            case "reserved":
                return {
                    bg: "bg-yellow-50",
                    text: "text-yellow-700",
                    border: "border-yellow-200",
                    icon: <ClockIcon className="w-4 h-4 text-yellow-600" />,
                    label: "Reserved"
                };
            case "booked":
                return {
                    bg: "bg-blue-50",
                    text: "text-blue-700",
                    border: "border-blue-200",
                    icon: <HomeIcon className="w-4 h-4 text-blue-600" />,
                    label: "Booked"
                };
            case "maintenance":
                return {
                    bg: "bg-red-50",
                    text: "text-red-700",
                    border: "border-red-200",
                    icon: <WrenchScrewdriverIcon className="w-4 h-4 text-red-600" />,
                    label: "Maintenance"
                };
            default:
                return {
                    bg: "bg-gray-50",
                    text: "text-gray-700",
                    border: "border-gray-200",
                    icon: null,
                    label: status || "Unknown"
                };
        }
    }

    // ============================================================
    // UI
    // ============================================================

    // Loading state
    if (loading && rooms.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading rooms...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto relative">
            {/* Message Display */}
            {messages.length > 0 && (
                <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md w-full">
                    {messages.map(({ id, text, type }) => (
                        <div
                            key={id}
                            className={`
                                p-4 rounded-lg shadow-lg border flex items-start gap-3 animate-slide-in
                                ${type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : ''}
                                ${type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : ''}
                                ${type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
                            `}
                        >
                            <div className="flex-1">
                                <p className="text-sm">{text}</p>
                            </div>
                            <button
                                onClick={() => removeMessage(id)}
                                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Custom Confirmation Dialog */}
            {confirmationDialog.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white/20 rounded-full">
                                    <InformationCircleIcon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">
                                        {confirmationDialog.title}
                                    </h2>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <p className="text-gray-600 mb-4">
                                {confirmationDialog.message}
                            </p>

                            <div className="flex items-center justify-end gap-3 mt-6">
                                <button
                                    onClick={confirmationDialog.onCancel}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    {confirmationDialog.cancelText}
                                </button>
                                <button
                                    onClick={confirmationDialog.onConfirm}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                                >
                                    <CheckIcon className="w-4 h-4" />
                                    <span>{confirmationDialog.confirmText}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <HomeIcon className="w-7 h-7 text-blue-600" />
                        Room Management
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage hotel rooms, view status, and update room details
                    </p>
                </div>
                {isAdmin && (
                    <button
                        onClick={openCreateForm}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>Add Room</span>
                    </button>
                )}
            </div>

            {/* =================================================
                ROOM FORM (Inline Section)
            ================================================= */}

            {isFormVisible && isAdmin && (
                <div id="room-form" className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                {formMode === 'create' ? "Add New Room" : "Edit Room"}
                            </h2>
                            <p className="text-sm text-blue-100">
                                {formMode === 'create' ? "Enter room details" : "Update room information"}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* ROOM NUMBER */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Room Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={roomNumber}
                                    onChange={(e) => {
                                        setRoomNumber(e.target.value);
                                        if (formErrors.roomNumber) clearFieldError('roomNumber');
                                    }}
                                    placeholder="101"
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.roomNumber ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    required
                                />
                                {formErrors.roomNumber && (
                                    <p className="mt-1 text-xs text-red-500">{formErrors.roomNumber}</p>
                                )}
                            </div>

                            {/* ROOM RATE */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Room Rate (Rs.) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <CurrencyRupeeIcon className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="number"
                                        value={roomRate}
                                        onChange={(e) => {
                                            setRoomRate(e.target.value);
                                            if (formErrors.roomRate) clearFieldError('roomRate');
                                        }}
                                        placeholder="4000"
                                        min="0"
                                        step="0.01"
                                        className={`w-full pl-8 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.roomRate ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        required
                                    />
                                </div>
                                {formErrors.roomRate && (
                                    <p className="mt-1 text-xs text-red-500">{formErrors.roomRate}</p>
                                )}
                            </div>

                            {/* NUMBER OF BEDS */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Number of Beds <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <UserGroupIcon className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="number"
                                        value={noOfBeds}
                                        onChange={(e) => {
                                            setNoOfBeds(e.target.value);
                                            if (formErrors.noOfBeds) clearFieldError('noOfBeds');
                                        }}
                                        placeholder="2"
                                        min="1"
                                        className={`w-full pl-8 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.noOfBeds ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        required
                                    />
                                </div>
                                {formErrors.noOfBeds && (
                                    <p className="mt-1 text-xs text-red-500">{formErrors.noOfBeds}</p>
                                )}
                            </div>

                            {/* FEATURES */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Features
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Cog6ToothIcon className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={features}
                                        onChange={(e) => setFeatures(e.target.value)}
                                        placeholder="AC, TV, WiFi"
                                        className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-400">Separate features with commas</p>
                            </div>
                        </div>

                        {/* FORM BUTTONS */}
                        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={closeForm}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={formLoading}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {formLoading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{formMode === 'create' ? "Adding..." : "Updating..."}</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckIcon className="w-4 h-4" />
                                        <span>{formMode === 'create' ? "Add Room" : "Update Room"}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* =================================================
                SEARCH
            ================================================= */}

            <div className="mb-6">
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={handleSearchInput}
                            placeholder="Search by room number, features, or status..."
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        <MagnifyingGlassIcon className="w-5 h-5" />
                        <span>Search</span>
                    </button>
                </form>
            </div>

            {/* TOTAL */}
            <div className="mb-4 text-sm text-gray-600">
                Total rooms: <span className="font-semibold text-gray-800">{rooms.length}</span>
            </div>

            {/* =================================================
                ROOM TABLE
            ================================================= */}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Room
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Rate (Rs.)
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Beds
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Features
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Status
                                </th>
                                {isAdmin && (
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {rooms.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                                        {search ? "No rooms found matching your search." : "No rooms found. Add your first room!"}
                                    </td>
                                </tr>
                            ) : (
                                rooms.map((room) => {
                                    const statusConfig = getStatusConfig(room.status);
                                    return (
                                        <tr key={room.room_id} className="hover:bg-gray-50 transition-colors">
                                            {/* ROOM NUMBER */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-gray-900">
                                                    {room.room_number}
                                                </span>
                                            </td>

                                            {/* RATE */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-semibold text-gray-800">
                                                    Rs. {Number(room.room_rate).toLocaleString()}
                                                </span>
                                            </td>

                                            {/* BEDS */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-600">
                                                    {room.no_of_beds}
                                                </span>
                                            </td>

                                            {/* FEATURES */}
                                            <td className="px-6 py-4">
                                                {room.features ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {room.features.split(',').map((feature, index) => (
                                                            <span
                                                                key={index}
                                                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                                                            >
                                                                {feature.trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>

                                            {/* STATUS */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}
                                                >
                                                    {statusConfig.icon}
                                                    {statusConfig.label}
                                                </span>
                                            </td>

                                            {/* ADMIN ACTIONS */}
                                            {isAdmin && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {/* EDIT */}
                                                        <button
                                                            onClick={() => openEditForm(room)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit room"
                                                        >
                                                            <PencilIcon className="w-5 h-5" />
                                                        </button>

                                                        {/* MAINTENANCE */}
                                                        {room.status !== "maintenance" && (
                                                            <button
                                                                onClick={() => handleSetMaintenance(room.room_id)}
                                                                className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                                title="Set maintenance"
                                                            >
                                                                <WrenchScrewdriverIcon className="w-5 h-5" />
                                                            </button>
                                                        )}

                                                        {/* REMOVE MAINTENANCE */}
                                                        {room.status === "maintenance" && (
                                                            <button
                                                                onClick={() => handleRemoveMaintenance(room.room_id)}
                                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                title="Make available"
                                                            >
                                                                <CheckBadgeIcon className="w-5 h-5" />
                                                            </button>
                                                        )}

                                                        {/* DELETE */}
                                                        <button
                                                            onClick={() => {
                                                                setDeletingRoom(room);
                                                                setShowDeleteConfirm(true);
                                                            }}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete room"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* =================================================
                DELETE CONFIRMATION MODAL
            ================================================= */}

            {showDeleteConfirm && deletingRoom && (
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
                                Are you sure you want to delete this room?
                            </p>
                            <p className="font-semibold text-gray-800 text-lg mb-2">
                                Room #{deletingRoom.room_number}
                            </p>
                            <div className="flex items-center gap-3 mb-2 text-sm text-gray-500">
                                <span>Rate: Rs. {Number(deletingRoom.room_rate).toLocaleString()}</span>
                                <span>•</span>
                                <span>{deletingRoom.no_of_beds} bed{deletingRoom.no_of_beds > 1 ? 's' : ''}</span>
                            </div>
                            {deletingRoom.features && (
                                <p className="text-sm text-gray-500 mb-4">
                                    Features: {deletingRoom.features}
                                </p>
                            )}
                            <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                                ⚠️ This action cannot be undone. All data associated with this room will be permanently removed.
                            </p>

                            <div className="flex items-center justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeletingRoom(null);
                                        clearMessages();
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    disabled={deleteLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
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
                                            <span>Delete Room</span>
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

export default RoomPage;