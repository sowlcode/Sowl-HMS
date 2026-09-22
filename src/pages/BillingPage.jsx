// BillingPage.jsx

import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Receipt,
  User,
  Phone,
  Bed,
  Clock,
  Search,
  X,
  Check,
  Package,
  Coffee,
  Utensils,
  ShoppingBag,
  AlertCircle,
  FileText,
  ChevronDown,
  Image,
  MoreHorizontal,
  Home,
  Shirt,
  Car,
  FolderOpen,
  UserCog,
  Bot,
  CreditCard,
  Wallet,
  Banknote,
  History,
  TrendingUp,
} from "lucide-react";

// ============================================================
// CATEGORY CONFIGURATION
// ============================================================

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

const CATEGORIES = [
  { value: "all", label: "All", icon: Package },
  { value: "Food", label: "Food", icon: Utensils },
  { value: "Drinks", label: "Drinks", icon: Coffee },
  { value: "Laundry", label: "Laundry", icon: Shirt },
  { value: "Transport", label: "Transport", icon: Car },
  { value: "Other", label: "Other", icon: MoreHorizontal },
];

// ============================================================
// ADDED-BY TAG
// ============================================================

function AddedByTag({ addedBy }) {
  if (!addedBy) return null;

  const isSystem = addedBy === "system";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        isSystem
          ? "border-gray-200 bg-gray-100 text-gray-600"
          : "border-indigo-200 bg-indigo-50 text-indigo-700"
      }`}
      title={isSystem ? "Auto-generated" : `Added by ${addedBy}`}
    >
      {isSystem ? (
        <Bot className="h-3 w-3" />
      ) : (
        <UserCog className="h-3 w-3" />
      )}
      <span className="max-w-[120px] truncate">{isSystem ? "System" : addedBy}</span>
    </span>
  );
}

// ============================================================
// PAYMENT METHOD BADGE
// ============================================================

function PaymentMethodBadge({ method }) {
  const isCash = method === "cash";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        isCash
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-blue-200 bg-blue-50 text-blue-700"
      }`}
    >
      {isCash ? (
        <Banknote className="h-3.5 w-3.5" />
      ) : (
        <CreditCard className="h-3.5 w-3.5" />
      )}
      {isCash ? "Cash" : "Online"}
    </span>
  );
}

// ============================================================
// CONFIRMATION DIALOG (generic - used for deletes etc.)
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
  variant = "danger",
}) {
  if (!isOpen) return null;

  const theme =
    variant === "success"
      ? {
          header: "bg-gradient-to-r from-green-600 to-emerald-600",
          headerSub: "text-green-100",
          button:
            "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700",
          note: "bg-green-50 text-green-700",
          noteText: "✅ Please review the details above before confirming.",
        }
      : {
          header: "bg-gradient-to-r from-red-600 to-red-700",
          headerSub: "text-red-100",
          button:
            "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800",
          note: "bg-red-50 text-red-600",
          noteText: "⚠️ This action cannot be undone.",
        };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className={`rounded-t-xl px-6 py-4 ${theme.header}`}>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/20 p-1.5">
              <Icon className="h-5 w-5 text-white" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className={`text-sm ${theme.headerSub}`}>
                {variant === "success" ? "Please confirm to proceed" : "This action cannot be undone"}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {typeof message === "string" ? (
            <p className="mb-2 text-gray-600">{message}</p>
          ) : (
            <div className="mb-2">{message}</div>
          )}

          <p className={`rounded-lg p-2 text-sm ${theme.note}`}>{theme.noteText}</p>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100"
            >
              {cancelText}
            </button>

            <button
              onClick={onConfirm}
              disabled={loading}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-50 ${theme.button}`}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Icon className="h-4 w-4" />
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
// CONTEXT MENU
// ============================================================

function ContextMenu({ x, y, onClose, onDeduct, onDelete, isCustom }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const menuStyle = {
    position: "fixed",
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 150),
    zIndex: 1000,
  };

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-2xl"
    >
      {isCustom ? (
        <>
          <button
            onClick={() => {
              onDeduct();
              onClose();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50"
          >
            <Minus className="h-4 w-4 text-blue-500" />
            <span>Deduct Quantity</span>
          </button>

          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            <span>Remove Item</span>
          </button>
        </>
      ) : (
        <button
          onClick={() => {
            onDeduct();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-amber-600 transition-colors hover:bg-amber-50"
        >
          <Minus className="h-4 w-4 text-amber-500" />
          <span>Return / Deduct</span>
        </button>
      )}
    </div>
  );
}

// ============================================================
// CUSTOM ITEM MODAL
// ============================================================

function CustomItemModal({ isOpen, onClose, onAdd, loading }) {
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setItemName("");
      setQuantity(1);
      setUnitPrice("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!itemName.trim()) {
      setError("Please enter an item name");
      return;
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      setError("Quantity must be a whole number greater than 0");
      return;
    }

    const price = Number(unitPrice);
    if (isNaN(price) || price <= 0) {
      setError("Unit price must be greater than 0");
      return;
    }

    onAdd({
      name: itemName.trim(),
      quantity: qty,
      unitPrice: price,
    });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <ShoppingBag className="h-5 w-5" />
              Exclusive Custom Item
            </h2>
            <p className="text-sm text-blue-100">Add something not in the service list</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-white transition-colors hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Enter item name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Quantity <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center rounded-lg border border-gray-300 bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  className="rounded-l-lg p-2 transition-colors hover:bg-gray-100 disabled:opacity-50"
                  disabled={loading}
                >
                  <Minus className="h-4 w-4 text-gray-600" />
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setQuantity(Number.isNaN(val) || val < 1 ? 1 : val);
                  }}
                  className="w-full border-none bg-transparent text-center text-sm font-semibold outline-none"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => prev + 1)}
                  className="rounded-r-lg p-2 transition-colors hover:bg-gray-100 disabled:opacity-50"
                  disabled={loading}
                >
                  <Plus className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Unit Price (NPR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-600">
              ⚠️ {error}
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-gray-200 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Add Item</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// PAYMENT MODAL (allows overpayment, triggers external confirm)
// ============================================================

function PaymentModal({ isOpen, onClose, onSubmit, loading, billTotal, totalPaid }) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [error, setError] = useState("");

  const remaining = Number(billTotal || 0) - Number(totalPaid || 0);

  useEffect(() => {
    if (isOpen) {
      setPaymentAmount(remaining > 0 ? remaining.toFixed(2) : "");
      setPaymentMethod("cash");
      setError("");
    }
  }, [isOpen, remaining]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Payment amount must be greater than 0");
      return;
    }

    // Hand off to parent — parent will open confirmation dialog
    onSubmit({
      paymentAmount: amount,
      paymentMethod,
    });
  };

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "NPR",
      minimumFractionDigits: 2,
    }).format(Number(amount || 0));
  }

  // Quick amount buttons
  const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between rounded-t-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Wallet className="h-5 w-5" />
              Add Payment
            </h2>
            <p className="text-sm text-green-100">Record a payment for this registration</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-white transition-colors hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* SUMMARY */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Bill Total:</span>
              <span className="font-semibold text-gray-800">{formatCurrency(billTotal)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-gray-600">Already Paid:</span>
              <span className="font-semibold text-green-600">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm">
              <span className="font-semibold text-gray-700">
                {remaining >= 0 ? "Remaining:" : "Credit:"}
              </span>
              <span
                className={`font-bold ${
                  remaining > 0
                    ? "text-red-600"
                    : remaining < 0
                    ? "text-blue-600"
                    : "text-green-600"
                }`}
              >
                {formatCurrency(Math.abs(remaining))}
              </span>
            </div>
          </div>

          {/* AMOUNT */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Payment Amount (NPR) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-lg font-semibold focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={loading}
              autoFocus
            />

            {/* QUICK AMOUNT BUTTONS */}
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPaymentAmount(String(amt))}
                  className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                >
                  Rs {amt.toLocaleString("en-IN")}
                </button>
              ))}

              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setPaymentAmount(remaining.toFixed(2))}
                  className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Full: {formatCurrency(remaining)}
                </button>
              )}
            </div>

            {remaining <= 0 && (
              <p className="mt-1 text-xs text-blue-600">
                Bill is fully paid — this will be recorded as an advance payment.
              </p>
            )}
          </div>

          {/* PAYMENT METHOD */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                  paymentMethod === "cash"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
                disabled={loading}
              >
                <Banknote className="h-5 w-5" />
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("online")}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                  paymentMethod === "online"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
                disabled={loading}
              >
                <CreditCard className="h-5 w-5" />
                Online
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-600">
              ⚠️ {error}
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex items-center gap-3 border-t border-gray-200 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg px-4 py-2.5 text-gray-600 transition-colors hover:bg-gray-100"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !paymentAmount || Number(paymentAmount) <= 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 text-white shadow-md transition-all duration-200 hover:from-green-700 hover:to-emerald-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>Review Payment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// PAYMENT CONFIRMATION DIALOG
// ============================================================

function PaymentConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  loading,
  paymentAmount,
  paymentMethod,
  billTotal,
  totalPaid,
}) {
  if (!isOpen) return null;

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "NPR",
      minimumFractionDigits: 2,
    }).format(Number(amount || 0));
  }

  const amount = Number(paymentAmount || 0);
  const newTotalPaid = Number(totalPaid || 0) + amount;
  const newRemaining = Number(billTotal || 0) - newTotalPaid;
  const willBeOverpaid = newRemaining < -0.01;
  const willBeFullyPaid = !willBeOverpaid && newRemaining <= 0.01;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="rounded-t-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/20 p-1.5">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Confirm Payment</h2>
              <p className="text-sm text-green-100">Review details before recording</p>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="space-y-4 p-6">
          {/* AMOUNT HIGHLIGHT */}
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Payment Amount
            </p>
            <p className="mt-1 break-words text-3xl font-bold text-green-600">
              {formatCurrency(amount)}
            </p>
            <div className="mt-2 flex justify-center">
              <PaymentMethodBadge method={paymentMethod} />
            </div>
          </div>

          {/* BREAKDOWN */}
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Bill Total:</span>
              <span className="font-semibold text-gray-800">
                {formatCurrency(billTotal)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Previously Paid:</span>
              <span className="font-semibold text-gray-800">
                {formatCurrency(totalPaid)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">This Payment:</span>
              <span className="font-semibold text-green-600">
                +{formatCurrency(amount)}
              </span>
            </div>

            <div className="flex justify-between border-t border-gray-200 pt-2 text-sm">
              <span className="font-semibold text-gray-700">New Total Paid:</span>
              <span className="font-bold text-gray-800">
                {formatCurrency(newTotalPaid)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="font-semibold text-gray-700">
                {willBeOverpaid ? "Credit After:" : "Remaining After:"}
              </span>
              <span
                className={`font-bold ${
                  willBeOverpaid
                    ? "text-blue-600"
                    : willBeFullyPaid
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {willBeOverpaid
                  ? formatCurrency(Math.abs(newRemaining))
                  : willBeFullyPaid
                  ? formatCurrency(0)
                  : formatCurrency(newRemaining)}
              </span>
            </div>
          </div>

          {/* STATUS NOTE */}
          {willBeOverpaid && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              <p className="flex items-start gap-2">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This payment exceeds the bill. The extra{" "}
                  <strong>{formatCurrency(Math.abs(newRemaining))}</strong> will be
                  recorded as an advance credit.
                </span>
              </p>
            </div>
          )}

          {willBeFullyPaid && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <p className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <span>This payment will fully settle the bill.</span>
              </p>
            </div>
          )}

          {!willBeOverpaid && !willBeFullyPaid && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Partial payment.{" "}
                  <strong>{formatCurrency(newRemaining)}</strong> will remain after
                  this payment.
                </span>
              </p>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex items-center gap-3 border-t border-gray-200 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg px-4 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              Go Back
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 text-white shadow-md transition-all duration-200 hover:from-green-700 hover:to-emerald-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Confirm & Record</span>
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
// MAIN BILLING PAGE
// ============================================================

export default function BillingPage({ registrationId, onBack, session }) {
  // ==========================================================
  // SESSION USERNAME
  // ==========================================================

  const username = session?.username || session?.user?.username || "unknown";

  // ==========================================================
  // DATA
  // ==========================================================

  const [bill, setBill] = useState(null);
  const [registrationInfo, setRegistrationInfo] = useState(null);
  const [payments, setPayments] = useState([]);
  const [totalPaid, setTotalPaid] = useState(0);

  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);

  const [loading, setLoading] = useState(false);

  // ==========================================================
  // THREE PAGE SYSTEM
  // ==========================================================

  const [activePage, setActivePage] = useState("bill");

  // ==========================================================
  // SERVICE FILTERS
  // ==========================================================

  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // ==========================================================
  // MULTI ITEM STACK
  // ==========================================================

  const [selectedItems, setSelectedItems] = useState({});
  const selectionOrderRef = useRef(0);

  // ==========================================================
  // CUSTOM ITEM MODAL
  // ==========================================================

  const [customModalOpen, setCustomModalOpen] = useState(false);

  // ==========================================================
  // PAYMENT MODAL + CONFIRMATION
  // ==========================================================

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentConfirmation, setPaymentConfirmation] = useState({
    isOpen: false,
    amount: 0,
    method: "cash",
  });

  // ==========================================================
  // RETURN / DEDUCT
  // ==========================================================

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItem, setReturnItem] = useState(null);
  const [returnQuantity, setReturnQuantity] = useState(1);

  // ==========================================================
  // CONTEXT MENU
  // ==========================================================

  const [contextMenu, setContextMenu] = useState(null);

  // ==========================================================
  // CONFIRMATION (generic)
  // ==========================================================

  const [confirmationDialog, setConfirmationDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    onConfirm: null,
    loading: false,
    icon: Trash2,
  });

  // ==========================================================
  // MESSAGES
  // ==========================================================

  const [messages, setMessages] = useState([]);

  const addMessage = (text, type = "info", duration = 5000) => {
    const id = Date.now() + Math.random();

    setMessages((prev) => [...prev, { id, text, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setMessages((prev) => prev.filter((message) => message.id !== id));
      }, duration);
    }
  };

  const removeMessage = (id) => {
    setMessages((prev) => prev.filter((message) => message.id !== id));
  };

  const showSuccess = (text) => addMessage(text, "success");
  const showError = (text) => addMessage(text, "error");

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationId]);

  async function loadData() {
    try {
      setLoading(true);

      const [billData, servicesData, regInfo, paymentsData] = await Promise.all([
        invoke("get_registration_bill", { registrationId: Number(registrationId) }),
        invoke("get_food_services"),
        getRegistrationInfo(),
        invoke("get_registration_payments", { registrationId: Number(registrationId) }),
      ]);

      setBill(billData);
      setServices(servicesData || []);
      setFilteredServices(servicesData || []);
      setRegistrationInfo(regInfo);
      setPayments(paymentsData?.payments || []);
      setTotalPaid(paymentsData?.total_paid || 0);
    } catch (err) {
      console.error("Error loading billing data:", err);
      showError(`Failed to load billing data: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // GET REGISTRATION INFO
  // ==========================================================

  async function getRegistrationInfo() {
    try {
      return await invoke("get_booking", { registrationId: Number(registrationId) });
    } catch (err) {
      console.error("Error getting registration info:", err);
      return null;
    }
  }

  // ==========================================================
  // REFRESH BILL DATA
  // ==========================================================

  async function refreshData() {
    try {
      const [billData, servicesData, regInfo, paymentsData] = await Promise.all([
        invoke("get_registration_bill", { registrationId: Number(registrationId) }),
        invoke("get_food_services"),
        getRegistrationInfo(),
        invoke("get_registration_payments", { registrationId: Number(registrationId) }),
      ]);

      setBill(billData);
      setServices(servicesData || []);
      setFilteredServices(servicesData || []);
      setRegistrationInfo(regInfo);
      setPayments(paymentsData?.payments || []);
      setTotalPaid(paymentsData?.total_paid || 0);
    } catch (err) {
      console.error("Refresh error:", err);
      showError(String(err));
    }
  }

  // ==========================================================
  // SERVICE FILTERING
  // ==========================================================

  useEffect(() => {
    let filtered = services;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((service) => service.category === selectedCategory);
    }

    if (serviceSearch.trim()) {
      const query = serviceSearch.toLowerCase().trim();
      filtered = filtered.filter((service) =>
        service.service_name?.toLowerCase().includes(query)
      );
    }

    setFilteredServices(filtered);
  }, [services, selectedCategory, serviceSearch]);

  // ==========================================================
  // FORMAT CURRENCY - NPR
  // ==========================================================

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "NPR",
      minimumFractionDigits: 2,
    }).format(Number(amount || 0));
  }

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

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

  // ==========================================================
  // MULTI ITEM SELECTION
  // ==========================================================

  function toggleService(service) {
    const serviceId = service.service_id;

    setSelectedItems((prev) => {
      const next = { ...prev };

      if (next[serviceId]) {
        delete next[serviceId];
      } else {
        selectionOrderRef.current += 1;
        next[serviceId] = { service, quantity: 1, order: selectionOrderRef.current };
      }

      return next;
    });
  }

  // ==========================================================
  // INCREASE SELECTED SERVICE
  // ==========================================================

  function increaseSelectedQuantity(serviceId, e) {
    e.stopPropagation();
    setSelectedItems((prev) => {
      const item = prev[serviceId];
      if (!item) return prev;

      const service = item.service;
      const current = Number(item.quantity) || 1;
      const stock = Number(service.stock ?? 0);

      if (service.is_inventory && current >= stock) {
        showError(
          `Only ${stock} unit${stock === 1 ? "" : "s"} available for ${service.service_name}`
        );
        return prev;
      }

      return {
        ...prev,
        [serviceId]: { ...item, quantity: current + 1 },
      };
    });
  }

  // ==========================================================
  // DECREASE SELECTED SERVICE
  // ==========================================================

  function decreaseSelectedQuantity(serviceId, e) {
    e.stopPropagation();
    setSelectedItems((prev) => {
      const item = prev[serviceId];
      if (!item) return prev;

      const current = Number(item.quantity) || 1;

      if (current <= 1) {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      }

      return {
        ...prev,
        [serviceId]: { ...item, quantity: current - 1 },
      };
    });
  }

  // ==========================================================
  // SET SELECTED QUANTITY MANUALLY
  // ==========================================================

  function setSelectedQuantity(service, value, e) {
    e.stopPropagation();
    let quantity = parseInt(value, 10);

    if (Number.isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    if (service.is_inventory) {
      const stock = Number(service.stock ?? 0);
      if (quantity > stock) {
        quantity = stock;
      }
    }

    setSelectedItems((prev) => ({
      ...prev,
      [service.service_id]: {
        ...prev[service.service_id],
        service,
        quantity,
      },
    }));
  }

  // ==========================================================
  // SELECTED ITEMS ARRAY
  // ==========================================================

  const selectedItemsArray = Object.values(selectedItems);
  const selectedItemTypes = selectedItemsArray.length;

  const selectedItemsArraySorted = [...selectedItemsArray].sort(
    (a, b) => (b.order || 0) - (a.order || 0)
  );

  const selectedTotalQuantity = selectedItemsArray.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const selectedItemsTotal = selectedItemsArray.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0) * Number(item.service?.service_charge || 0),
    0
  );

  // ==========================================================
  // ADD ALL SELECTED SERVICES
  // ==========================================================

  async function handleAddSelectedItems() {
    if (selectedItemsArray.length === 0) {
      showError("Please select at least one item");
      return;
    }

    try {
      setLoading(true);

      let addedCount = 0;

      for (const item of selectedItemsArray) {
        const service = item.service;
        const quantity = Number(item.quantity);

        if (quantity <= 0 || !Number.isInteger(quantity)) {
          throw new Error(`Invalid quantity for ${service.service_name}`);
        }

        if (service.is_inventory) {
          const stock = Number(service.stock ?? 0);
          if (quantity > stock) {
            throw new Error(
              `Not enough stock for ${service.service_name}. Available: ${stock}`
            );
          }
        }

        await invoke("add_service_to_registration", {
          request: {
            registration_id: Number(registrationId),
            service_id: Number(service.service_id),
            quantity: quantity,
          },
          username,
        });

        addedCount++;
      }

      showSuccess(`Added ${addedCount} item${addedCount === 1 ? "" : "s"} to the bill`);

      setSelectedItems({});
      await refreshData();
      setActivePage("bill");
    } catch (err) {
      console.error("Error adding selected items:", err);
      showError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // CLEAR SELECTION
  // ==========================================================

  function clearSelectedItems() {
    setSelectedItems({});
  }

  // ==========================================================
  // ADD CUSTOM ITEM
  // ==========================================================

  async function handleAddCustomItem({ name, quantity, unitPrice }) {
    try {
      setLoading(true);

      await invoke("add_custom_bill_item", {
        request: {
          registration_id: Number(registrationId),
          item_name: name,
          quantity: quantity,
          unit_price: unitPrice,
        },
        username,
      });

      showSuccess(`Added ${name} to bill`);
      setCustomModalOpen(false);
      await refreshData();
      setActivePage("bill");
    } catch (err) {
      console.error("Error adding custom item:", err);
      showError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // PAYMENT FLOW
  // ==========================================================
  // Step 1: PaymentModal collects amount + method, calls
  //         handlePaymentSubmit() → opens confirmation.
  // Step 2: PaymentConfirmationDialog shows summary; user
  //         confirms → handleConfirmPayment() → invoke backend.

  function handlePaymentSubmit({ paymentAmount, paymentMethod }) {
    // Close payment form modal, open confirmation dialog
    setPaymentModalOpen(false);
    setPaymentConfirmation({
      isOpen: true,
      amount: paymentAmount,
      method: paymentMethod,
    });
  }

  function closePaymentConfirmation() {
    setPaymentConfirmation({ isOpen: false, amount: 0, method: "cash" });
  }

  async function handleConfirmPayment() {
    const { amount, method } = paymentConfirmation;

    try {
      setLoading(true);

      await invoke("add_payment", {
        request: {
          registration_id: Number(registrationId),
          booking_id: null,
          payment_amount: amount,
          payment_method: method,
        },
        paymentReceiver: username,
      });

      showSuccess(`Payment of ${formatCurrency(amount)} recorded successfully`);
      closePaymentConfirmation();
      await refreshData();
    } catch (err) {
      console.error("Error adding payment:", err);
      showError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // HANDLE DEDUCT
  // ==========================================================

  function handleDeductItem(item) {
    setReturnItem(item);
    setReturnQuantity(1);
    setShowReturnModal(true);
    setContextMenu(null);
  }

  // ==========================================================
  // HANDLE RIGHT CLICK
  // ==========================================================

  const handleRightClick = useCallback((e, item) => {
    e.preventDefault();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      isCustom: item.item_type === "custom",
    });
  }, []);

  // ==========================================================
  // RETURN / DEDUCT
  // ==========================================================

  async function handleReturnItem() {
    if (!returnItem) return;

    const quantity = Number(returnQuantity);

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      showError("Return quantity must be a whole number");
      return;
    }

    if (quantity > Number(returnItem.quantity)) {
      showError(`Cannot return more than ${returnItem.quantity} items`);
      return;
    }

    try {
      setLoading(true);

      if (returnItem.item_type === "custom") {
        const newQuantity = Number(returnItem.quantity) - quantity;

        if (newQuantity === 0) {
          await invoke("delete_custom_bill_item", {
            billId: Number(returnItem.bill_id),
            username,
          });

          showSuccess(`Removed ${returnItem.item_name} from bill`);
        } else {
          await invoke("update_custom_bill_item_quantity", {
            billId: Number(returnItem.bill_id),
            quantity: newQuantity,
            username,
          });

          showSuccess(`Deducted ${quantity} ${returnItem.item_name}`);
        }
      } else {
        await invoke("return_service_quantity", {
          request: {
            bill_id: Number(returnItem.bill_id),
            quantity: quantity,
          },
          username,
        });

        showSuccess(`Returned ${quantity} ${returnItem.item_name || "item"}`);
      }

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

  // ==========================================================
  // DELETE CUSTOM ITEM
  // ==========================================================

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
            username,
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

  // ==========================================================
  // CLOSE CONFIRMATION
  // ==========================================================

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

  // ==========================================================
  // CALCULATED VALUES
  // ==========================================================

  const billTotal = Number(bill?.total || 0);
  const remainingBalance = billTotal - totalPaid;
  const isFullyPaid = remainingBalance <= 0.01 && billTotal > 0;
  const isOverpaid = remainingBalance < -0.01;

  // ==========================================================
  // LOADING SCREEN
  // ==========================================================

  if (loading && !bill) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600">Loading billing data...</p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // CATEGORY STATS
  // ==========================================================

  const categoryStats = services.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {});

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>
      {/* ======================================================
          ANIMATION
      ====================================================== */}

      <style>{`
        @keyframes pageFade {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .page-fade {
          animation: pageFade 250ms ease-out;
        }

        .service-card {
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
        }

        .service-card:hover {
          transform: translateY(-2px);
        }

        .service-card:active {
          transform: scale(.985);
        }

        .selected-items-sidebar {
          position: sticky;
          top: 1.5rem;
          max-height: calc(100vh - 3rem);
          overflow-y: auto;
        }

        .selected-items-sidebar::-webkit-scrollbar {
          width: 4px;
        }

        .selected-items-sidebar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }

        .selected-items-sidebar::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 10px;
        }

        .selected-items-sidebar::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }

        .service-image-container {
          aspect-ratio: 1 / 1;
          padding: 6px;
        }

        .service-image-container img {
          border-radius: 10px;
          border: 2px solid #e5e7eb;
        }

        .service-image-container .fallback-image {
          border-radius: 10px;
          border: 2px solid #e5e7eb;
        }

        .quantity-controls button {
          position: relative;
          z-index: 10;
          pointer-events: auto;
        }

        .quantity-controls input {
          pointer-events: auto;
        }

        .bill-table-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .bill-table-scroll::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }

        .bill-table-scroll::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 10px;
        }

        .bill-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }
      `}</style>

      {/* ======================================================
          MAIN CONTAINER
      ====================================================== */}

      <div className="relative mx-auto max-w-7xl p-6">
        {/* ====================================================
            MESSAGES
        ==================================================== */}

        {messages.length > 0 && (
          <div className="fixed right-4 top-4 z-[200] w-full max-w-md space-y-2">
            {messages.map(({ id, text, type }) => (
              <div
                key={id}
                className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg ${
                  type === "success"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm">{text}</p>
                </div>

                <button
                  onClick={() => removeMessage(id)}
                  className="text-gray-400 transition hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ====================================================
            CONFIRMATION (generic — deletes etc.)
        ==================================================== */}

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

        {/* ====================================================
            PAYMENT CONFIRMATION
        ==================================================== */}

        <PaymentConfirmationDialog
          isOpen={paymentConfirmation.isOpen}
          onClose={closePaymentConfirmation}
          onConfirm={handleConfirmPayment}
          loading={loading}
          paymentAmount={paymentConfirmation.amount}
          paymentMethod={paymentConfirmation.method}
          billTotal={billTotal}
          totalPaid={totalPaid}
        />

        {/* ====================================================
            CUSTOM ITEM MODAL
        ==================================================== */}

        <CustomItemModal
          isOpen={customModalOpen}
          onClose={() => setCustomModalOpen(false)}
          onAdd={handleAddCustomItem}
          loading={loading}
        />

        {/* ====================================================
            PAYMENT MODAL
        ==================================================== */}

        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onSubmit={handlePaymentSubmit}
          loading={loading}
          billTotal={billTotal}
          totalPaid={totalPaid}
        />

        {/* ====================================================
            CONTEXT MENU
        ==================================================== */}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            isCustom={contextMenu.isCustom}
            onClose={() => setContextMenu(null)}
            onDeduct={() => handleDeductItem(contextMenu.item)}
            onDelete={() => handleDeleteCustomItem(contextMenu.item)}
          />
        )}

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>

            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
                <Receipt className="h-6 w-6 text-blue-600" />
                Billing
              </h1>

              <p className="text-sm text-gray-500">
                Registration #{registrationId}
                {" • "}
                {registrationInfo?.customer_name || "Loading..."}
              </p>
            </div>
          </div>

          {/* PAY BUTTON */}
          {billTotal > 0 && (
            <button
              onClick={() => setPaymentModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-lg"
            >
              <Wallet className="h-4 w-4" />
              {isFullyPaid ? "Add Advance Payment" : "Add Payment"}
            </button>
          )}
        </div>

        {/* ====================================================
            STATIC REGISTRATION CARDS
        ==================================================== */}

        {registrationInfo && (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* CUSTOMER */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <User className="h-5 w-5 text-blue-600" />
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-500">Customer</div>
                  <div className="truncate text-sm font-semibold text-gray-800">
                    {registrationInfo.customer_name}
                  </div>
                </div>
              </div>
            </div>

            {/* PHONE */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-500">Phone</div>
                  <div className="truncate text-sm font-semibold text-gray-800">
                    {registrationInfo.phone_number}
                  </div>
                </div>
              </div>
            </div>

            {/* ROOMS */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2">
                  <Home className="h-5 w-5 text-purple-600" />
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-500">Rooms</div>
                  <div className="text-sm font-semibold text-gray-800">
                    {registrationInfo.rooms?.map((room, index) => (
                      <span key={index} className="mr-1 inline-block">
                        {room.room_number}
                        {index < registrationInfo.rooms.length - 1 && ", "}
                      </span>
                    )) || "No rooms"}
                  </div>
                </div>
              </div>
            </div>

            {/* CHECK IN */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-500">Check-in</div>
                  <div className="truncate text-sm font-semibold text-gray-800">
                    {formatDate(registrationInfo.check_in)}
                  </div>
                </div>
              </div>
            </div>

            
          </div>
        )}

        {/* ====================================================
            BILLING BOX
        ==================================================== */}

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* ==================================================
              BILLING BOX HEADER
          ================================================== */}

          <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                {activePage === "bill" ? (
                  <FileText className="h-5 w-5 text-blue-600" />
                ) : activePage === "items" ? (
                  <Package className="h-5 w-5 text-blue-600" />
                ) : (
                  <History className="h-5 w-5 text-green-600" />
                )}
                {activePage === "bill"
                  ? "Bill Items"
                  : activePage === "items"
                  ? "Add Items"
                  : "Payment History"}
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                {activePage === "bill"
                  ? "Right-click an item for return or deduct options"
                  : activePage === "items"
                  ? "Select multiple items and add them together"
                  : `${payments.length} payment${payments.length === 1 ? "" : "s"} recorded`}
              </p>
            </div>

            {/* SWITCH BUTTONS - THREE TABS */}
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setActivePage("bill")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all lg:flex-initial lg:px-4 ${
                  activePage === "bill"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <Receipt className="h-4 w-4" />
                  <span className="hidden sm:inline">Bill</span>
                </span>
              </button>

              <button
                onClick={() => setActivePage("items")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all lg:flex-initial lg:px-4 ${
                  activePage === "items"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Items</span>
                </span>
              </button>

              <button
                onClick={() => setActivePage("payments")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all lg:flex-initial lg:px-4 ${
                  activePage === "payments"
                    ? "bg-white text-green-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">Payments</span>
                </span>
              </button>
            </div>
          </div>

          {/* ==================================================
              PAGE AREA
          ================================================== */}

          <div className="relative min-h-[620px]">
            {/* =================================================
                BILL PAGE
            ================================================= */}

            {activePage === "bill" && (
              <div key="bill" className="page-fade p-6">
                {/* BILL SUMMARY - 20% SMALLER */}
                <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {/* TOTAL */}
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="shrink-0 rounded-lg bg-blue-100 p-2">
                        <Receipt className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-800">Bill Total</p>
                        <p className="truncate text-[11px] text-gray-500">
                          {bill?.items?.length || 0} item
                          {bill?.items?.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-sm font-bold text-blue-600">
                      {formatCurrency(billTotal)}
                    </p>
                  </div>

                  {/* PAID */}
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="shrink-0 rounded-lg bg-green-100 p-2">
                        <Wallet className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-800">Total Paid</p>
                        <p className="truncate text-[11px] text-gray-500">
                          {payments.length} payment{payments.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-sm font-bold text-green-600">
                      {formatCurrency(totalPaid)}
                    </p>
                  </div>

                  {/* REMAINING / CREDIT */}
                  <div
                    className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${
                      isOverpaid
                        ? "border-blue-200 bg-blue-50"
                        : isFullyPaid
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className={`shrink-0 rounded-lg p-2 ${
                          isOverpaid
                            ? "bg-blue-100"
                            : isFullyPaid
                            ? "bg-green-100"
                            : "bg-red-100"
                        }`}
                      >
                        {isOverpaid ? (
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                        ) : isFullyPaid ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {isOverpaid ? "Credit" : isFullyPaid ? "Fully Paid" : "Remaining"}
                        </p>
                        <p className="truncate text-[11px] text-gray-500">
                          {isOverpaid
                            ? "Advance payment"
                            : isFullyPaid
                            ? "No balance due"
                            : "Amount to collect"}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`shrink-0 whitespace-nowrap text-sm font-bold ${
                        isOverpaid
                          ? "text-blue-600"
                          : isFullyPaid
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {isOverpaid
                        ? formatCurrency(Math.abs(remainingBalance))
                        : isFullyPaid
                        ? "✓"
                        : formatCurrency(remainingBalance)}
                    </p>
                  </div>
                </div>

                {/* EMPTY BILL */}
                {bill?.items?.length === 0 ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-center">
                    <Receipt className="mb-4 h-16 w-16 text-gray-300" />
                    <p className="font-medium text-gray-600">No items added to this bill yet.</p>
                    <p className="mt-1 text-sm text-gray-400">Select services from Add Items.</p>

                    <button
                      onClick={() => setActivePage("items")}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Items
                    </button>
                  </div>
                ) : (
                  /* BILL TABLE - SCROLLABLE */
                  <div className="rounded-xl border border-gray-200">
                    <div className="bill-table-scroll max-h-[420px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 z-10">
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Item
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Type
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                              Added By
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                              Qty
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                              Unit Price (NPR)
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                              Total (NPR)
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {bill?.items?.map((item) => {
                            const isCustom = item.item_type === "custom";
                            const displayType = isCustom ? "Exclusive" : item.item_type;

                            return (
                              <tr
                                key={item.bill_id}
                                onContextMenu={(e) => handleRightClick(e, item)}
                                className={`cursor-context-menu transition-colors hover:bg-gray-50 ${
                                  isCustom ? "bg-amber-50/30" : ""
                                }`}
                              >
                                {/* ITEM */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {isCustom ? (
                                      <ShoppingBag className="h-4 w-4 text-amber-500" />
                                    ) : item.is_inventory ? (
                                      <Package className="h-4 w-4 text-blue-500" />
                                    ) : (
                                      <Coffee className="h-4 w-4 text-purple-500" />
                                    )}

                                    <span className="font-medium text-gray-800">
                                      {item.item_name || `Service #${item.service_id}`}
                                    </span>

                                    {isCustom && (
                                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                        Exclusive
                                      </span>
                                    )}

                                    {item.item_type === "service" && item.is_inventory && (
                                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                        Inventory
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-0.5 text-xs text-gray-500">
                                    Added: {formatDate(item.added_at)}
                                  </div>
                                </td>

                                {/* TYPE */}
                                <td className="px-4 py-3 text-sm capitalize text-gray-600">
                                  {displayType}
                                </td>

                                {/* ADDED BY */}
                                <td className="px-4 py-3">
                                  <AddedByTag addedBy={item.added_by} />
                                </td>

                                {/* QUANTITY */}
                                <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">
                                  {item.quantity}
                                </td>

                                {/* UNIT PRICE */}
                                <td className="px-4 py-3 text-right text-sm text-gray-600">
                                  {formatCurrency(item.unit_price)}
                                </td>

                                {/* TOTAL */}
                                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">
                                  {formatCurrency(item.total)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>

                        <tfoot className="sticky bottom-0 z-10 bg-white">
                          <tr className="border-t-2 border-gray-200">
                            <td colSpan="5" className="px-4 py-3 text-right font-semibold text-gray-700">
                              Subtotal
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                              {formatCurrency(bill?.subtotal || 0)}
                            </td>
                          </tr>

                          <tr className="bg-blue-50/50">
                            <td colSpan="5" className="px-4 py-3 text-right text-lg font-bold text-gray-800">
                              Total
                            </td>
                            <td className="px-4 py-3 text-right text-lg font-bold text-blue-600">
                              {formatCurrency(bill?.total || 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={() => setActivePage("payments")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    <History className="h-4 w-4" />
                    View Payments
                  </button>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {billTotal > 0 && (
                      <button
                        onClick={() => setPaymentModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition hover:from-green-700 hover:to-emerald-700"
                      >
                        <Wallet className="h-4 w-4" />
                        {isFullyPaid ? "Add Advance Payment" : "Add Payment"}
                      </button>
                    )}

                    <button
                      onClick={() => setActivePage("items")}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Items
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================
                ADD ITEMS PAGE
            ================================================= */}

            {activePage === "items" && (
              <div key="items" className="page-fade">
                <div className="flex flex-col lg:flex-row">
                  {/* LEFT COLUMN - ITEMS GRID */}
                  <div className="min-w-0 flex-1">
                    {/* TOP TOOLBAR */}
                    <div className="border-b border-gray-200 bg-white px-6 py-4">
                      <div className="flex flex-col gap-3">
                        {/* SEARCH + CUSTOM BUTTON ROW */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="relative w-full sm:max-w-md">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search by name or category..."
                              value={serviceSearch}
                              onChange={(e) => setServiceSearch(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                            />
                            {serviceSearch && (
                              <button
                                onClick={() => setServiceSearch("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => setCustomModalOpen(true)}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-amber-600 hover:to-yellow-700"
                          >
                            <Plus className="h-4 w-4" />
                            Add Exclusive Item
                          </button>
                        </div>

                        {/* CATEGORY FILTER TABS */}
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORIES.map(({ value, label, icon: Icon }) => (
                            <button
                              key={value}
                              onClick={() => setSelectedCategory(value)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${
                                selectedCategory === value
                                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              <Icon
                                className={`h-4 w-4 ${
                                  selectedCategory === value ? "text-blue-500" : "text-gray-400"
                                }`}
                              />
                              {label}
                              {value !== "all" && (
                                <span
                                  className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                                    selectedCategory === value
                                      ? "bg-blue-100 text-blue-600"
                                      : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {categoryStats[value] || 0}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* SERVICE GRID */}
                    <div className="p-6">
                      {filteredServices.length === 0 ? (
                        <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                          <Package className="h-14 w-14 text-gray-300" />
                          <h3 className="mt-4 font-medium text-gray-600">No services found</h3>
                          <p className="mt-1 text-sm text-gray-400">
                            Try another search or category.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {filteredServices.map((service) => {
                            const Icon = CATEGORY_ICONS[service.category] || MoreHorizontal;
                            const gradient =
                              CATEGORY_COLORS[service.category] || "from-gray-500 to-gray-600";
                            const badge =
                              CATEGORY_BADGE_COLORS[service.category] ||
                              "bg-gray-100 text-gray-700 border-gray-200";
                            const selected = selectedItems[service.service_id];
                            const isSelected = Boolean(selected);
                            const stock = Number(service.stock ?? 0);
                            const outOfStock = service.is_inventory && stock <= 0;
                            const quantity = selected?.quantity || 1;

                            return (
                              <div
                                key={service.service_id}
                                className={`service-card overflow-hidden rounded-xl border-2 bg-white ${
                                  isSelected
                                    ? "border-blue-500 shadow-md shadow-blue-100"
                                    : "border-gray-200 shadow-sm"
                                } ${outOfStock ? "opacity-50" : ""}`}
                              >
                                {/* IMAGE */}
                                <button
                                  type="button"
                                  disabled={outOfStock}
                                  onClick={() => toggleService(service)}
                                  className="service-image-container relative block w-full"
                                >
                                  {service.picture ? (
                                    <img
                                      src={service.picture}
                                      alt={service.service_name}
                                      className="h-full w-full object-cover transition duration-300 hover:scale-105"
                                    />
                                  ) : (
                                    <div
                                      className={`fallback-image flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient}`}
                                    >
                                      <Icon className="h-9 w-9 text-white/80" />
                                    </div>
                                  )}

                                  {/* CATEGORY BADGE */}
                                  <div className="absolute left-2.5 top-2.5">
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full border bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold backdrop-blur-sm ${badge}`}
                                    >
                                      <Icon className="h-2.5 w-2.5" />
                                      {service.category}
                                    </span>
                                  </div>

                                  {/* INVENTORY BADGE */}
                                  {service.is_inventory && (
                                    <div className="absolute bottom-2.5 left-2.5">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/90 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                                        <Package className="h-2.5 w-2.5" />
                                        Inventory
                                      </span>
                                    </div>
                                  )}

                                  {/* SELECTED CHECK */}
                                  {isSelected && (
                                    <div className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                                      <Check className="h-3.5 w-3.5" />
                                    </div>
                                  )}

                                  {/* OUT OF STOCK */}
                                  {outOfStock && (
                                    <div className="absolute inset-1.5 flex items-center justify-center rounded-lg bg-black/40">
                                      <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-red-600">
                                        OUT OF STOCK
                                      </span>
                                    </div>
                                  )}
                                </button>

                                {/* CARD BODY */}
                                <div className="p-3">
                                  <h3 className="line-clamp-2 text-xs font-semibold leading-4 text-gray-800">
                                    {service.service_name}
                                  </h3>

                                  <div className="mt-1.5 flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-900">
                                      {formatCurrency(service.service_charge)}
                                    </span>
                                    {service.is_inventory ? (
                                      <span
                                        className={`text-[10px] font-medium ${
                                          stock <= 5 ? "text-red-500" : "text-gray-500"
                                        }`}
                                      >
                                        Stock: {stock}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-gray-400"></span>
                                    )}
                                  </div>

                                  {/* QUANTITY CONTROLS */}
                                  {isSelected && (
                                    <div className="mt-2 border-t border-gray-100 pt-2">
                                      <div className="quantity-controls flex items-center justify-between gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => decreaseSelectedQuantity(service.service_id, e)}
                                          className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                                        >
                                          <Minus className="h-3 w-3" />
                                        </button>

                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          value={quantity}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => setSelectedQuantity(service, e.target.value, e)}
                                          className="h-7 w-12 rounded-md border border-gray-200 text-center text-xs font-bold outline-none focus:border-blue-500"
                                        />

                                        <button
                                          type="button"
                                          onClick={(e) => increaseSelectedQuantity(service.service_id, e)}
                                          disabled={service.is_inventory && quantity >= stock}
                                          className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          <Plus className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* SELECT BUTTON */}
                                  {!isSelected && !outOfStock && (
                                    <button
                                      type="button"
                                      onClick={() => toggleService(service)}
                                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-gray-100 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:bg-blue-50 hover:text-blue-600"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Select
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN - STICKY SELECTED ITEMS SIDEBAR */}
                  <div className="lg:w-100 lg:pl-4 lg:pr-6 lg:pt-6">
                    <div className="selected-items-sidebar">
                      <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <Package className="h-4 w-4 text-blue-600" />
                            Selected Items
                          </h3>
                          {selectedItemTypes > 0 && (
                            <button
                              onClick={clearSelectedItems}
                              className="text-xs font-medium text-red-500 hover:text-red-700"
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        {selectedItemTypes === 0 ? (
                          <div className="py-8 text-center">
                            <ShoppingBag className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                            <p className="text-sm text-gray-400">No items selected</p>
                            <p className="mt-1 text-xs text-gray-400">
                              Click on items to add them
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Selected Items List */}
                            <div className="max-h-[534px] space-y-2 overflow-y-auto pr-1">
                              {selectedItemsArraySorted.map((item) => {
                                const service = item.service;
                                const ItemIcon = CATEGORY_ICONS[service.category] || Package;

                                return (
                                  <div
                                    key={service.service_id}
                                    className="flex items-center gap-2 rounded-lg border border-blue-100 bg-white p-2.5 shadow-sm"
                                  >
                                    {/* Item Image / Icon */}
                                    <div className="flex-shrink-0">
                                      {service.picture ? (
                                        <img
                                          src={service.picture}
                                          alt={service.service_name}
                                          className="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                                          <ItemIcon className="h-5 w-5 text-white" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Item Details */}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-gray-800">
                                        {service.service_name}
                                      </p>
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>{formatCurrency(service.service_charge)}</span>
                                        <span>•</span>
                                        <span className="font-semibold text-blue-600">
                                          ×{item.quantity}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Quantity Controls */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => decreaseSelectedQuantity(service.service_id, e)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <span className="w-6 text-center text-sm font-semibold text-gray-800">
                                        {item.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => increaseSelectedQuantity(service.service_id, e)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
                                        disabled={
                                          service.is_inventory &&
                                          item.quantity >= (service.stock || 0)
                                        }
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Summary & Action */}
                            <div className="mt-4 border-t border-blue-200 pt-3">
                              <div className="mb-2 flex justify-between text-sm">
                                <span className="text-gray-600">Total Items:</span>
                                <span className="font-semibold text-gray-800">
                                  {selectedTotalQuantity}
                                </span>
                              </div>
                              <div className="mb-3 flex justify-between text-sm">
                                <span className="text-gray-600">Total Amount:</span>
                                <span className="font-bold text-blue-600">
                                  {formatCurrency(selectedItemsTotal)}
                                </span>
                              </div>
                              <button
                                onClick={handleAddSelectedItems}
                                disabled={loading || selectedItemTypes === 0}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {loading ? (
                                  <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    Adding...
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    Add to Bill
                                  </>
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* VIEW BILL BUTTON */}
                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
                  <div className="text-xs text-gray-500">
                    {bill?.items?.length || 0} items already in bill
                  </div>
                  <button
                    onClick={() => setActivePage("bill")}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    <Receipt className="h-4 w-4" />
                    View Bill
                  </button>
                </div>
              </div>
            )}

            {/* =================================================
                PAYMENT HISTORY PAGE
            ================================================= */}

            {activePage === "payments" && (
              <div key="payments" className="page-fade p-6">
                {/* PAYMENT SUMMARY */}
                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="shrink-0 rounded-lg bg-blue-100 p-2.5">
                        <Receipt className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-800">Bill Total</p>
                        <p className="truncate text-xs text-gray-500">Total charges</p>
                      </div>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-base font-bold text-blue-600 sm:text-sm md:text-base lg:text-lg">
                      {formatCurrency(billTotal)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="shrink-0 rounded-lg bg-green-100 p-2.5">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-800">Total Paid</p>
                        <p className="truncate text-xs text-gray-500">
                          {payments.length} payment{payments.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-base font-bold text-green-600 sm:text-sm md:text-base lg:text-lg">
                      {formatCurrency(totalPaid)}
                    </p>
                  </div>

                  <div
                    className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${
                      isOverpaid
                        ? "border-blue-200 bg-blue-50"
                        : isFullyPaid
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`shrink-0 rounded-lg p-2.5 ${
                          isOverpaid
                            ? "bg-blue-100"
                            : isFullyPaid
                            ? "bg-green-100"
                            : "bg-red-100"
                        }`}
                      >
                        {isOverpaid ? (
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                        ) : isFullyPaid ? (
                          <Check className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-800">
                          {isOverpaid ? "Credit" : isFullyPaid ? "Fully Paid" : "Remaining"}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {isOverpaid
                            ? "Advance payment"
                            : isFullyPaid
                            ? "No balance due"
                            : "Amount to collect"}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`shrink-0 whitespace-nowrap text-base font-bold sm:text-sm md:text-base lg:text-lg ${
                        isOverpaid
                          ? "text-blue-600"
                          : isFullyPaid
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {isOverpaid
                        ? formatCurrency(Math.abs(remainingBalance))
                        : isFullyPaid
                        ? "✓"
                        : formatCurrency(remainingBalance)}
                    </p>
                  </div>
                </div>

                {/* PAYMENT LIST */}
                {payments.length === 0 ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-center">
                    <History className="mb-4 h-16 w-16 text-gray-300" />
                    <p className="font-medium text-gray-600">No payments recorded yet.</p>
                    <p className="mt-1 text-sm text-gray-400">
                      Add a payment to start tracking.
                    </p>

                    {billTotal > 0 && (
                      <button
                        onClick={() => setPaymentModalOpen(true)}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition hover:from-green-700 hover:to-emerald-700"
                      >
                        <Wallet className="h-4 w-4" />
                        Add Payment
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Date & Time
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Method
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Received By
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                            Amount
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {payments.map((payment, index) => (
                          <tr
                            key={payment.payment_id}
                            className="transition-colors hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-500">
                              {index + 1}
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatDate(payment.payment_datetime)}
                            </td>

                            <td className="px-4 py-3">
                              <PaymentMethodBadge method={payment.payment_method} />
                            </td>

                            <td className="px-4 py-3">
                              <AddedByTag addedBy={payment.payment_receiver} />
                            </td>

                            <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                              +{formatCurrency(payment.payment_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-green-50/50">
                          <td colSpan="4" className="px-4 py-3 text-right text-lg font-bold text-gray-800">
                            Total Paid
                          </td>
                          <td className="px-4 py-3 text-right text-lg font-bold text-green-600">
                            {formatCurrency(totalPaid)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={() => setActivePage("bill")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    <Receipt className="h-4 w-4" />
                    View Bill
                  </button>

                  {billTotal > 0 && (
                    <button
                      onClick={() => setPaymentModalOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition hover:from-green-700 hover:to-emerald-700"
                    >
                      <Wallet className="h-4 w-4" />
                      {isFullyPaid ? "Add Advance Payment" : "Add Payment"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ====================================================
            BOTTOM BACK
        ==================================================== */}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-6 py-2.5 text-gray-700 transition-colors hover:bg-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Rooms
          </button>
        </div>
      </div>

      {/* ======================================================
          RETURN / DEDUCT MODAL
      ====================================================== */}

      {showReturnModal && returnItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            {/* HEADER */}
            <div className="rounded-t-xl bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {returnItem.item_type === "custom" ? "Deduct Quantity" : "Return Item"}
                  </h2>

                  <p className="text-sm text-amber-100">
                    {returnItem.item_name}
                    {returnItem.item_type === "custom" && " (Exclusive)"}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setReturnItem(null);
                    setReturnQuantity(1);
                  }}
                  className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* BODY */}
            <div className="p-6">
              {/* DETAILS */}
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Currently Billed:</span>
                  <span className="font-semibold text-gray-800">
                    {returnItem.quantity} units
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Unit Price:</span>
                  <span className="font-semibold text-gray-800">
                    {formatCurrency(returnItem.unit_price)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Billed:</span>
                  <span className="font-semibold text-gray-800">
                    {formatCurrency(returnItem.total)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Added By:</span>
                  <AddedByTag addedBy={returnItem.added_by} />
                </div>
              </div>

              {/* QUANTITY */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Quantity to {returnItem.item_type === "custom" ? "Deduct" : "Return"}
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setReturnQuantity((prev) => Math.max(1, Number(prev) - 1))
                    }
                    className="rounded-lg bg-gray-100 p-2 transition-colors hover:bg-gray-200"
                  >
                    <Minus className="h-4 w-4 text-gray-600" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max={returnItem.quantity}
                    step="1"
                    value={returnQuantity}
                    onChange={(e) => {
                      let value = parseInt(e.target.value, 10);
                      if (Number.isNaN(value)) value = 1;
                      value = Math.max(1, Math.min(Number(returnItem.quantity), value));
                      setReturnQuantity(value);
                    }}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-center font-semibold outline-none focus:border-amber-500"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setReturnQuantity((prev) =>
                        Math.min(Number(returnItem.quantity), Number(prev) + 1)
                      )
                    }
                    className="rounded-lg bg-gray-100 p-2 transition-colors hover:bg-gray-200"
                  >
                    <Plus className="h-4 w-4 text-gray-600" />
                  </button>
                </div>

                <p className="mt-1 text-xs text-gray-500">Max: {returnItem.quantity} units</p>
              </div>

              {/* AMOUNT */}
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {returnItem.item_type === "custom" ? "Amount to Deduct:" : "Refund Amount:"}
                  </span>
                  <span className="font-bold text-amber-600">
                    {formatCurrency(Number(returnQuantity) * Number(returnItem.unit_price))}
                  </span>
                </div>

                {returnQuantity === Number(returnItem.quantity) &&
                  returnItem.item_type === "custom" && (
                    <p className="mt-1 text-xs text-amber-600">
                      ⚠️ This will completely remove the item.
                    </p>
                  )}
              </div>

              {/* ACTIONS */}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowReturnModal(false);
                    setReturnItem(null);
                    setReturnQuantity(1);
                  }}
                  className="flex-1 rounded-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleReturnItem}
                  disabled={
                    loading ||
                    returnQuantity <= 0 ||
                    returnQuantity > Number(returnItem.quantity)
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-white shadow-md transition-all hover:from-amber-700 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}