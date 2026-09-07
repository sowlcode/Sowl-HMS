import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    Plus,
    X,
    Check,
    Edit,
    Trash2,
    Search,
    Package,
    Image,
    Coffee,
    Utensils,
    Shirt,
    Car,
    MoreHorizontal,
    AlertCircle,
    Upload,
    FolderOpen,
} from "lucide-react";

// ============================================================
// SHARED UI PRIMITIVES
// ============================================================

// Confirmation Dialog Component - RED THEME
function ConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    loading = false,
    icon: Icon = Trash2,
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
                        ⚠️ This action cannot be undone. All data associated with this item will be permanently removed.
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
                                    <span>Deleting...</span>
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

// Add Stock Modal Component - BLUE THEME
function AddStockModal({
    isOpen,
    onClose,
    onConfirm,
    serviceName,
    currentStock,
    loading = false,
}) {
    const [quantity, setQuantity] = useState("");
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        setError("");

        const qty = Number(quantity);
        if (!Number.isInteger(qty) || qty <= 0) {
            setError("Please enter a valid positive number");
            return;
        }

        onConfirm(qty);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            Add Stock
                        </h2>
                        <p className="text-sm text-blue-100">
                            For: <span className="font-medium">{serviceName}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white"
                        disabled={loading}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">
                                Current Stock
                            </label>
                            <span className="text-sm font-semibold text-gray-900">
                                {currentStock} units
                            </span>
                        </div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity to Add
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder="Enter quantity"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                            min="1"
                            step="1"
                            disabled={loading}
                            autoFocus
                        />
                        {error && (
                            <p className="mt-1 text-sm text-red-600">{error}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                            Enter how many units you want to add to the current stock.
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Adding...</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    <span>Add Stock</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Category icon mapping
const CATEGORY_ICONS = {
    Food: Utensils,
    Drinks: Coffee,
    Laundry: Shirt,
    Transport: Car,
    Other: MoreHorizontal,
};

const CATEGORY_COLORS = {
    Food: "from-orange-500 to-amber-600",
    Drinks: "from-blue-500 to-cyan-600",
    Laundry: "from-purple-500 to-indigo-600",
    Transport: "from-emerald-500 to-teal-600",
    Other: "from-gray-500 to-gray-600",
};

const CATEGORY_BADGE_COLORS = {
    Food: "bg-orange-100 text-orange-700 border-orange-200",
    Drinks: "bg-blue-100 text-blue-700 border-blue-200",
    Laundry: "bg-purple-100 text-purple-700 border-purple-200",
    Transport: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Other: "bg-gray-100 text-gray-700 border-gray-200",
};

// Categories for filter tabs
const CATEGORIES = [
    { value: "all", label: "All", icon: Package },
    { value: "Food", label: "Food", icon: Utensils },
    { value: "Drinks", label: "Drinks", icon: Coffee },
    { value: "Laundry", label: "Laundry", icon: Shirt },
    { value: "Transport", label: "Transport", icon: Car },
    { value: "Other", label: "Other", icon: MoreHorizontal },
];

// Categories for form
const FORM_CATEGORIES = [
    { value: "Food", label: "Food", icon: Utensils },
    { value: "Drinks", label: "Drinks", icon: Coffee },
    { value: "Laundry", label: "Laundry", icon: Shirt },
    { value: "Transport", label: "Transport", icon: Car },
    { value: "Other", label: "Other", icon: MoreHorizontal },
];

export default function FoodServicesPage() {
    // ============================================================
    // STATE
    // ============================================================

    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [form, setForm] = useState({
        service_name: "",
        category: "",
        service_charge: "",
        stock: "",
        picture: null,
        picturePreview: null,
        is_inventory: false,
    });
    const [formErrors, setFormErrors] = useState({});
    const [editingId, setEditingId] = useState(null);
    const fileInputRef = useRef(null);

    // ============================================================
    // EFFECT TO CLEAR STOCK WHEN INVENTORY IS UNCHECKED
    // ============================================================

    useEffect(() => {
        // If is_inventory is unchecked, clear stock value
        if (!form.is_inventory && form.stock !== "") {
            setForm(prev => ({
                ...prev,
                stock: ""
            }));
            // Clear stock error if it exists
            if (formErrors.stock) {
                setFormErrors(prev => ({ ...prev, stock: "" }));
            }
        }
    }, [form.is_inventory]);

    // Confirmation Dialog
    const [confirmationDialog, setConfirmationDialog] = useState({
        isOpen: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        onConfirm: null,
        loading: false,
        icon: Trash2,
    });

    // Stock Modal
    const [stockModal, setStockModal] = useState({
        isOpen: false,
        service: null,
        loading: false,
    });

    // Messages system
    const [messages, setMessages] = useState([]);
    const [uploadMessage, setUploadMessage] = useState("");

    // ============================================================
    // MESSAGE FUNCTIONS
    // ============================================================

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
    // LOAD SERVICES
    // ============================================================

    const loadServices = async () => {
        try {
            setLoading(true);
            const result = await invoke("get_food_services");
            setServices(result || []);
        } catch (error) {
            console.error(error);
            showError("Failed to load services. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadServices();
        return () => clearMessages();
    }, []);

    // ============================================================
    // FORM HANDLING
    // ============================================================

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
        // Clear error for this field when user starts typing
        if (formErrors[name]) {
            setFormErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const handleCategorySelect = (category) => {
        setForm((prev) => ({
            ...prev,
            category: category,
        }));
        if (formErrors.category) {
            setFormErrors((prev) => ({ ...prev, category: "" }));
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check file size
            if (file.size > 5 * 1024 * 1024) {
                setUploadMessage("❌ Image size must be less than 5MB");
                showError("Image size must be less than 5MB");
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
                return;
            }

            // Check file type
            if (!file.type.startsWith("image/")) {
                setUploadMessage("❌ Please select a valid image file (PNG, JPG, GIF)");
                showError("Please select a valid image file");
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
                return;
            }

            setUploadMessage("✅ Image uploaded successfully!");

            const reader = new FileReader();
            reader.onloadend = () => {
                setForm((prev) => ({
                    ...prev,
                    picture: file,
                    picturePreview: reader.result,
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setForm({
            service_name: "",
            category: "",
            service_charge: "",
            stock: "",
            picture: null,
            picturePreview: null,
            is_inventory: false,
        });
        setFormErrors({});
        setShowForm(false);
        setUploadMessage("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleEdit = (service) => {
        setEditingId(service.service_id);
        setForm({
            service_name: service.service_name,
            category: service.category,
            service_charge: String(service.service_charge),
            stock: service.stock === null ? "" : String(service.stock),
            picture: null,
            picturePreview: service.picture || null,
            is_inventory: service.is_inventory || false,
        });
        setFormErrors({});
        setUploadMessage("");
        setShowForm(true);
        document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" });
    };

    const openAddForm = () => {
        resetForm();
        setEditingId(null);
        setForm({
            service_name: "",
            category: "",
            service_charge: "",
            stock: "",
            picture: null,
            picturePreview: null,
            is_inventory: false,
        });
        setFormErrors({});
        setUploadMessage("");
        setShowForm(true);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" });
    };

    // ============================================================
    // VALIDATION
    // ============================================================

    const validateForm = () => {
        const errors = {};

        if (!form.service_name.trim()) {
            errors.service_name = "Please enter a service name";
        }

        if (!form.category) {
            errors.category = "Please select a category";
        }

        if (!form.service_charge || form.service_charge.trim() === "") {
            errors.service_charge = "Please enter a service charge";
        } else {
            const serviceCharge = Number(form.service_charge);
            if (isNaN(serviceCharge) || serviceCharge < 0) {
                errors.service_charge = "Please enter a valid amount (0 or more)";
            }
        }

        // Validate stock based on is_inventory
        if (form.is_inventory) {
            if (!form.stock || form.stock.trim() === "") {
                errors.stock = "Stock is required for inventory items";
            } else {
                const stock = Number(form.stock);
                if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
                    errors.stock = "Please enter a valid whole number (0 or more)";
                }
            }
        } else {
            // If not inventory, stock should be empty
            if (form.stock && form.stock.trim() !== "") {
                errors.stock = "Non-inventory items cannot have stock. Uncheck the inventory box or clear stock.";
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // ============================================================
    // SUBMIT HANDLING
    // ============================================================

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearMessages();

        if (!validateForm()) {
            // Show user-friendly error message
            const errorMessages = Object.values(formErrors);
            if (errorMessages.length > 0) {
                showError(errorMessages[0]);
            }
            return;
        }

        const serviceCharge = Number(form.service_charge);
        let stock = null;
        if (form.is_inventory && form.stock.trim() !== "") {
            stock = Number(form.stock);
        }

        let pictureData = null;
        if (form.picture) {
            try {
                const reader = new FileReader();
                const base64 = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(form.picture);
                });
                pictureData = base64;
            } catch (error) {
                showError("Failed to process the image. Please try again.");
                return;
            }
        } else if (form.picturePreview && !editingId) {
            pictureData = form.picturePreview;
        }

        try {
            setLoading(true);

            if (editingId !== null) {
                await invoke("update_food_service", {
                    request: {
                        service_id: editingId,
                        service_name: form.service_name,
                        category: form.category,
                        service_charge: serviceCharge,
                        stock: stock,
                        picture: pictureData || form.picturePreview,
                        is_inventory: form.is_inventory,
                    },
                });
                showSuccess(`"${form.service_name}" has been updated successfully!`);
            } else {
                await invoke("add_food_service", {
                    request: {
                        service_name: form.service_name,
                        category: form.category,
                        service_charge: serviceCharge,
                        stock: stock,
                        picture: pictureData,
                        is_inventory: form.is_inventory,
                    },
                });
                showSuccess(`"${form.service_name}" has been added successfully!`);
            }

            resetForm();
            await loadServices();
        } catch (error) {
            console.error(error);
            showError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // STOCK HANDLING
    // ============================================================

    const handleAddStock = (service) => {
        // Only allow stock addition for inventory items
        if (!service.is_inventory) {
            showError("This service does not support stock tracking");
            return;
        }
        setStockModal({
            isOpen: true,
            service: service,
            loading: false,
        });
    };

    const handleStockConfirm = async (quantity) => {
        const service = stockModal.service;
        if (!service) return;

        setStockModal(prev => ({ ...prev, loading: true }));

        try {
            await invoke("add_food_service_stock", {
                request: {
                    service_id: service.service_id,
                    quantity: quantity,
                },
            });
            showSuccess(`Added ${quantity} units to "${service.service_name}" stock!`);
            await loadServices();
            setStockModal({
                isOpen: false,
                service: null,
                loading: false,
            });
        } catch (error) {
            console.error(error);
            showError("Failed to add stock. Please try again.");
            setStockModal(prev => ({ ...prev, loading: false }));
        }
    };

    // ============================================================
    // REMOVE HANDLING
    // ============================================================

    const handleRemove = (serviceId, serviceName) => {
        setConfirmationDialog({
            isOpen: true,
            title: "Remove Service",
            message: `Are you sure you want to remove "${serviceName}"?`,
            confirmText: "Remove",
            icon: Trash2,
            onConfirm: async () => {
                setConfirmationDialog((prev) => ({ ...prev, loading: true }));
                try {
                    await invoke("delete_food_service", { serviceId: serviceId });
                    showSuccess(`"${serviceName}" has been removed from your inventory.`);
                    await loadServices();
                    closeConfirmationDialog();
                } catch (error) {
                    console.error(error);
                    showError("Failed to remove the service. Please try again.");
                    setConfirmationDialog((prev) => ({ ...prev, loading: false }));
                }
            },
        });
    };

    const closeConfirmationDialog = () => {
        setConfirmationDialog({
            isOpen: false,
            title: "",
            message: "",
            confirmText: "Confirm",
            onConfirm: null,
            loading: false,
            icon: Trash2,
        });
    };

    // ============================================================
    // COMPUTED VALUES
    // ============================================================

    const filteredServices = services.filter((service) => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
            service.service_name.toLowerCase().includes(searchLower) ||
            service.category.toLowerCase().includes(searchLower);

        const matchesCategory = categoryFilter === "all" || service.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    // Stats - only show categories with non-zero items
    const totalItems = services.length;
    const categoryStats = services.reduce((acc, s) => {
        acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
    }, {});

    const visibleCategories = FORM_CATEGORIES.filter(({ value }) => categoryStats[value] > 0);

    // ============================================================
    // UI
    // ============================================================

    return (
        <div className="p-6 max-w-7xl mx-auto relative">
            {/* Messages Display */}
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

            {/* Stock Addition Modal */}
            <AddStockModal
                isOpen={stockModal.isOpen}
                onClose={() => setStockModal({ isOpen: false, service: null, loading: false })}
                onConfirm={handleStockConfirm}
                serviceName={stockModal.service?.service_name || ""}
                currentStock={stockModal.service?.stock || 0}
                loading={stockModal.loading}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Food & Services</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage food items and services offered</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={openAddForm}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add New Item</span>
                    </button>
                </div>
            </div>

            {/* Stats Dashboard - Only show categories with items */}
            {totalItems > 0 && (
                <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-50 p-2">
                                <Package className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-500">Total Items</div>
                                <div className="text-xl font-bold text-gray-800">{totalItems}</div>
                            </div>
                        </div>
                    </div>
                    {visibleCategories.map(({ value, label, icon: Icon }) => {
                        const count = categoryStats[value] || 0;
                        const colorClass = CATEGORY_COLORS[value] || "from-gray-500 to-gray-600";
                        return (
                            <div key={value} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`rounded-lg bg-gradient-to-br ${colorClass} p-2`}>
                                        <Icon className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-medium text-gray-500">{label}</div>
                                        <div className="text-xl font-bold text-gray-800">{count}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Search and Filter Bar with Category Tabs */}
            <div className="mb-6">
                <div className="flex flex-col gap-3">
                    <div className="relative max-w-md">
                        <input
                            type="text"
                            placeholder="Search by name or category..."
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

                    {/* Category Filter Tabs */}
                    <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                onClick={() => setCategoryFilter(value)}
                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${categoryFilter === value
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon className={`w-4 h-4 ${categoryFilter === value ? 'text-blue-500' : 'text-gray-400'}`} />
                                {label}
                                {value !== "all" && (
                                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${categoryFilter === value
                                        ? 'bg-blue-100 text-blue-600'
                                        : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {categoryStats[value] || 0}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Form Section - Hidden by default */}
            {showForm && (
                <div id="form-section" className="mb-6">
                    <form
                        onSubmit={handleSubmit}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                    >
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                        {editingId ? (
                                            <>
                                                <Edit className="w-5 h-5" />
                                                Update Item
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-5 h-5" />
                                                Add New Item
                                            </>
                                        )}
                                    </h2>
                                    <p className="text-sm text-white/80">
                                        {editingId ? "Update the details of the selected item" : "Enter the details of the new item"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Service Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="service_name"
                                        placeholder="Enter service name"
                                        value={form.service_name}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.service_name ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                    />
                                    {formErrors.service_name && (
                                        <p className="mt-1 text-sm text-red-500">{formErrors.service_name}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {FORM_CATEGORIES.map(({ value, label, icon: Icon }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => handleCategorySelect(value)}
                                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 transition-all duration-200 ${form.category === value
                                                    ? `border-blue-500 bg-blue-50 text-blue-700 shadow-sm`
                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <Icon className={`w-4 h-4 ${form.category === value ? 'text-blue-500' : 'text-gray-400'}`} />
                                                <span className="text-sm font-medium">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {formErrors.category && (
                                        <p className="mt-1 text-sm text-red-500">{formErrors.category}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Service Charge (NPR) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="service_charge"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={form.service_charge}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.service_charge ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                    />
                                    {formErrors.service_charge && (
                                        <p className="mt-1 text-sm text-red-500">{formErrors.service_charge}</p>
                                    )}
                                </div>

                                {/* Inventory Checkbox */}
                                <div className="flex items-center">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="is_inventory"
                                            checked={form.is_inventory}
                                            onChange={handleChange}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">
                                            This is an inventory item (track stock)
                                        </span>
                                    </label>
                                </div>

                                {/* Stock Field - Only shown when is_inventory is true */}
                                {form.is_inventory && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Initial Stock <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="stock"
                                            type="number"
                                            min="0"
                                            placeholder="Enter initial stock quantity"
                                            value={form.stock}
                                            onChange={handleChange}
                                            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.stock ? 'border-red-500' : 'border-gray-300'
                                                }`}
                                        />
                                        {formErrors.stock && (
                                            <p className="mt-1 text-sm text-red-500">{formErrors.stock}</p>
                                        )}
                                        <p className="mt-1 text-xs text-gray-500">Enter the initial quantity available</p>
                                    </div>
                                )}

                                {!form.is_inventory && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Stock
                                        </label>
                                        <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500">
                                            Not tracked (service only)
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">This item will not have stock tracking</p>
                                    </div>
                                )}

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Upload Image
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <div className="relative">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors min-h-[120px] flex flex-col items-center justify-center">
                                                    <FolderOpen className="w-10 h-10 text-gray-400 mb-2" />
                                                    <p className="text-sm text-gray-500 font-medium">
                                                        Click to browse
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        PNG, JPG, GIF up to 5MB
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Upload Status Message */}
                                            {uploadMessage && (
                                                <div className={`mt-2 p-2 rounded-lg text-sm font-medium ${uploadMessage.includes('✅')
                                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                                    : 'bg-red-50 text-red-700 border border-red-200'
                                                    }`}>
                                                    {uploadMessage}
                                                </div>
                                            )}
                                        </div>

                                        {/* Image Preview - Larger */}
                                        {form.picturePreview && (
                                            <div className="relative">
                                                <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                                                    <img
                                                        src={form.picturePreview}
                                                        alt="Preview"
                                                        className="w-full h-48 object-contain"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                picture: null,
                                                                picturePreview: null,
                                                            }));
                                                            setUploadMessage("");
                                                            if (fileInputRef.current) {
                                                                fileInputRef.current.value = "";
                                                            }
                                                        }}
                                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-400 text-center">Image Preview</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                            <span>{editingId ? "Update Item" : "Add Item"}</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Items Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Package className="w-5 h-5 text-gray-500" />
                        Items
                        <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-sm font-medium">
                            {filteredServices.length}
                        </span>
                    </h2>
                    {filteredServices.length > 0 && (
                        <span className="text-sm text-gray-400">
                            Showing {filteredServices.length} of {services.length}
                        </span>
                    )}
                </div>

                <div className="p-6">
                    {loading && services.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
                                <p className="mt-4 text-gray-600">Loading services...</p>
                            </div>
                        </div>
                    ) : filteredServices.length === 0 ? (
                        <div className="py-12 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                                <Package className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500">
                                {searchQuery || categoryFilter !== "all"
                                    ? "No items match your search criteria."
                                    : "No food or services found. Add your first item above!"}
                            </p>
                            {(searchQuery || categoryFilter !== "all") && (
                                <button
                                    onClick={() => {
                                        setSearchQuery("");
                                        setCategoryFilter("all");
                                    }}
                                    className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredServices.map((service) => {
                                const Icon = CATEGORY_ICONS[service.category] || MoreHorizontal;
                                const badgeColor = CATEGORY_BADGE_COLORS[service.category] || "bg-gray-100 text-gray-700 border-gray-200";
                                const hasStock = service.stock !== null && service.is_inventory;
                                const isLowStock = hasStock && service.stock <= 5;

                                return (
                                    <div
                                        key={service.service_id}
                                        className="group rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                                    >
                                        {/* Image with border */}
                                        <div className="p-2 pb-0">
                                            {service.picture ? (
                                                <div className="relative h-48 overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-100">
                                                    <img
                                                        src={service.picture}
                                                        alt={service.service_name}
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                        onError={(e) => {
                                                            e.target.style.display = "none";
                                                            e.target.parentElement.innerHTML = `
                                <div class="flex items-center justify-center h-full bg-gray-50 rounded-lg">
                                  <div class="text-center">
                                    <Image class="w-12 h-12 text-gray-300 mx-auto" />
                                    <p class="text-sm text-gray-400 mt-2">Image not found</p>
                                  </div>
                                </div>
                              `;
                                                        }}
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                                                </div>
                                            ) : (
                                                <div className="h-48 rounded-lg border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                                                    <div className="text-center">
                                                        <Image className="w-12 h-12 text-gray-300 mx-auto" />
                                                        <p className="text-sm text-gray-400 mt-2">No image</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4">
                                            {/* Category Badge and Inventory Badge */}
                                            <div className="flex items-start justify-between mb-2">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeColor}`}>
                                                    <Icon className="w-3.5 h-3.5" />
                                                    {service.category}
                                                </span>
                                                <div className="flex gap-1">
                                                    {service.is_inventory && (
                                                        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                            <Package className="w-3 h-3 mr-1" />
                                                            Inventory
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Name */}
                                            <h3 className="text-base font-semibold text-gray-800 truncate">
                                                {service.service_name}
                                            </h3>

                                            {/* Price */}
                                            <div className="mt-1 flex items-center gap-1 text-lg font-bold text-gray-900">
                                                <span className="text-sm font-normal text-gray-500">NPR</span>
                                                {service.service_charge}
                                                <span className="text-sm font-normal text-gray-400">/unit</span>
                                            </div>

                                            {/* Stock - Only show for inventory items */}
                                            <div className="mt-2 flex items-center gap-1.5 text-sm">
                                                <Package className="w-4 h-4 text-gray-400" />
                                                <span className={hasStock ? "text-gray-700" : "text-gray-400"}>
                                                    {service.is_inventory ? (
                                                        hasStock ? (
                                                            <>
                                                                Stock: <span className="font-medium">{service.stock}</span>
                                                            </>
                                                        ) : (
                                                            "No stock"
                                                        )
                                                    ) : (
                                                        "Service only"
                                                    )}
                                                </span>
                                            </div>

                                            {/* Actions */}
                                            <div className="mt-4 pt-4 border-t border-gray-100">
                                                <div className={`grid ${service.is_inventory ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                                                    {service.is_inventory && (
                                                        <button
                                                            onClick={() => handleAddStock(service)}
                                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                                                        >
                                                            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                                                            <span>Stock</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleEdit(service)}
                                                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                                    >
                                                        <Edit className="w-3.5 h-3.5 flex-shrink-0" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemove(service.service_id, service.service_name)}
                                                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                                                        <span>Remove</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}