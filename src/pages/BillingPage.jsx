// BillingPage.jsx
import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Receipt,
  User,
  Phone,
  Bed,
  Clock,
  IndianRupee,
  Search,
  X,
  Check,
  Package,
  Coffee,
  Utensils,
  ShoppingBag,
  AlertCircle,
  RefreshCw,
  FileText,
  ChevronDown,
} from "lucide-react";

// ============================================================
// CUSTOM DROPDOWN COMPONENT
// ============================================================

function CustomDropdown({ options, value, onChange, placeholder, label, error }) {
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
          error ? "border-red-500" : "border-gray-300"
        }`}
      >
        <span className={selectedOption ? "text-gray-900" : "text-gray-500"}>
          {displayLabel}
        </span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
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
                option.value === value ? "bg-blue-50 text-blue-600" : "text-gray-700"
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

// ============================================================
// CONFIRMATION DIALOG
// ============================================================

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

// ============================================================
// MAIN BILLING PAGE COMPONENT
// ============================================================

export default function BillingPage({ registrationId, onBack, session }) {
  // ============================================================
  // STATE
  // ============================================================

  const [bill, setBill] = useState(null);
  const [registrationInfo, setRegistrationInfo] = useState(null);
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Add item states
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemType, setAddItemType] = useState("service");
  const [selectedService, setSelectedService] = useState(null);
  const [customItemName, setCustomItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnitPrice, setItemUnitPrice] = useState(0);
  const [serviceSearch, setServiceSearch] = useState("");

  // Return item states
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItem, setReturnItem] = useState(null);
  const [returnQuantity, setReturnQuantity] = useState(1);

  // Confirmation dialog
  const [confirmationDialog, setConfirmationDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    onConfirm: null,
    loading: false,
    icon: Trash2,
  });

  // Messages
  const [messages, setMessages] = useState([]);

  // Categories for filtering
  const categories = ["all", "Food", "Beverage", "Snacks", "Other"];

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

  const showSuccess = (text, duration = 5000) => addMessage(text, "success", duration);
  const showError = (text, duration = 5000) => addMessage(text, "error", duration);
  const showInfo = (text, duration = 5000) => addMessage(text, "info", duration);

  const clearMessages = () => setMessages([]);

  // ============================================================
  // LOAD DATA
  // ============================================================

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationId]);

  async function loadData() {
    try {
      setLoading(true);
      clearMessages();

      const [billData, servicesData, regInfo] = await Promise.all([
        invoke("get_registration_bill", { registrationId: Number(registrationId) }),
        invoke("get_food_services"),
        getRegistrationInfo(),
      ]);

      setBill(billData);
      setServices(servicesData || []);
      setFilteredServices(servicesData || []);
      setRegistrationInfo(regInfo);
    } catch (err) {
      console.error("Error loading billing data:", err);
      showError(`Failed to load billing data: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function getRegistrationInfo() {
    try {
      // Get registration details
      const booking = await invoke("get_booking", { registrationId: Number(registrationId) });
      return booking;
    } catch (err) {
      console.error("Error getting registration info:", err);
      return null;
    }
  }

  async function refreshData() {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }

  // ============================================================
  // SERVICE FILTERING
  // ============================================================

  useEffect(() => {
    let filtered = services;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((s) => s.category === selectedCategory);
    }

    // Filter by search
    if (serviceSearch.trim()) {
      const query = serviceSearch.toLowerCase().trim();
      filtered = filtered.filter((s) =>
        s.service_name.toLowerCase().includes(query)
      );
    }

    setFilteredServices(filtered);
  }, [services, selectedCategory, serviceSearch]);

  // ============================================================
  // ADD SERVICE TO BILL
  // ============================================================

  async function handleAddService() {
    if (!selectedService) {
      showError("Please select a service");
      return;
    }

    if (itemQuantity <= 0) {
      showError("Quantity must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      clearMessages();

      const billId = await invoke("add_service_to_registration", {
        request: {
          registration_id: Number(registrationId),
          service_id: Number(selectedService.service_id),
          quantity: Number(itemQuantity),
        },
      });

      showSuccess(`Added ${selectedService.service_name} to bill`);
      setShowAddItemModal(false);
      resetAddItemForm();
      await refreshData();
    } catch (err) {
      console.error("Error adding service:", err);
      showError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // ADD CUSTOM ITEM TO BILL
  // ============================================================

  async function handleAddCustomItem() {
    if (!customItemName.trim()) {
      showError("Please enter an item name");
      return;
    }

    if (itemQuantity <= 0) {
      showError("Quantity must be greater than 0");
      return;
    }

    if (itemUnitPrice < 0) {
      showError("Unit price cannot be negative");
      return;
    }

    try {
      setLoading(true);
      clearMessages();

      const billId = await invoke("add_custom_bill_item", {
        request: {
          registration_id: Number(registrationId),
          item_name: customItemName.trim(),
          quantity: Number(itemQuantity),
          unit_price: Number(itemUnitPrice),
        },
      });

      showSuccess(`Added ${customItemName} to bill`);
      setShowAddItemModal(false);
      resetAddItemForm();
      await refreshData();
    } catch (err) {
      console.error("Error adding custom item:", err);
      showError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // RETURN SERVICE ITEM
  // ============================================================

  async function handleReturnItem() {
    if (!returnItem) return;

    if (returnQuantity <= 0) {
      showError("Return quantity must be greater than 0");
      return;
    }

    if (returnQuantity > returnItem.quantity) {
      showError(`Cannot return more than ${returnItem.quantity} items`);
      return;
    }

    try {
      setLoading(true);
      clearMessages();

      await invoke("return_service_quantity", {
        request: {
          bill_id: Number(returnItem.bill_id),
          quantity: Number(returnQuantity),
        },
      });

      showSuccess(`Returned ${returnQuantity} ${returnItem.item_name || "item"}(s)`);
      setShowReturnModal(false);
      setReturnItem(null);
      setReturnQuantity(1);
      await refreshData();
    } catch (err) {
      console.error("Error returning item:", err);
      showError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // DELETE CUSTOM ITEM
  // ============================================================

  async function handleDeleteCustomItem(item) {
    setConfirmationDialog({
      isOpen: true,
      title: "Delete Item",
      message: `Are you sure you want to delete "${item.item_name}" from the bill?`,
      confirmText: "Delete",
      icon: Trash2,
      onConfirm: async () => {
        setConfirmationDialog((prev) => ({ ...prev, loading: true }));
        try {
          await invoke("delete_custom_bill_item", {
            billId: Number(item.bill_id),
          });

          showSuccess(`Deleted ${item.item_name} from bill`);
          await refreshData();
          closeConfirmationDialog();
        } catch (err) {
          console.error("Error deleting item:", err);
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
      icon: Trash2,
    });
  }

  // ============================================================
  // FORM HELPERS
  // ============================================================

  function resetAddItemForm() {
    setAddItemType("service");
    setSelectedService(null);
    setCustomItemName("");
    setItemQuantity(1);
    setItemUnitPrice(0);
    setServiceSearch("");
  }

  function openAddItemModal() {
    resetAddItemForm();
    setShowAddItemModal(true);
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
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
  // RENDER
  // ============================================================

  if (loading && !bill) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      {/* Messages */}
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-blue-600" />
              Billing
            </h1>
            <p className="text-sm text-gray-500">
              Registration #{registrationId} • {registrationInfo?.customer_name || "Loading..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Registration Info Cards */}
      {registrationInfo && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Customer</div>
                <div className="text-sm font-semibold text-gray-800">{registrationInfo.customer_name}</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Phone</div>
                <div className="text-sm font-semibold text-gray-800">{registrationInfo.phone_number}</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-50 p-2">
                <Bed className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Rooms</div>
                <div className="text-sm font-semibold text-gray-800">
                  {registrationInfo.rooms?.length || 0} room(s)
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Check-in</div>
                <div className="text-sm font-semibold text-gray-800">
                  {formatDate(registrationInfo.check_in)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bill Items Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Bill Items
            </h2>
            <button
              onClick={openAddItemModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </button>
          </div>

          {bill?.items?.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Receipt className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p>No items added to this bill yet.</p>
              <p className="text-sm">Click "Add Item" to start billing.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bill?.items?.map((item) => (
                    <tr key={item.bill_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.item_type === "service" ? (
                            item.is_inventory ? (
                              <Package className="w-4 h-4 text-blue-500" />
                            ) : (
                              <Coffee className="w-4 h-4 text-purple-500" />
                            )
                          ) : (
                            <ShoppingBag className="w-4 h-4 text-amber-500" />
                          )}
                          <span className="font-medium text-gray-800">
                            {item.item_name || `Service #${item.service_id}`}
                          </span>
                          {item.item_type === "service" && item.is_inventory && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              Inventory
                            </span>
                          )}
                          {item.item_type === "custom" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              Custom
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Added: {formatDate(item.added_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {item.item_type}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.item_type === "service" && (
                            <button
                              onClick={() => {
                                setReturnItem(item);
                                setReturnQuantity(1);
                                setShowReturnModal(true);
                              }}
                              className="p-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Return item"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          )}
                          {item.item_type === "custom" && (
                            <button
                              onClick={() => handleDeleteCustomItem(item)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan="4" className="px-4 py-3 text-right font-semibold text-gray-700">
                      Subtotal
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      {formatCurrency(bill?.subtotal || 0)}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                  <tr className="bg-blue-50/50">
                    <td colSpan="4" className="px-4 py-3 text-right font-bold text-gray-800 text-lg">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600 text-lg">
                      {formatCurrency(bill?.total || 0)}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Add Item to Bill</h2>
                  <p className="text-sm text-blue-100">Add a service or custom item</p>
                </div>
                <button
                  onClick={() => {
                    setShowAddItemModal(false);
                    resetAddItemForm();
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Item Type Selection */}
              <div className="mb-6">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAddItemType("service")}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      addItemType === "service"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    Service Item
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddItemType("custom")}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      addItemType === "custom"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    Custom Item
                  </button>
                </div>
              </div>

              {addItemType === "service" ? (
                // Service Item Form
                <div className="space-y-4">
                  {/* Service Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search Service
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by name..."
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            selectedCategory === cat
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {cat === "all" ? "All" : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Service List */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Service
                    </label>
                    <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                      {filteredServices.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No services found
                        </div>
                      ) : (
                        filteredServices.map((service) => (
                          <button
                            key={service.service_id}
                            type="button"
                            onClick={() => setSelectedService(service)}
                            className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between ${
                              selectedService?.service_id === service.service_id
                                ? "bg-blue-50 border-l-4 border-blue-600"
                                : ""
                            }`}
                          >
                            <div>
                              <div className="font-medium text-gray-800">
                                {service.service_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {service.category} • {service.is_inventory ? "Inventory" : "Service"}
                                {service.stock !== null && (
                                  <> • Stock: {service.stock}</>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-800">
                                {formatCurrency(service.service_charge)}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Number(e.target.value))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {selectedService && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Item:</span>
                        <span className="font-semibold text-gray-800">{selectedService.service_name}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-gray-600">Total:</span>
                        <span className="font-bold text-blue-600">
                          {formatCurrency(itemQuantity * selectedService.service_charge)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddItemModal(false);
                        resetAddItemForm();
                      }}
                      className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddService}
                      disabled={loading || !selectedService}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Adding...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Add to Bill</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                // Custom Item Form
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter item name"
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Price <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={itemUnitPrice}
                        onChange={(e) => setItemUnitPrice(Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {customItemName && itemUnitPrice > 0 && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Total:</span>
                        <span className="font-bold text-amber-600">
                          {formatCurrency(itemQuantity * itemUnitPrice)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddItemModal(false);
                        resetAddItemForm();
                      }}
                      className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      disabled={loading || !customItemName.trim() || itemUnitPrice <= 0}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Adding...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Add to Bill</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Return Item Modal */}
      {showReturnModal && returnItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Return Item</h2>
                  <p className="text-sm text-amber-100">{returnItem.item_name || `Service #${returnItem.service_id}`}</p>
                </div>
                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setReturnItem(null);
                    setReturnQuantity(1);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Currently Billed:</span>
                  <span className="font-semibold text-gray-800">{returnItem.quantity} units</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Unit Price:</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(returnItem.unit_price)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Billed:</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(returnItem.total)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity to Return
                </label>
                <input
                  type="number"
                  min="0.5"
                  max={returnItem.quantity}
                  step="0.5"
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Max: {returnItem.quantity} units
                </p>
              </div>

              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Refund Amount:</span>
                  <span className="font-bold text-amber-600">
                    {formatCurrency(returnQuantity * returnItem.unit_price)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowReturnModal(false);
                    setReturnItem(null);
                    setReturnQuantity(1);
                  }}
                  className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReturnItem}
                  disabled={loading || returnQuantity <= 0 || returnQuantity > returnItem.quantity}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Return</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Rooms
        </button>
      </div>
    </div>
  );
}