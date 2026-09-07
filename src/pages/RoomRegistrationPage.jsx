import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  UserPlus,
  X,
  Check,
  CheckCircle,
  Clock,
  Search,
  ChevronDown,
  Home,
  Building2,
  Users,
  User,
  Bed,
  IndianRupee,
  RefreshCw,
  ArrowRightLeft,
  DoorOpen,
  Plus,
  FileText,
  Phone,
  Fingerprint,
  Globe,
  UserRound,
  Wrench,
  Filter,
} from "lucide-react";

// ============================================================
// SHARED UI PRIMITIVES
// ============================================================

// Custom Dropdown Component - Matches CustomerPage style
function CustomDropdown({ options, value, onChange, placeholder, label, error, icon: Icon }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find((opt) => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : placeholder;

    return (
        <div className="relative" ref={dropdownRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                    {error && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between hover:border-blue-400 transition-colors ${
                    error ? 'border-red-500' : 'border-gray-300'
                }`}
            >
                <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
                    {displayLabel}
                </span>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            {isOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between ${
                                option.value === value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                            }`}
                        >
                            <span>{option.label}</span>
                            {option.value === value && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Confirmation Dialog Component - Matches CustomerPage modal style
function ConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    loading = false,
    icon: Icon = DoorOpen,
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/20 rounded-full">
                            <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">{title}</h2>
                            <p className="text-sm text-red-100">This action cannot be undone</p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <p className="text-gray-600 mb-2">{message}</p>
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                        ⚠️ This action cannot be undone.
                    </p>

                    <div className="flex items-center justify-end gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            disabled={loading}
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <Icon className="w-4 h-4" />
                                    <span>{confirmText}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function parseFeatures(features) {
    if (!features) return [];
    return features
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f);
}

// Status configuration shared by room cards & badges
const STATUS_CONFIG = {
    available: {
        border: "border-emerald-200 hover:border-emerald-400",
        bg: "bg-gradient-to-br from-emerald-50 to-white",
        accent: "bg-emerald-500",
        badgeBg: "bg-emerald-100",
        badgeText: "text-emerald-700",
        label: "Available",
        icon: CheckCircle,
        dotColor: "bg-emerald-500",
    },
    reserved: {
        border: "border-rose-200 hover:border-rose-400",
        bg: "bg-gradient-to-br from-rose-50 to-white",
        accent: "bg-rose-500",
        badgeBg: "bg-rose-100",
        badgeText: "text-rose-700",
        label: "Occupied",
        icon: User,
        dotColor: "bg-rose-500",
    },
    maintenance: {
        border: "border-amber-200 hover:border-amber-400",
        bg: "bg-gradient-to-br from-amber-50 to-white",
        accent: "bg-amber-500",
        badgeBg: "bg-amber-100",
        badgeText: "text-amber-700",
        label: "Maintenance",
        icon: Wrench,
        dotColor: "bg-amber-500",
    },
};

// Room Card Component - Redesigned to match CustomerPage aesthetic
function RoomCard({ room, onClick, onContextMenu, isSelected = false, getReservedRoomInfo, getGroupColor }) {
    const isReserved = room.status === "reserved";
    const isAvailable = room.status === "available";
    const info = isReserved ? getReservedRoomInfo(room.room_id) : null;
    const groupColor = info ? getGroupColor(info.registration_id) : "";
    const features = parseFeatures(room.features);
    const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.available;
    const StatusIcon = config.icon;

    return (
        <div
            onClick={() => onClick(room)}
            onContextMenu={(e) => onContextMenu(e, room)}
            className={`group relative w-52 flex-shrink-0 rounded-xl border-2 p-4 shadow-sm transition-all duration-200 ${config.bg} ${
                config.border
            } ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""} ${
                isReserved || isAvailable ? "cursor-pointer hover:-translate-y-1 hover:shadow-md" : "cursor-default opacity-75"
            }`}
        >
            {/* Status Indicator Dot */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
                <span className={`text-xs font-medium ${config.badgeText}`}>
                    {config.label}
                </span>
            </div>

            {/* Room Number - Large and prominent */}
            <div className="text-3xl font-bold tracking-tight text-gray-800">
                {room.room_number}
            </div>

            {/* Room details */}
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                    <Bed className="h-3.5 w-3.5" />
                    {room.no_of_beds} bed{room.no_of_beds > 1 ? "s" : ""}
                </span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-0.5 font-semibold text-gray-700">
                    <span className="text-xs">₹</span>
                    {room.room_rate}
                    <span className="text-xs font-normal text-gray-500">/night</span>
                </span>
            </div>

            {/* Features - Show all features in 2 rows max, empty rows for consistency */}
            <div className="mt-2 h-10">
                {features.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {features.slice(0, 6).map((feature, idx) => (
                            <span 
                                key={idx} 
                                className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200"
                            >
                                {feature}
                            </span>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-1 opacity-0">
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">Placeholder</span>
                    </div>
                )}
            </div>

            {/* Reserved customer info */}
            {isReserved && info && (
                <div className="mt-3 pt-2 border-t border-rose-200/60">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-rose-600">
                        <User className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{info.customer_name}</span>
                    </div>
                    {/* Show guest counts per room - using info which has per-room counts */}
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-rose-400">
                        <span>👤 {info.male_count}M / {info.female_count}F</span>
                        {info.room_count > 1 && (
                            <>
                                <span>•</span>
                                <span className={`inline-block h-2 w-2 rounded-full ${groupColor}`} />
                                <span>{info.room_count} rooms </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Available indicator */}
            {isAvailable && (
                <div className="mt-3 pt-2 border-t border-emerald-200/60">
                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <Plus className="h-3 w-3" />
                        Available for check-in
                    </span>
                </div>
            )}
        </div>
    );
}

export default function RoomRegistrationPage({ session, onNavigate }) {
    // ============================================================
    // STATE
    // ============================================================

    const [customers, setCustomers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [activeBookings, setActiveBookings] = useState([]);

    // Search
    const [searchQuery, setSearchQuery] = useState("");
    const [bedFilter, setBedFilter] = useState("all");

    // Registration form
    const [showRegistrationForm, setShowRegistrationForm] = useState(false);
    const [registrationMode, setRegistrationMode] = useState(null);
    const [customerSearch, setCustomerSearch] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [maleCount, setMaleCount] = useState(1);
    const [femaleCount, setFemaleCount] = useState(0);
    const [relation, setRelation] = useState("Self");
    const [selectedRooms, setSelectedRooms] = useState([]);
    const [registrationStep, setRegistrationStep] = useState(1);

    // Context menu
    const [contextMenu, setContextMenu] = useState(null);
    const [contextRoom, setContextRoom] = useState(null);
    const [contextBooking, setContextBooking] = useState(null);
    const contextMenuRef = useRef(null);

    // Registration popup
    const [showRegistrationPopup, setShowRegistrationPopup] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState(null);
    const [registrationRooms, setRegistrationRooms] = useState([]);

    // Customer Details Popup
    const [showCustomerPopup, setShowCustomerPopup] = useState(false);
    const [customerPopupData, setCustomerPopupData] = useState(null);

    // Change Room Dialog
    const [showChangeRoomDialog, setShowChangeRoomDialog] = useState(false);
    const [changeRoomData, setChangeRoomData] = useState(null);
    const [selectedNewRoom, setSelectedNewRoom] = useState(null);

    // Confirmation Dialog
    const [confirmationDialog, setConfirmationDialog] = useState({
        isOpen: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        onConfirm: null,
        loading: false,
        icon: DoorOpen,
    });

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Message system
    const [messages, setMessages] = useState([]);

    // Group colors
    const groupColors = [
        "bg-indigo-500", "bg-purple-500", "bg-pink-500", "bg-teal-500",
        "bg-amber-500", "bg-cyan-500", "bg-lime-500", "bg-rose-500",
        "bg-violet-500", "bg-fuchsia-500", "bg-emerald-500", "bg-sky-500",
        "bg-orange-500", "bg-blue-500", "bg-green-500", "bg-yellow-500",
    ];

    // Floor labels with icons
    const floorConfig = {
        ground: { label: "Ground Floor", icon: Home },
        "1": { label: "1st Floor", icon: Building2 },
        "2": { label: "2nd Floor", icon: Building2 },
        "3": { label: "3rd Floor", icon: Building2 },
        "4": { label: "4th Floor", icon: Building2 },
        "5": { label: "5th Floor", icon: Building2 },
        "6": { label: "6th Floor", icon: Building2 },
        "7": { label: "7th Floor", icon: Building2 },
        "8": { label: "8th Floor", icon: Building2 },
        "9": { label: "9th Floor", icon: Building2 },
        other: { label: "Other", icon: Building2 },
    };

    const relationOptions = [
        { value: "Self", label: "Self" },
        { value: "Family", label: "Family" },
        { value: "Friends", label: "Friends" },
        { value: "Group", label: "Group" },
    ];

    const bedFilterOptions = [
        { value: "all", label: "Beds" },
        { value: "1", label: "1 Bed" },
        { value: "2", label: "2 Beds" },
        { value: "3", label: "3 Beds" },
        { value: "4", label: "4 Beds" },
        { value: "5", label: "5 Beds" },
        { value: "6", label: "6 Beds" },
    ];

    // Message functions
    const addMessage = (text, type = "info", duration = 5000) => {
        const id = Date.now() + Math.random();
        setMessages((prev) => [...prev, { id, text, type, duration }]);
        if (duration > 0) {
            setTimeout(() => removeMessage(id), duration);
        }
    };
    const removeMessage = (id) => setMessages((prev) => prev.filter((msg) => msg.id !== id));
    const clearMessages = () => setMessages([]);
    const showSuccess = (text, duration = 5000) => addMessage(text, "success", duration);
    const showError = (text, duration = 5000) => addMessage(text, "error", duration);
    const showInfo = (text, duration = 5000) => addMessage(text, "info", duration);

    // ============================================================
    // COMPUTED VALUES
    // ============================================================

    const availableRooms = rooms.filter((room) => room.status === "available");
    const reservedRooms = rooms.filter((room) => room.status === "reserved");
    const maintenanceRooms = rooms.filter((room) => room.status === "maintenance");

    const filteredRooms = rooms.filter((room) => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
            room.room_number.toLowerCase().includes(searchLower) ||
            (room.features && room.features.toLowerCase().includes(searchLower)) ||
            room.status.toLowerCase().includes(searchLower);
        
        const matchesBedFilter = bedFilter === "all" || room.no_of_beds === parseInt(bedFilter);
        
        return matchesSearch && matchesBedFilter;
    });

    const floors = ["ground", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const roomsByFloor = floors.reduce((acc, floor) => {
        acc[floor] = filteredRooms
            .filter((room) => getFloorFromRoom(room.room_number) === floor)
            .sort((a, b) => {
                const numA = parseInt(a.room_number.replace(/[^0-9]/g, ""));
                const numB = parseInt(b.room_number.replace(/[^0-9]/g, ""));
                return numA - numB;
            });
        return acc;
    }, {});

    // FIXED: Always use per-room counts from roomData, never fall back to booking totals
    const getReservedRoomInfo = (roomId) => {
        for (const booking of activeBookings) {
            if (booking.rooms && booking.rooms.some((r) => Number(r.room_id) === Number(roomId))) {
                const activeRooms = booking.rooms.filter((r) => r.status === "active");
                // Find the specific room to get its male/female counts
                const roomData = booking.rooms.find((r) => Number(r.room_id) === Number(roomId));
                return {
                    customer_name: booking.customer_name,
                    phone_number: booking.phone_number,
                    check_in: booking.check_in,
                    // ALWAYS use the per-room counts from roomData, never fall back to booking totals
                    male_count: roomData?.male_count ?? 0,
                    female_count: roomData?.female_count ?? 0,
                    registration_id: booking.registration_id,
                    room_count: activeRooms.length,
                    rooms: booking.rooms,
                    booking: booking,
                    other_rooms: booking.rooms.filter((r) => Number(r.room_id) !== Number(roomId)),
                    // Store the room data for reference
                    room_data: roomData,
                };
            }
        }
        return null;
    };

    const getGroupColor = (registrationId) => {
        const index = activeBookings.findIndex((b) => b.registration_id === registrationId);
        return index >= 0 ? groupColors[index % groupColors.length] : groupColors[0];
    };

    // ============================================================
    // HELPERS
    // ============================================================

    function getFloorFromRoom(roomNumber) {
        if (!roomNumber) return "other";
        if (roomNumber.toLowerCase().startsWith("g")) return "ground";
        if (roomNumber.toLowerCase().startsWith("b")) return "basement";
        const num = parseInt(roomNumber);
        if (!isNaN(num) && num >= 100) return Math.floor(num / 100).toString();
        return "other";
    }

    function getFloorLabel(floor) {
        return floorConfig[floor]?.label || floor;
    }

    function getFloorIcon(floor) {
        return floorConfig[floor]?.icon || Building2;
    }

    function formatDate(dateString) {
        if (!dateString) return "-";
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateString;
        }
    }

    // ============================================================
    // LOAD DATA
    // ============================================================

    useEffect(() => {
        loadInitialData();

        const handleClickOutside = () => {
            if (contextMenu) {
                setContextMenu(null);
                setContextRoom(null);
                setContextBooking(null);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ============================================================
    // CONTEXT MENU CLOSE HANDLER
    // ============================================================
    useEffect(() => {
        function handleClickOutside(event) {
            if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
                setContextMenu(null);
                setContextRoom(null);
                setContextBooking(null);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [contextMenu]);

    async function loadInitialData() {
        try {
            setLoading(true);
            clearMessages();

            const [roomData, customerData, bookingData] = await Promise.all([
                invoke("get_rooms"),
                invoke("list_customers", { page: 1 }),
                invoke("get_active_bookings"),
            ]);

            setRooms(roomData || []);
            setCustomers(customerData.customers || []);

            const enrichedBookings = await Promise.all(
                (bookingData || []).map(async (booking) => {
                    try {
                        return await invoke("get_booking", { registrationId: booking.registration_id });
                    } catch {
                        return booking;
                    }
                })
            );
            setActiveBookings(enrichedBookings);

        } catch (err) {
            console.error("Error loading data:", err);
            showError(`Failed to load data: ${String(err)}`);
        } finally {
            setLoading(false);
        }
    }

    async function refreshData({ silent = false } = {}) {
        try {
            if (!silent) setRefreshing(true);
            const roomData = await invoke("get_rooms");
            setRooms(roomData || []);

            const bookingData = await invoke("get_active_bookings");
            const enrichedBookings = await Promise.all(
                (bookingData || []).map(async (booking) => {
                    try {
                        return await invoke("get_booking", { registrationId: booking.registration_id });
                    } catch {
                        return booking;
                    }
                })
            );
            setActiveBookings(enrichedBookings);
        } catch (err) {
            console.error("Error refreshing data:", err);
            showError(String(err));
        } finally {
            if (!silent) setRefreshing(false);
        }
    }

    // ============================================================
    // CUSTOMER SEARCH
    // ============================================================

    function handleCustomerSearch() {
        const trimmed = customerSearch.trim();
        if (!trimmed) {
            showError("Please enter a phone number or document ID");
            return;
        }

        const found = customers.find((c) => {
            const phoneMatch = c.phone_number && c.phone_number.includes(trimmed);
            const docMatch = c.document_number && c.document_number.includes(trimmed);
            return phoneMatch || docMatch;
        });

        if (found) {
            setSelectedCustomer(found);
            showSuccess(`Customer found: ${found.name}`);
        } else {
            showError("Customer not found. Please register a new customer.");
            setSelectedCustomer(null);
        }
    }

    function handleCustomerSearchKeyPress(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleCustomerSearch();
        }
    }

    // ============================================================
    // ROOM SELECTION
    // ============================================================

    function toggleRoom(roomId) {
        const roomIdNum = Number(roomId);
        setSelectedRooms((current) => {
            const isSelected = current.some((id) => Number(id) === roomIdNum);
            return isSelected ? current.filter((id) => Number(id) !== roomIdNum) : [...current, roomIdNum];
        });
    }

    // ============================================================
    // CONTEXT MENU ACTIONS
    // ============================================================

    async function handleViewRegistration() {
        if (!contextBooking) return;
        setContextMenu(null);
        try {
            const booking = await invoke("get_booking", { registrationId: Number(contextBooking.registration_id) });
            setSelectedRegistration(booking);
            setRegistrationRooms(booking.rooms || []);
            setShowRegistrationPopup(true);
        } catch (err) {
            console.error("Error opening registration:", err);
            showError(String(err));
        }
    }

    async function handleCheckoutRoom() {
        if (!contextRoom || !contextBooking) return;
        setContextMenu(null);

        setConfirmationDialog({
            isOpen: true,
            title: "Checkout Room",
            message: `Are you sure you want to checkout Room ${contextRoom.room_number} from registration #${contextBooking.registration_id}?`,
            confirmText: "Checkout Room",
            icon: DoorOpen,
            onConfirm: async () => {
                setConfirmationDialog((prev) => ({ ...prev, loading: true }));
                try {
                    await invoke("checkout_room", {
                        registrationId: Number(contextBooking.registration_id),
                        roomId: Number(contextRoom.room_id),
                    });

                    showSuccess(`Room ${contextRoom.room_number} checked out successfully.`);
                    await refreshData();
                    closeConfirmationDialog();
                } catch (err) {
                    console.error("Error checking out room:", err);
                    showError(String(err));
                    setConfirmationDialog((prev) => ({ ...prev, loading: false }));
                }
            },
        });
    }

    async function handleCheckoutSingleRoom(room) {
        const info = getReservedRoomInfo(room.room_id);
        if (!info) return;

        setConfirmationDialog({
            isOpen: true,
            title: "Checkout Room",
            message: `Are you sure you want to checkout Room ${room.room_number}?`,
            confirmText: "Checkout Room",
            icon: DoorOpen,
            onConfirm: async () => {
                setConfirmationDialog((prev) => ({ ...prev, loading: true }));
                try {
                    await invoke("checkout_room", {
                        registrationId: Number(info.registration_id),
                        roomId: Number(room.room_id),
                    });

                    showSuccess(`Room ${room.room_number} checked out successfully.`);
                    await refreshData();

                    if (showRegistrationPopup && selectedRegistration) {
                        const booking = await invoke("get_booking", { registrationId: selectedRegistration.registration_id });
                        setSelectedRegistration(booking);
                        setRegistrationRooms(booking.rooms || []);
                    }

                    closeConfirmationDialog();
                } catch (err) {
                    console.error("Error checking out room:", err);
                    showError(String(err));
                    setConfirmationDialog((prev) => ({ ...prev, loading: false }));
                }
            },
        });
    }

    function closeConfirmationDialog() {
        setConfirmationDialog({
            isOpen: false,
            title: "",
            message: "",
            confirmText: "Confirm",
            onConfirm: null,
            loading: false,
            icon: DoorOpen,
        });
    }

    function handleOpenChangeRoom() {
        if (!contextRoom || !contextBooking) return;

        const availableRoomsList = rooms.filter((r) => r.status === "available");
        if (availableRoomsList.length === 0) {
            showError("No rooms available for change.");
            setContextMenu(null);
            return;
        }

        setChangeRoomData({
            contextRoom: contextRoom,
            contextBooking: contextBooking,
            availableRooms: availableRoomsList,
        });
        setSelectedNewRoom(availableRoomsList[0]);
        setShowChangeRoomDialog(true);
        setContextMenu(null);
    }

    async function handleConfirmChangeRoom() {
        if (!changeRoomData || !selectedNewRoom) return;

        setLoading(true);
        clearMessages();

        try {
            await invoke("change_registration_room", {
                registrationId: Number(changeRoomData.contextBooking.registration_id),
                oldRoomId: Number(changeRoomData.contextRoom.room_id),
                newRoomId: Number(selectedNewRoom.room_id),
            });

            showSuccess(`Room changed from ${changeRoomData.contextRoom.room_number} to ${selectedNewRoom.room_number}.`);
            await refreshData();

            if (showRegistrationPopup && selectedRegistration) {
                const booking = await invoke("get_booking", { registrationId: selectedRegistration.registration_id });
                setSelectedRegistration(booking);
                setRegistrationRooms(booking.rooms || []);
            }

            setShowChangeRoomDialog(false);
            setChangeRoomData(null);
            setSelectedNewRoom(null);
        } catch (err) {
            console.error("Error changing room:", err);
            showError(String(err));
        } finally {
            setLoading(false);
        }
    }

    // ============================================================
    // CREATE BOOKING
    // ============================================================

    async function handleCreateBooking(e) {
        e.preventDefault();
        clearMessages();

        if (!selectedCustomer) {
            showError("Please search and select a customer first.");
            return;
        }
        if (selectedRooms.length === 0) {
            showError("Please select at least one room.");
            return;
        }
        if (maleCount + femaleCount <= 0) {
            showError("At least one guest is required.");
            return;
        }

        setLoading(true);

        try {
            const registrationId = await invoke("create_booking", {
                customerId: Number(selectedCustomer.customer_id),
                maleCount: Number(maleCount),
                femaleCount: Number(femaleCount),
                relation,
                roomIds: selectedRooms.map((id) => Number(id)),
            });

            showSuccess(`Registered successfully.`);

            setSelectedRooms([]);
            setSelectedCustomer(null);
            setCustomerSearch("");
            setMaleCount(1);
            setFemaleCount(0);
            setRelation("Self");
            setRegistrationMode(null);
            setShowRegistrationForm(false);
            setRegistrationStep(1);

            await refreshData();
        } catch (err) {
            console.error("Error creating booking:", err);
            showError(String(err));
        } finally {
            setLoading(false);
        }
    }

    // ============================================================
    // CHECKOUT ENTIRE REGISTRATION
    // ============================================================

    async function handleCheckoutRegistration(registrationId) {
        setConfirmationDialog({
            isOpen: true,
            title: "Checkout Registration",
            message: `Are you sure you want to checkout all rooms in registration #${registrationId}?`,
            confirmText: "Checkout All",
            icon: DoorOpen,
            onConfirm: async () => {
                setConfirmationDialog((prev) => ({ ...prev, loading: true }));
                try {
                    await invoke("checkout_registration", { registrationId: Number(registrationId) });

                    showSuccess(`Registration #${registrationId} checked out successfully.`);
                    setActiveBookings((current) => current.filter((b) => b.registration_id !== Number(registrationId)));

                    if (selectedRegistration?.registration_id === Number(registrationId)) {
                        setSelectedRegistration(null);
                        setRegistrationRooms([]);
                        setShowRegistrationPopup(false);
                    }

                    await refreshData();
                    closeConfirmationDialog();
                } catch (err) {
                    console.error("Error checking out registration:", err);
                    showError(String(err));
                    setConfirmationDialog((prev) => ({ ...prev, loading: false }));
                }
            },
        });
    }

    // ============================================================
    // NAVIGATION HELPERS
    // ============================================================

    function navigateToCustomers() {
        if (onNavigate) onNavigate("customers");
    }

    // ============================================================
    // UI HANDLERS
    // ============================================================

    async function handleReservedRoomClick(room) {
        if (room.status !== "reserved") return;
        const info = getReservedRoomInfo(room.room_id);
        if (!info) return;

        try {
            const booking = await invoke("get_booking", { registrationId: Number(info.registration_id) });
            const otherRooms = booking.rooms.filter((r) => Number(r.room_id) !== Number(room.room_id));

            setCustomerPopupData({
                customer_name: booking.customer_name,
                phone_number: booking.phone_number,
                // Use the per-room counts from info (which came from roomData)
                male_count: info.male_count,
                female_count: info.female_count,
                relation: booking.relation || "Self",
                current_room: room.room_number,
                other_rooms: otherRooms,
                registration_id: booking.registration_id,
            });
            setShowCustomerPopup(true);
        } catch (err) {
            console.error("Error getting registration details:", err);
            showError(String(err));
        }
    }

    function handleRoomClick(room) {
        if (contextMenu) {
            setContextMenu(null);
            setContextRoom(null);
            setContextBooking(null);
            return;
        }

        if (room.status === "available") {
            if (registrationMode === "single" || !showRegistrationForm) {
                setSelectedRooms([Number(room.room_id)]);
                setRegistrationMode("single");
                setShowRegistrationForm(true);
                setSelectedCustomer(null);
                setCustomerSearch("");
                setRegistrationStep(1);
                clearMessages();
            } else {
                toggleRoom(room.room_id);
            }
        } else if (room.status === "reserved") {
            handleReservedRoomClick(room);
        }
    }

    // FIXED: Use per-room counts from the room object directly
    function handleRightClick(e, room) {
        e.preventDefault();
        e.stopPropagation();

        if (room.status === "reserved") {
            const info = getReservedRoomInfo(room.room_id);
            if (info) {
                setContextRoom(room);
                // Use the per-room counts from the room object
                setContextBooking({
                    ...info.booking,
                    // Override with per-room counts from the room
                    male_count: room.male_count || 0,
                    female_count: room.female_count || 0,
                    customer_name: info.customer_name,
                    registration_id: info.registration_id,
                });

                const menuWidth = 220;
                const menuHeight = 220;
                let x = e.clientX;
                let y = e.clientY;

                if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
                if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
                x = Math.max(10, x);
                y = Math.max(10, y);

                setContextMenu({ x, y });
            }
        }
    }

    useEffect(() => {
        return () => clearMessages();
    }, []);

    // Dropdown options for the "Change Room" dialog
    const changeRoomOptions = (changeRoomData?.availableRooms || []).map((r) => ({
        value: String(r.room_id),
        label: `Room ${r.room_number} • ${r.no_of_beds} bed${r.no_of_beds > 1 ? "s" : ""} • ₹${r.room_rate}/night`,
    }));

    // Loading state
    if (loading && rooms.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
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
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={confirmationDialog.isOpen}
                onClose={closeConfirmationDialog}
                onConfirm={confirmationDialog.onConfirm}
                title={confirmationDialog.title}
                message={confirmationDialog.message}
                confirmText={confirmationDialog.confirmText}
                loading={confirmationDialog.loading}
                icon={confirmationDialog.icon}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Room Registration</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage hotel room check-ins and occupancy</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setSelectedRooms([]);
                            setRegistrationMode("group");
                            setShowRegistrationForm(true);
                            setSelectedCustomer(null);
                            setCustomerSearch("");
                            setRegistrationStep(1);
                            clearMessages();
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        <Users className="w-5 h-5" />
                        <span>Group Registration</span>
                    </button>
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2">
                            <Home className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-500">Total Rooms</div>
                            <div className="text-xl font-bold text-gray-800">{rooms.length}</div>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-50 p-2">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-500">Available</div>
                            <div className="text-xl font-bold text-emerald-600">{availableRooms.length}</div>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-rose-50 p-2">
                            <User className="w-5 h-5 text-rose-600" />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-500">Occupied</div>
                            <div className="text-xl font-bold text-rose-600">{reservedRooms.length}</div>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-amber-50 p-2">
                            <Wrench className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-500">Maintenance</div>
                            <div className="text-xl font-bold text-amber-600">{maintenanceRooms.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1 max-w-md">
                    <input
                        type="text"
                        placeholder="Search rooms by number, features, or status..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="w-full sm:w-48">
                    <CustomDropdown
                        options={bedFilterOptions}
                        value={bedFilter}
                        onChange={setBedFilter}
                        placeholder="Filter by beds"
                        label=""
                    />
                </div>
            </div>

            {/* Floor Wise Room Display */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                    {Object.keys(roomsByFloor).every((floor) => roomsByFloor[floor].length === 0) ? (
                        <div className="py-12 text-center text-gray-500">
                            {searchQuery || bedFilter !== "all" ? "No rooms match your search." : "No rooms available. Please add rooms to get started."}
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {[...floors].reverse().map((floor) => {
                                const floorRooms = roomsByFloor[floor] || [];
                                if (floorRooms.length === 0) return null;
                                const FloorIcon = getFloorIcon(floor);

                                return (
                                    <div key={floor}>
                                        {/* Floor Header */}
                                        <div className="mb-4 flex items-center gap-3">
                                            <div className="rounded-lg bg-blue-50 p-1.5">
                                                <FloorIcon className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <span className="text-sm font-semibold text-gray-700">{getFloorLabel(floor)}</span>
                                            <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                                                {floorRooms.length} rooms
                                            </span>
                                        </div>

                                        {/* Rooms Grid */}
                                        <div className="flex flex-wrap gap-4">
                                            {floorRooms.map((room) => (
                                                <RoomCard
                                                    key={room.room_id}
                                                    room={room}
                                                    onClick={handleRoomClick}
                                                    onContextMenu={handleRightClick}
                                                    isSelected={selectedRooms.some((id) => Number(id) === Number(room.room_id))}
                                                    getReservedRoomInfo={getReservedRoomInfo}
                                                    getGroupColor={getGroupColor}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && contextRoom && contextBooking && (
                <div
                    ref={contextMenuRef}
                    className="fixed z-50 min-w-[200px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                        <div className="font-bold text-gray-800">Room {contextRoom.room_number}</div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <User className="w-3.5 h-3.5" />
                            {contextBooking.customer_name}
                        </div>
                        {/* Show guest counts from the room object directly */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Users className="w-3 h-3" />
                            {contextRoom.male_count || 0}M / {contextRoom.female_count || 0}F
                        </div>
                    </div>
                    <button
                        onClick={handleViewRegistration}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-blue-50 hover:text-blue-700"
                    >
                        <FileText className="w-4 h-4" />
                        View Full Registration
                    </button>
                    <button
                        onClick={handleOpenChangeRoom}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-amber-50 hover:text-amber-700"
                    >
                        <ArrowRightLeft className="w-4 h-4" />
                        Change Room
                    </button>
                    <button
                        onClick={handleCheckoutRoom}
                        className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-left text-sm transition-colors hover:bg-rose-50 hover:text-rose-700"
                    >
                        <DoorOpen className="w-4 h-4" />
                        Checkout This Room
                    </button>
                </div>
            )}

            {/* Change Room Dialog */}
            {showChangeRoomDialog && changeRoomData && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 rounded-t-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Change Room</h2>
                                    <p className="text-sm text-amber-100">From Room {changeRoomData.contextRoom.room_number}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowChangeRoomDialog(false);
                                        setChangeRoomData(null);
                                        setSelectedNewRoom(null);
                                    }}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="mb-4">
                                <CustomDropdown
                                    options={changeRoomOptions}
                                    value={selectedNewRoom ? String(selectedNewRoom.room_id) : ""}
                                    onChange={(val) => {
                                        const room = changeRoomData.availableRooms.find((r) => String(r.room_id) === val);
                                        setSelectedNewRoom(room || null);
                                    }}
                                    placeholder="Choose a room"
                                    label="Select New Room"
                                />
                            </div>

                            {selectedNewRoom && (
                                <div className="mb-4 p-3 bg-amber-50/60 border border-amber-200 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="font-bold text-gray-800">{selectedNewRoom.room_number}</div>
                                        <div className="flex items-center gap-0.5 text-sm font-semibold text-gray-700">
                                            <span className="text-xs">₹</span>
                                            {selectedNewRoom.room_rate}/night
                                        </div>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
                                        <Bed className="w-3.5 h-3.5" />
                                        {selectedNewRoom.no_of_beds} bed{selectedNewRoom.no_of_beds > 1 ? "s" : ""}
                                    </div>
                                    {parseFeatures(selectedNewRoom.features).length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {parseFeatures(selectedNewRoom.features).map((feature, idx) => (
                                                <span key={idx} className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 ring-1 ring-amber-200">
                                                    {feature}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowChangeRoomDialog(false);
                                        setChangeRoomData(null);
                                        setSelectedNewRoom(null);
                                    }}
                                    className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmChangeRoom}
                                    disabled={loading || !selectedNewRoom}
                                    className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Changing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ArrowRightLeft className="w-4 h-4" />
                                            <span>Change Room</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Details Popup */}
            {showCustomerPopup && customerPopupData && (
                <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Customer Details</h2>
                                    <p className="text-sm text-blue-100">Registration #{customerPopupData.registration_id}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowCustomerPopup(false);
                                        setCustomerPopupData(null);
                                    }}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                        <User className="w-4 h-4" /> Customer
                                    </span>
                                    <span className="font-semibold text-gray-800">{customerPopupData.customer_name}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                        <Phone className="w-4 h-4" /> Phone
                                    </span>
                                    <span className="font-semibold text-gray-800">{customerPopupData.phone_number}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                        <Users className="w-4 h-4" /> Guests
                                    </span>
                                    <span className="font-semibold text-gray-800">
                                        {customerPopupData.male_count} M / {customerPopupData.female_count} F
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                        <Fingerprint className="w-4 h-4" /> Relation
                                    </span>
                                    <span className="font-semibold text-gray-800">{customerPopupData.relation}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                        <Bed className="w-4 h-4" /> Current Room
                                    </span>
                                    <span className="font-semibold text-gray-800">{customerPopupData.current_room}</span>
                                </div>
                            </div>

                            {customerPopupData.other_rooms && customerPopupData.other_rooms.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                        <Building2 className="w-4 h-4" />
                                        Other Rooms in this Registration
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {customerPopupData.other_rooms.map((room, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium"
                                            >
                                                <Bed className="w-3 h-3" />
                                                Room {room.room_number} ({room.status})
                                                {/* Show guest counts for this room */}
                                                <span className="text-xs text-indigo-500">
                                                    {room.male_count || 0}M/{room.female_count || 0}F
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    setShowCustomerPopup(false);
                                    setCustomerPopupData(null);
                                }}
                                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Registration Form Modal - UPDATED with simplified 2-step flow */}
            {showRegistrationForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">
                                        {registrationMode === "single" ? "Single Room Check-in" : "Group Registration"}
                                    </h2>
                                    <p className="text-sm text-blue-100">
                                        {registrationMode === "single" ? "Check-in a customer to a single room" : "Register multiple rooms for a group"}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowRegistrationForm(false);
                                        setSelectedCustomer(null);
                                        setSelectedRooms([]);
                                        setRegistrationMode(null);
                                        setRegistrationStep(1);
                                        clearMessages();
                                    }}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {/* Step Indicator - Simplified to 2 steps */}
                            <div className="mb-6 flex items-center gap-2">
                                <div className={`flex items-center gap-2 ${registrationStep >= 1 ? "text-blue-600" : "text-gray-400"}`}>
                                    <span
                                        className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                                            registrationStep >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                                        }`}
                                    >
                                        1
                                    </span>
                                    <span className="font-medium">Find Customer</span>
                                </div>
                                <div className={`h-0.5 flex-1 ${registrationStep >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
                                <div className={`flex items-center gap-2 ${registrationStep >= 2 ? "text-blue-600" : "text-gray-400"}`}>
                                    <span
                                        className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                                            registrationStep >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                                        }`}
                                    >
                                        2
                                    </span>
                                    <span className="font-medium">Registration Details</span>
                                </div>
                            </div>

                            <form onSubmit={handleCreateBooking}>
                                {/* Step 1: Customer Search with immediate details */}
                                {registrationStep === 1 && (
                                    <div className="mb-6">
                                        <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
                                            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                Customer Information
                                            </h3>

                                            {!selectedCustomer ? (
                                                <div className="flex flex-col gap-3 sm:flex-row">
                                                    <input
                                                        type="text"
                                                        placeholder="Enter phone number or document ID"
                                                        value={customerSearch}
                                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                                        onKeyPress={handleCustomerSearchKeyPress}
                                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleCustomerSearch}
                                                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                                                    >
                                                        <Search className="w-4 h-4" />
                                                        <span>Search</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={navigateToCustomers}
                                                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                        <span>New Customer</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div>
                                                    {/* Customer Details Display */}
                                                    <div className="p-4 bg-white border-2 border-emerald-200 rounded-lg shadow-sm">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                                                    {selectedCustomer.name}
                                                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-normal">
                                                                        Found
                                                                    </span>
                                                                </div>
                                                                
                                                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                                        <span className="text-gray-600">{selectedCustomer.phone_number}</span>
                                                                    </div>
                                                                    {selectedCustomer.document_number && (
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <Fingerprint className="w-3.5 h-3.5 text-gray-400" />
                                                                            <span className="text-gray-600">{selectedCustomer.document_number}</span>
                                                                        </div>
                                                                    )}
                                                                    {selectedCustomer.nationality && (
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <Globe className="w-3.5 h-3.5 text-gray-400" />
                                                                            <span className="text-gray-600">{selectedCustomer.nationality}</span>
                                                                        </div>
                                                                    )}
                                                                    {selectedCustomer.email && (
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                                            </svg>
                                                                            <span className="text-gray-600">{selectedCustomer.email}</span>
                                                                        </div>
                                                                    )}
                                                                    {selectedCustomer.address && (
                                                                        <div className="flex items-center gap-2 text-sm col-span-2">
                                                                            <Home className="w-3.5 h-3.5 text-gray-400" />
                                                                            <span className="text-gray-600">{selectedCustomer.address}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedCustomer(null);
                                                                    setCustomerSearch("");
                                                                    clearMessages();
                                                                }}
                                                                className="text-sm font-medium text-rose-600 hover:text-rose-800 ml-2 flex-shrink-0"
                                                            >
                                                                Change
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Registration Details */}
                                {registrationStep === 2 && (
                                    <>
                                        {/* Customer Summary (compact) */}
                                        <div className="mb-4 p-3 bg-blue-50/80 border border-blue-200 rounded-lg">
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-blue-600" />
                                                    <span className="font-semibold text-gray-800">{selectedCustomer?.name}</span>
                                                    <span className="text-gray-400">|</span>
                                                    <span className="text-gray-600">{selectedCustomer?.phone_number}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setRegistrationStep(1)}
                                                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                >
                                                    Change Customer
                                                </button>
                                            </div>
                                        </div>

                                        {/* Guest Details */}
                                        <div className="mb-6 grid gap-4 md:grid-cols-3">
                                            <div>
                                                <CustomDropdown
                                                    options={relationOptions}
                                                    value={relation}
                                                    onChange={setRelation}
                                                    placeholder="Select relation"
                                                    label="Relation"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Male Guests
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={maleCount}
                                                    onChange={(e) => setMaleCount(Number(e.target.value))}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Female Guests
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={femaleCount}
                                                    onChange={(e) => setFemaleCount(Number(e.target.value))}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>

                                        {/* Room Selection */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                                    <Bed className="w-4 h-4" />
                                                    {registrationMode === "single" ? "Selected Room" : "Select Rooms"}
                                                </h3>
                                                <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-sm">
                                                    {selectedRooms.length} {registrationMode === "single" ? "room" : "selected"}
                                                </span>
                                            </div>

                                            {registrationMode === "single" ? (
                                                <div className="p-4 bg-blue-50/50 border-2 border-blue-300 rounded-lg">
                                                    {selectedRooms.length > 0 &&
                                                        (() => {
                                                            const room = rooms.find((r) => Number(r.room_id) === Number(selectedRooms[0]));
                                                            const features = parseFeatures(room?.features);
                                                            return (
                                                                <div>
                                                                    <div className="text-xl font-bold text-gray-800">{room?.room_number}</div>
                                                                    <div className="text-sm text-gray-600 flex items-center gap-1.5">
                                                                        <Bed className="w-3.5 h-3.5" />
                                                                        {room?.no_of_beds} beds •
                                                                        <span className="text-xs">₹</span>
                                                                        {room?.room_rate}/night
                                                                    </div>
                                                                    <div className="mt-1 text-sm text-gray-500">
                                                                        Guests: {maleCount}M / {femaleCount}F
                                                                    </div>
                                                                    {features.length > 0 && (
                                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                                            {features.map((feature, idx) => (
                                                                                <span key={idx} className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                                                                                    {feature}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                </div>
                                            ) : (
                                                <div className="p-4 border-2 border-gray-200 rounded-lg">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-sm text-gray-500">
                                                            {rooms.filter((r) => r.status === "available").length} available rooms
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedRooms([]);
                                                                showInfo("Cleared all room selections", 2000);
                                                            }}
                                                            className="text-sm text-rose-600 hover:text-rose-800"
                                                        >
                                                            Clear All
                                                        </button>
                                                    </div>
                                                    <div className="grid max-h-60 gap-3 overflow-y-auto sm:grid-cols-2">
                                                        {rooms.filter((r) => r.status === "available").length === 0 ? (
                                                            <div className="col-span-2 py-8 text-center text-gray-500">
                                                                No rooms available for selection.
                                                            </div>
                                                        ) : (
                                                            rooms
                                                                .filter((r) => r.status === "available")
                                                                .map((room) => {
                                                                    const isSelected = selectedRooms.some((id) => Number(id) === Number(room.room_id));
                                                                    const features = parseFeatures(room.features);

                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            key={room.room_id}
                                                                            onClick={() => toggleRoom(room.room_id)}
                                                                            className={`p-3 border-2 rounded-lg text-left transition-all ${
                                                                                isSelected
                                                                                    ? "border-blue-500 bg-blue-50 shadow-md"
                                                                                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-lg font-bold text-gray-800">{room.room_number}</span>
                                                                                {isSelected ? (
                                                                                    <span className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                                                                                        <Check className="w-3 h-3" />
                                                                                        Selected
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium">
                                                                                        Available
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="mt-1 text-sm text-gray-600 flex items-center gap-1.5">
                                                                                <Bed className="w-3.5 h-3.5" />
                                                                                {room.no_of_beds} beds •
                                                                                <span className="text-xs">₹</span>
                                                                                {room.room_rate}/night
                                                                            </div>
                                                                            {isSelected && (
                                                                                <div className="mt-1 text-xs text-gray-500">
                                                                                    Guests: {maleCount}M / {femaleCount}F (per room)
                                                                                </div>
                                                                            )}
                                                                            {features.length > 0 && (
                                                                                <div className="mt-2 flex flex-wrap gap-1">
                                                                                    {features.slice(0, 4).map((feature, idx) => (
                                                                                        <span key={idx} className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                                                                                            {feature}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Navigation Buttons - Simplified for 2 steps */}
                                <div className="flex gap-3">
                                    {registrationStep === 1 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (selectedCustomer) setRegistrationStep(2);
                                                    else showError("Please search and select a customer first.");
                                                }}
                                                disabled={!selectedCustomer}
                                                className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <span>Next Step →</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowRegistrationForm(false);
                                                    setSelectedCustomer(null);
                                                    setSelectedRooms([]);
                                                    setRegistrationMode(null);
                                                    setRegistrationStep(1);
                                                    clearMessages();
                                                }}
                                                className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                    {registrationStep === 2 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setRegistrationStep(1)}
                                                className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                ← Back
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={loading || !selectedCustomer || selectedRooms.length === 0}
                                                className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loading ? (
                                                    <>
                                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        <span>Processing...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="w-4 h-4" />
                                                        <span>{registrationMode === "single" ? "Check-in" : "Create Registration"}</span>
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowRegistrationForm(false);
                                                    setSelectedCustomer(null);
                                                    setSelectedRooms([]);
                                                    setRegistrationMode(null);
                                                    setRegistrationStep(1);
                                                    clearMessages();
                                                }}
                                                className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Registration Details Popup */}
            {showRegistrationPopup && selectedRegistration && (
                <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto">
                        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">
                                        Registration #{selectedRegistration.registration_id}
                                    </h2>
                                    <p className="text-sm text-blue-100 flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5" />
                                        {selectedRegistration.customer_name}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowRegistrationPopup(false);
                                        setSelectedRegistration(null);
                                        setRegistrationRooms([]);
                                    }}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        <div className="p-5">
                            {/* Customer Info */}
                            <div className="mb-4 grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm md:grid-cols-4">
                                <div>
                                    <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                        <User className="w-3 h-3" /> Customer
                                    </div>
                                    <div className="font-semibold text-gray-800 truncate">{selectedRegistration.customer_name}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> Phone
                                    </div>
                                    <div className="font-semibold text-gray-800">{selectedRegistration.phone_number}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                        <Users className="w-3 h-3" /> Guests
                                    </div>
                                    <div className="font-semibold text-gray-800">
                                        {selectedRegistration.male_count} M / {selectedRegistration.female_count} F
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                        <Fingerprint className="w-3 h-3" /> Relation
                                    </div>
                                    <div className="font-semibold text-gray-800">{selectedRegistration.relation || "Self"}</div>
                                </div>
                            </div>

                            {/* Room Assignments */}
                            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <Bed className="w-4 h-4" />
                                Room Assignments ({registrationRooms.length})
                            </h3>
                            <div className="mb-4 max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
                                {registrationRooms.map((room) => {
                                    const roomData = rooms.find((r) => Number(r.room_id) === Number(room.room_id));

                                    return (
                                        <div key={room.id} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-gray-50">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                                                    <Bed className="w-4 h-4 text-gray-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-gray-800">Room {room.room_number}</span>
                                                        <span
                                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                                room.status === "active"
                                                                    ? "bg-emerald-100 text-emerald-700"
                                                                    : "bg-gray-100 text-gray-600"
                                                            }`}
                                                        >
                                                            {room.status}
                                                        </span>
                                                    </div>
                                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {formatDate(room.check_in)}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{roomData?.no_of_beds || 0} beds</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-0.5">
                                                            <span className="text-xs">₹</span>
                                                            {roomData?.room_rate || 0}/night
                                                        </span>
                                                        <span>•</span>
                                                        <span className="text-gray-400">
                                                            {room.male_count || 0}M / {room.female_count || 0}F
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            {room.status === "active" && (
                                                <button
                                                    onClick={() => handleCheckoutSingleRoom(room)}
                                                    className="flex-shrink-0 p-1.5 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                                    title="Checkout this room"
                                                >
                                                    <DoorOpen className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Checkout All */}
                            {selectedRegistration.status === "active" && registrationRooms.length > 0 && (
                                <button
                                    onClick={() => handleCheckoutRegistration(selectedRegistration.registration_id)}
                                    className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-md hover:shadow-lg"
                                >
                                    <DoorOpen className="w-4 h-4" />
                                    Checkout All Rooms ({registrationRooms.filter((r) => r.status === "active").length})
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}