import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function RoomRegistrationPage() {
    // ============================================================
    // STATE
    // ============================================================

    const [customers, setCustomers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [activeBookings, setActiveBookings] = useState([]);

    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [maleCount, setMaleCount] = useState(1);
    const [femaleCount, setFemaleCount] = useState(0);
    const [relation, setRelation] = useState("Self");

    const [selectedRooms, setSelectedRooms] = useState([]);

    const [selectedRegistration, setSelectedRegistration] = useState(null);
    const [registrationRooms, setRegistrationRooms] = useState([]);

    // Changed from roomHistory to registrationHistory
    const [registrationHistory, setRegistrationHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    const [newRoomId, setNewRoomId] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // ============================================================
    // LOAD DATA
    // ============================================================

    useEffect(() => {
        loadInitialData();
    }, []);

    async function loadInitialData() {
        try {
            setLoading(true);
            setError("");

            const [customerData, roomData, bookingData, historyData] = await Promise.all([
                invoke("list_customers", { page: 1 }),
                invoke("get_rooms"),
                invoke("get_active_bookings"),
                invoke("get_registration_history"),
            ]);

            setCustomers(customerData.customers || []);
            setRooms(roomData || []);
            setActiveBookings(bookingData || []);
            setRegistrationHistory(historyData || []);
        } catch (err) {
            console.error(err);
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function refreshData() {
        try {
            const [roomData, bookingData, historyData] = await Promise.all([
                invoke("get_rooms"),
                invoke("get_active_bookings"),
                invoke("get_registration_history"),
            ]);

            setRooms(roomData || []);
            setActiveBookings(bookingData || []);
            setRegistrationHistory(historyData || []);
        } catch (err) {
            setError(String(err));
        }
    }

    // ============================================================
    // ROOM SELECTION
    // ============================================================

    function toggleRoom(roomId) {
        setSelectedRooms((current) => {
            if (current.includes(roomId)) {
                return current.filter((id) => id !== roomId);
            }

            return [...current, roomId];
        });
    }

    // ============================================================
    // CREATE BOOKING
    // ============================================================

    async function handleCreateBooking(e) {
        e.preventDefault();

        setMessage("");
        setError("");

        if (!selectedCustomer) {
            setError("Please select a customer.");
            return;
        }

        if (selectedRooms.length === 0) {
            setError("Please select at least one room.");
            return;
        }

        if (maleCount + femaleCount <= 0) {
            setError("At least one guest is required.");
            return;
        }

        setLoading(true);

        try {
            const registrationId = await invoke("create_booking", {
                customerId: Number(selectedCustomer),
                maleCount: Number(maleCount),
                femaleCount: Number(femaleCount),
                relation,
                roomIds: selectedRooms.map(Number),
            });

            setMessage(
                `Registration #${registrationId} created successfully.`
            );

            setSelectedRooms([]);
            setSelectedCustomer("");
            setMaleCount(1);
            setFemaleCount(0);
            setRelation("Self");

            await refreshData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    // ============================================================
    // GET REGISTRATION DETAILS
    // ============================================================

    async function openRegistration(registrationId) {
        setError("");
        setMessage("");

        try {
            const booking = await invoke("get_booking", {
                registrationId: Number(registrationId),
            });

            setSelectedRegistration(booking);
            setRegistrationRooms(booking.rooms || []);
        } catch (err) {
            setError(String(err));
        }
    }

    // ============================================================
    // ADD ROOM
    // ============================================================

    async function handleAddRoom() {
        if (!selectedRegistration) {
            setError("Select a registration first.");
            return;
        }

        if (!newRoomId) {
            setError("Select a room.");
            return;
        }

        setError("");
        setMessage("");
        setLoading(true);

        try {
            await invoke("add_room_to_registration", {
                registrationId: selectedRegistration.registration_id,
                roomId: Number(newRoomId),
            });

            setMessage(
                `Room added to registration #${selectedRegistration.registration_id}.`
            );

            setNewRoomId("");

            await openRegistration(
                selectedRegistration.registration_id
            );

            await refreshData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    // ============================================================
    // CHANGE ROOM
    // ============================================================

    async function handleChangeRoom(oldRoomId) {
        if (!selectedRegistration) {
            return;
        }

        if (!newRoomId) {
            setError("Select the new room first.");
            return;
        }

        setError("");
        setMessage("");
        setLoading(true);

        try {
            await invoke("change_registration_room", {
                registrationId: selectedRegistration.registration_id,
                oldRoomId: Number(oldRoomId),
                newRoomId: Number(newRoomId),
            });

            setMessage("Room changed successfully.");

            setNewRoomId("");

            await openRegistration(
                selectedRegistration.registration_id
            );

            await refreshData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    // ============================================================
    // CHECKOUT INDIVIDUAL ROOM
    // ============================================================

    async function handleCheckoutRoom(roomId) {
        const confirmed = window.confirm(
            `Checkout Room ${getRoomNumber(roomId)} from registration #${selectedRegistration.registration_id}?`
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");
        setLoading(true);

        try {
            await invoke("checkout_room", {
                registrationId: selectedRegistration.registration_id,
                roomId: Number(roomId),
            });

            setMessage(
                `Room ${getRoomNumber(roomId)} checked out successfully.`
            );

            // Refresh registration details
            await openRegistration(selectedRegistration.registration_id);
            await refreshData();

            // If registration is now checked out, close it
            if (selectedRegistration.status === "checked_out") {
                setSelectedRegistration(null);
                setRegistrationRooms([]);
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    // ============================================================
    // CHECKOUT ENTIRE REGISTRATION
    // ============================================================

    async function handleCheckout(registrationId) {
        const confirmed = window.confirm(
            `Checkout all rooms in registration #${registrationId}?`
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");
        setLoading(true);

        try {
            await invoke("checkout_registration", {
                registrationId: Number(registrationId),
            });

            setMessage(
                `Registration #${registrationId} checked out successfully.`
            );

            if (
                selectedRegistration?.registration_id ===
                Number(registrationId)
            ) {
                setSelectedRegistration(null);
                setRegistrationRooms([]);
            }

            await refreshData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    // ============================================================
    // HELPERS
    // ============================================================

    function getRoomNumber(roomId) {
        const room = rooms.find(
            (r) => Number(r.room_id) === Number(roomId)
        );

        return room ? room.room_number : `Room #${roomId}`;
    }

    function getAvailableRooms() {
        return rooms.filter(
            (room) => room.status === "available"
        );
    }

    // ============================================================
    // UI
    // ============================================================

    return (
        <div className="min-h-screen bg-slate-100 p-6 text-slate-900">

            {/* HEADER */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold">
                    Room Registration
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                    Booking system test dashboard
                </p>
            </div>

            {/* MESSAGES */}
            {message && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
                    {message}
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                    {error}
                </div>
            )}

            {/* ====================================================
                CREATE REGISTRATION
            ==================================================== */}

            <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">

                <h2 className="mb-5 text-xl font-semibold">
                    Create Registration
                </h2>

                <form onSubmit={handleCreateBooking}>

                    <div className="grid gap-5 md:grid-cols-2">

                        {/* CUSTOMER */}
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Customer
                            </label>

                            <select
                                value={selectedCustomer}
                                onChange={(e) =>
                                    setSelectedCustomer(e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                            >
                                <option value="">
                                    Select customer
                                </option>

                                {customers.map((customer) => (
                                    <option
                                        key={customer.customer_id}
                                        value={customer.customer_id}
                                    >
                                        {customer.name} —{" "}
                                        {customer.phone_number}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* RELATION */}
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Relation
                            </label>

                            <input
                                value={relation}
                                onChange={(e) =>
                                    setRelation(e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                                placeholder="Self / Family / Friend..."
                            />
                        </div>

                        {/* MALE */}
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Male Guests
                            </label>

                            <input
                                type="number"
                                min="0"
                                value={maleCount}
                                onChange={(e) =>
                                    setMaleCount(e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                        </div>

                        {/* FEMALE */}
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Female Guests
                            </label>

                            <input
                                type="number"
                                min="0"
                                value={femaleCount}
                                onChange={(e) =>
                                    setFemaleCount(e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                        </div>
                    </div>

                    {/* ROOM SELECTION */}
                    <div className="mt-6">

                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">
                                Select Rooms
                            </h3>

                            <span className="text-sm text-slate-500">
                                {selectedRooms.length} selected
                            </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                            {getAvailableRooms().map((room) => {
                                const selected =
                                    selectedRooms.includes(
                                        room.room_id
                                    );

                                return (
                                    <button
                                        type="button"
                                        key={room.room_id}
                                        onClick={() =>
                                            toggleRoom(room.room_id)
                                        }
                                        className={`rounded-xl border p-4 text-left transition ${selected
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-slate-200 bg-white hover:border-blue-300"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">

                                            <span className="text-lg font-bold">
                                                {room.room_number}
                                            </span>

                                            <span
                                                className={`rounded-full px-2 py-1 text-xs ${selected
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-green-100 text-green-700"
                                                    }`}
                                            >
                                                {selected
                                                    ? "Selected"
                                                    : "Available"}
                                            </span>
                                        </div>

                                        <div className="mt-2 text-sm text-slate-500">
                                            Beds: {room.no_of_beds}
                                        </div>

                                        <div className="text-sm text-slate-500">
                                            Rate: {room.room_rate}
                                        </div>

                                        {room.features && (
                                            <div className="mt-1 text-xs text-slate-400">
                                                {room.features}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        disabled={loading}
                        className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading
                            ? "Processing..."
                            : "Create Registration"}
                    </button>
                </form>
            </div>

            {/* ====================================================
                ROOM STATUS
            ==================================================== */}

            <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">

                <div className="mb-4 flex items-center justify-between">

                    <h2 className="text-xl font-semibold">
                        Room Status
                    </h2>

                    <button
                        onClick={refreshData}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        Refresh
                    </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                    {rooms.map((room) => {

                        const statusClasses = {
                            available:
                                "bg-green-50 border-green-200 text-green-700",

                            reserved:
                                "bg-red-50 border-red-200 text-red-700",

                            maintenance:
                                "bg-yellow-50 border-yellow-200 text-yellow-700",
                        };

                        return (
                            <div
                                key={room.room_id}
                                className={`rounded-xl border p-4 ${statusClasses[room.status] ||
                                    "bg-slate-50 border-slate-200"
                                    }`}
                            >
                                <div className="flex justify-between">

                                    <span className="font-bold">
                                        Room {room.room_number}
                                    </span>

                                    <span className="text-xs font-semibold uppercase">
                                        {room.status}
                                    </span>

                                </div>

                                <div className="mt-2 text-sm">
                                    Beds: {room.no_of_beds}
                                </div>

                                <div className="text-sm">
                                    Rate: {room.room_rate}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ====================================================
                ACTIVE REGISTRATIONS
            ==================================================== */}

            <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">

                <h2 className="mb-4 text-xl font-semibold">
                    Active Registrations
                </h2>

                {activeBookings.length === 0 ? (
                    <div className="rounded-lg bg-slate-50 p-6 text-center text-slate-500">
                        No active registrations.
                    </div>
                ) : (
                    <div className="space-y-3">

                        {activeBookings.map((booking) => (
                            <div
                                key={booking.registration_id}
                                className="rounded-xl border border-slate-200 p-4"
                            >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                                    <div>

                                        <div className="font-bold">
                                            Registration #
                                            {booking.registration_id}
                                        </div>

                                        <div className="text-sm text-slate-600">
                                            {booking.customer_name}
                                        </div>

                                        <div className="text-sm text-slate-500">
                                            {booking.phone_number}
                                        </div>

                                        <div className="mt-2 text-sm">
                                            Check-in:{" "}
                                            {booking.check_in}
                                        </div>

                                        <div className="text-sm">
                                            Guests:{" "}
                                            {booking.male_count} M /{" "}
                                            {booking.female_count} F
                                        </div>

                                    </div>

                                    <div className="flex flex-wrap gap-2">

                                        <button
                                            onClick={() =>
                                                openRegistration(
                                                    booking.registration_id
                                                )
                                            }
                                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                        >
                                            View
                                        </button>

                                        <button
                                            onClick={() =>
                                                handleCheckout(
                                                    booking.registration_id
                                                )
                                            }
                                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                                        >
                                            Checkout All
                                        </button>

                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ====================================================
                SELECTED REGISTRATION
            ==================================================== */}

            {selectedRegistration && (
                <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">

                    <div className="mb-5 flex items-start justify-between">

                        <div>
                            <h2 className="text-xl font-semibold">
                                Registration #
                                {selectedRegistration.registration_id}
                            </h2>

                            <p className="text-sm text-slate-500">
                                {selectedRegistration.customer_name}
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                setSelectedRegistration(null);
                                setRegistrationRooms([]);
                            }}
                            className="text-sm text-slate-500 hover:text-slate-900"
                        >
                            Close
                        </button>
                    </div>

                    {/* CUSTOMER INFO */}

                    <div className="mb-6 grid gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-4">

                        <div>
                            <div className="text-xs text-slate-500">
                                Customer
                            </div>

                            <div className="font-medium">
                                {selectedRegistration.customer_name}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-slate-500">
                                Phone
                            </div>

                            <div className="font-medium">
                                {selectedRegistration.phone_number}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-slate-500">
                                Guests
                            </div>

                            <div className="font-medium">
                                {selectedRegistration.male_count} M /{" "}
                                {selectedRegistration.female_count} F
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-slate-500">
                                Status
                            </div>

                            <div className="font-medium capitalize">
                                {selectedRegistration.status}
                            </div>
                        </div>

                    </div>

                    {/* ADD ROOM */}

                    <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4">

                        <h3 className="mb-3 font-semibold">
                            Add Another Room
                        </h3>

                        <div className="flex flex-col gap-3 sm:flex-row">

                            <select
                                value={newRoomId}
                                onChange={(e) =>
                                    setNewRoomId(e.target.value)
                                }
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
                            >
                                <option value="">
                                    Select available room
                                </option>

                                {getAvailableRooms().map((room) => (
                                    <option
                                        key={room.room_id}
                                        value={room.room_id}
                                    >
                                        Room {room.room_number}
                                    </option>
                                ))}
                            </select>

                            <button
                                onClick={handleAddRoom}
                                className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
                            >
                                Add Room
                            </button>

                        </div>
                    </div>

                    {/* ROOMS */}

                    <h3 className="mb-3 font-semibold">
                        Room Assignments
                    </h3>

                    <div className="space-y-3">

                        {registrationRooms.map((room) => (

                            <div
                                key={room.id}
                                className="rounded-xl border border-slate-200 p-4"
                            >

                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                                    <div>

                                        <div className="text-lg font-bold">
                                            Room {room.room_number}
                                        </div>

                                        <div className="text-sm text-slate-500">
                                            Room ID: {room.room_id}
                                        </div>

                                        <div className="mt-2 text-sm">
                                            Check-in:{" "}
                                            {room.check_in}
                                        </div>

                                        <div className="text-sm">
                                            Check-out:{" "}
                                            {room.check_out || "Still occupied"}
                                        </div>

                                        <div className="mt-1">
                                            <span
                                                className={`rounded-full px-2 py-1 text-xs ${room.status === "active"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-slate-100 text-slate-600"
                                                    }`}
                                            >
                                                {room.status}
                                            </span>
                                        </div>

                                    </div>

                                    {room.status === "active" && (
                                        <div className="flex flex-col gap-2">

                                            <div className="flex flex-wrap gap-2">
                                                <select
                                                    value={newRoomId}
                                                    onChange={(e) =>
                                                        setNewRoomId(
                                                            e.target.value
                                                        )
                                                    }
                                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                                >
                                                    <option value="">
                                                        Change to...
                                                    </option>

                                                    {getAvailableRooms().map(
                                                        (availableRoom) => (
                                                            <option
                                                                key={
                                                                    availableRoom.room_id
                                                                }
                                                                value={
                                                                    availableRoom.room_id
                                                                }
                                                            >
                                                                Room{" "}
                                                                {
                                                                    availableRoom.room_number
                                                                }
                                                            </option>
                                                        )
                                                    )}
                                                </select>

                                                <button
                                                    onClick={() =>
                                                        handleChangeRoom(
                                                            room.room_id
                                                        )
                                                    }
                                                    className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
                                                >
                                                    Change
                                                </button>
                                            </div>

                                            <button
                                                onClick={() =>
                                                    handleCheckoutRoom(room.room_id)
                                                }
                                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                                            >
                                                Checkout This Room
                                            </button>

                                        </div>
                                    )}

                                </div>

                            </div>
                        ))}

                    </div>

                    {/* CHECKOUT ALL */}

                    <button
                        onClick={() =>
                            handleCheckout(
                                selectedRegistration.registration_id
                            )
                        }
                        className="mt-6 w-full rounded-lg bg-red-600 py-3 font-semibold text-white hover:bg-red-700"
                    >
                        Checkout All Rooms
                    </button>

                </div>
            )}

            {/* ====================================================
                REGISTRATION HISTORY (Oldest to Latest)
            ==================================================== */}

            <div className="rounded-xl bg-white p-6 shadow-sm">

                <div className="mb-4 flex items-center justify-between">

                    <h2 className="text-xl font-semibold">
                        Registration History
                    </h2>

                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        {showHistory ? "Hide" : "Show"} History
                    </button>

                </div>

                {showHistory && (
                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[700px] text-left text-sm">

                            <thead>
                                <tr className="border-b bg-slate-50">
                                    <th className="px-4 py-3">
                                        Reg #
                                    </th>

                                    <th className="px-4 py-3">
                                        Customer
                                    </th>

                                    <th className="px-4 py-3">
                                        Phone
                                    </th>

                                    <th className="px-4 py-3">
                                        Guests
                                    </th>

                                    <th className="px-4 py-3">
                                        Rooms
                                    </th>

                                    <th className="px-4 py-3">
                                        Check-in
                                    </th>

                                    <th className="px-4 py-3">
                                        Check-out
                                    </th>

                                    <th className="px-4 py-3">
                                        Status
                                    </th>
                                </tr>
                            </thead>

                            <tbody>

                                {registrationHistory.map((history) => (
                                    <tr
                                        key={history.registration_id}
                                        className="border-b last:border-0 hover:bg-slate-50"
                                    >
                                        <td className="px-4 py-3 font-medium">
                                            #{history.registration_id}
                                        </td>

                                        <td className="px-4 py-3">
                                            {history.customer_name}
                                        </td>

                                        <td className="px-4 py-3">
                                            {history.phone_number}
                                        </td>

                                        <td className="px-4 py-3">
                                            {history.male_count}M / {history.female_count}F
                                        </td>

                                        <td className="px-4 py-3">
                                            {history.room_count}
                                        </td>

                                        <td className="px-4 py-3">
                                            {history.check_in}
                                        </td>

                                        <td className="px-4 py-3">
                                            {history.check_out || "Active"}
                                        </td>

                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-1 text-xs ${history.status === "active"
                                                ? "bg-green-100 text-green-700"
                                                : history.status === "checked_out"
                                                    ? "bg-slate-100 text-slate-600"
                                                    : "bg-yellow-100 text-yellow-700"
                                                }`}>
                                                {history.status === "checked_out" ? "Completed" : history.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}

                            </tbody>

                        </table>

                    </div>
                )}

            </div>

        </div>
    );
}