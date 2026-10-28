// RegistrationHistoryPage.jsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  Search,
  CheckCircle,
  User,
  Phone,
  Bed,
  FileText,
  Receipt,
  Wallet,
  Fingerprint,
  CalendarDays,
  ArrowLeft,
  Clock,
  Plus,
  Minus,
  Check,
  AlertCircle,
  TrendingUp,
  Banknote,
  CreditCard,
  Package,
  Coffee,
  ShoppingBag,
  MoreHorizontal,
  Bot,
  UserCog,
  History,
  ChevronRight,
} from "lucide-react";

// ============================================================
// HELPERS
// ============================================================

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(
    String(value).includes("T") ? value : String(value).replace(" ", "T")
  );
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateShort = (value) => {
  if (!value) return "—";
  const date = new Date(
    String(value).includes("T") ? value : String(value).replace(" ", "T")
  );
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ============================================================
// STATUS CONFIG
// ============================================================

const STATUS_CONFIG = {
  active: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "Active",
  },
  completed: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    label: "Completed",
  },
  cancelled: {
    border: "border-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-700",
    dot: "bg-rose-500",
    label: "Cancelled",
  },
  reserved: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "Reserved",
  },
};

function getStatusConfig(status) {
  return (
    STATUS_CONFIG[String(status || "").toLowerCase()] || {
      border: "border-gray-200",
      bg: "bg-gray-100",
      text: "text-gray-600",
      dot: "bg-gray-400",
      label: status || "Unknown",
    }
  );
}

function StatusBadge({ status }) {
  const config = getStatusConfig(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

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
      {isSystem ? <Bot className="h-3 w-3" /> : <UserCog className="h-3 w-3" />}
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
      {isCash ? <Banknote className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
      {isCash ? "Cash" : "Online"}
    </span>
  );
}

// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({ label, value, subtitle, icon: Icon, color = "blue" }) {
  const colorMap = {
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    indigo: "bg-indigo-100 text-indigo-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-500">{label}</div>
          <div className="text-xl font-bold text-gray-800">{value}</div>
          {subtitle && <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FINANCIAL DETAILS MODAL (Popup View)
// ============================================================

function FinancialDetailsModal({ isOpen, onClose, registration, loading, error, bill, payments }) {
  const [activeTab, setActiveTab] = useState("bills");

  useEffect(() => {
    if (isOpen) setActiveTab("bills");
  }, [isOpen]);

  if (!isOpen || !registration) return null;

  const total = Number(bill?.total ?? bill?.subtotal ?? 0);
  const paid = Number(payments?.total_paid ?? 0);
  const balance = total - paid;
  const isTip = balance < -0.005;
  const isFullyPaid = !isTip && balance <= 0.005 && total > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between rounded-t-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/20 p-2">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Financial Details</h2>
              <p className="text-sm text-blue-100">
                Registration #{registration.registration_id} • {registration.customer_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white transition-colors hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CUSTOMER SUMMARY BAR */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-gray-600">
                <Phone className="h-3.5 w-3.5" />
                {registration.phone_number || "No phone"}
              </span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <Bed className="h-3.5 w-3.5" />
                {Number(registration.room_count) || 0} rooms
              </span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(registration.check_in)}
              </span>
            </div>
            <StatusBadge status={registration.status} />
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-gray-200 px-6 shrink-0">
          <button
            onClick={() => setActiveTab("bills")}
            className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition ${
              activeTab === "bills" ? "text-blue-600" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Receipt className="h-4 w-4" />
            Bills
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px]">
              {bill?.items?.length ?? "—"}
            </span>
            {activeTab === "bills" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition ${
              activeTab === "payments" ? "text-blue-600" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Wallet className="h-4 w-4" />
            Payments
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px]">
              {payments?.payments?.length ?? "—"}
            </span>
            {activeTab === "payments" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-600" />
            )}
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center gap-3 text-sm text-gray-500">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
              Loading financial details...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              <p className="font-bold">Unable to load details</p>
              <p className="mt-2 break-words">{error}</p>
            </div>
          ) : (
            <>
              {/* SUMMARY CARDS */}
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="shrink-0 rounded-lg bg-blue-100 p-2">
                      <Receipt className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">Bill Total</p>
                      <p className="truncate text-[11px] text-gray-500">
                        {bill?.items?.length || 0} item{bill?.items?.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-sm font-bold text-blue-600">
                    {money(total)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="shrink-0 rounded-lg bg-green-100 p-2">
                      <Wallet className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">Total Paid</p>
                      <p className="truncate text-[11px] text-gray-500">
                        {payments?.payments?.length || 0} payment
                        {payments?.payments?.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-sm font-bold text-green-600">
                    {money(paid)}
                  </p>
                </div>

                {/* DISCOUNT / TIP CARD */}
                <div
                  className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${
                    isTip
                      ? "border-blue-200 bg-blue-50"
                      : isFullyPaid
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={`shrink-0 rounded-lg p-2 ${
                        isTip ? "bg-blue-100" : isFullyPaid ? "bg-green-100" : "bg-red-100"
                      }`}
                    >
                      {isTip ? (
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      ) : isFullyPaid ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {isTip ? "Tip" : isFullyPaid ? "Fully Paid" : "Discount"}
                      </p>
                      <p className="truncate text-[11px] text-gray-500">
                        {isTip
                          ? "Extra payment"
                          : isFullyPaid
                          ? "No balance due"
                          : "Amount to collect"}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`shrink-0 whitespace-nowrap text-sm font-bold ${
                      isTip ? "text-blue-600" : isFullyPaid ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isTip ? money(Math.abs(balance)) : isFullyPaid ? "✓" : money(balance)}
                  </p>
                </div>
              </div>

              {/* TAB CONTENT */}
              {activeTab === "bills" ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">Bill Items</h3>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                      {bill?.items?.length ?? 0} items
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="px-4 py-3 font-bold">Item</th>
                          <th className="px-3 py-3 font-bold">Type</th>
                          <th className="px-3 py-3 font-bold">Added By</th>
                          <th className="px-3 py-3 text-right font-bold">Qty</th>
                          <th className="px-3 py-3 text-right font-bold">Unit Price</th>
                          <th className="px-4 py-3 text-right font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(bill?.items || []).map((item) => {
                          const isCustom = item.item_type === "custom";
                          const displayType = isCustom ? "Exclusive" : item.item_type;
                          return (
                            <tr
                              key={item.bill_id}
                              className={`transition hover:bg-gray-50 ${
                                isCustom ? "bg-amber-50/30" : ""
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {isCustom ? (
                                    <ShoppingBag className="h-4 w-4 text-amber-500" />
                                  ) : item.is_inventory ? (
                                    <Package className="h-4 w-4 text-blue-500" />
                                  ) : (
                                    <Coffee className="h-4 w-4 text-purple-500" />
                                  )}
                                  <div>
                                    <p className="font-semibold text-gray-800">
                                      {item.item_name || "Unnamed item"}
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-gray-400">
                                      {formatDate(item.added_at)}
                                    </p>
                                  </div>
                                  {isCustom && (
                                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                      Exclusive
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-sm capitalize text-gray-600">
                                {displayType}
                              </td>
                              <td className="px-3 py-3">
                                <AddedByTag addedBy={item.added_by} />
                              </td>
                              <td className="px-3 py-3 text-right text-sm font-medium text-gray-800">
                                {item.quantity}
                              </td>
                              <td className="px-3 py-3 text-right text-sm text-gray-600">
                                {money(item.unit_price)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-gray-800">
                                {money(item.total)}
                              </td>
                            </tr>
                          );
                        })}
                        {!bill?.items?.length && (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                              No bill items recorded.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">Payment History</h3>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                      {payments?.payments?.length ?? 0} payments
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="px-4 py-3 font-bold">#</th>
                          <th className="px-3 py-3 font-bold">Date & Time</th>
                          <th className="px-3 py-3 font-bold">Method</th>
                          <th className="px-3 py-3 font-bold">Received By</th>
                          <th className="px-4 py-3 text-right font-bold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(payments?.payments || []).map((payment, index) => (
                          <tr key={payment.payment_id} className="transition hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-500">
                              {index + 1}
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-700">
                              {formatDate(payment.payment_datetime)}
                            </td>
                            <td className="px-3 py-3">
                              <PaymentMethodBadge method={payment.payment_method} />
                            </td>
                            <td className="px-3 py-3">
                              <AddedByTag addedBy={payment.payment_receiver} />
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                              +{money(payment.payment_amount)}
                            </td>
                          </tr>
                        ))}
                        {!payments?.payments?.length && (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                              No payments recorded.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {activeTab === "bills" ? "Bill summary" : "Payment summary"}
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <span className="text-gray-500">Total: </span>
                <span className="font-bold text-gray-800">{money(total)}</span>
              </div>
              <div>
                <span className="text-gray-500">Paid: </span>
                <span className="font-bold text-green-600">{money(paid)}</span>
              </div>
              <div>
                <span className="text-gray-500">
                  {isTip ? "Tip: " : "Discount: "}
                </span>
                <span
                  className={`font-bold ${
                    isTip ? "text-blue-600" : isFullyPaid ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isTip ? money(Math.abs(balance)) : isFullyPaid ? "✓" : money(balance)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function RegistrationHistoryPage() {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  const [bill, setBill] = useState(null);
  const [payments, setPayments] = useState(null);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Message system
  const [messages, setMessages] = useState([]);
  const addMessage = (text, type = "info", duration = 5000) => {
    const id = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id, text, type, duration }]);
    if (duration > 0) setTimeout(() => removeMessage(id), duration);
  };
  const removeMessage = (id) =>
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  const showError = (text, duration = 6000) => addMessage(text, "error", duration);

  // ============================================================
  // DATA LOADING
  // ============================================================

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError("");
    try {
      const result = await invoke("get_registration_history", {
        page,
        pageSize,
        search: search.trim(),
      });
      const records = Array.isArray(result?.registrations) ? result.registrations : [];
      setHistory(records);
      setTotalCount(Number(result?.total_count) || 0);
      setTotalPages(Number(result?.total_pages) || 0);
      setSelectedId((current) => {
        if (
          current !== null &&
          records.some((item) => Number(item.registration_id) === Number(current))
        ) {
          return current;
        }
        return null;
      });
    } catch (error) {
      setHistoryError(String(error));
      setHistory([]);
      setTotalCount(0);
      setTotalPages(0);
      setSelectedId(null);
      showError(`Failed to load history: ${String(error)}`);
    } finally {
      setLoadingHistory(false);
    }
  }, [page, pageSize, search, refreshKey]);

  useEffect(() => {
    const timer = setTimeout(() => loadHistory(), search.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadHistory]);

  const selected = useMemo(
    () => history.find((item) => item.registration_id === selectedId) || null,
    [history, selectedId]
  );

  // Load details when a registration is selected (for modal)
  useEffect(() => {
    if (selectedId === null) {
      setBill(null);
      setPayments(null);
      setDetailsError("");
      setLoadingDetails(false);
      return;
    }

    let cancelled = false;

    async function loadDetails() {
      setLoadingDetails(true);
      setDetailsError("");
      setBill(null);
      setPayments(null);
      try {
        const [billResult, paymentResult] = await Promise.all([
          invoke("get_registration_bill", { registrationId: selectedId }),
          invoke("get_registration_payments", { registrationId: selectedId }),
        ]);
        if (cancelled) return;
        setBill(billResult);
        setPayments(paymentResult);
      } catch (error) {
        if (!cancelled) {
          setDetailsError(String(error));
          showError(`Failed to load details: ${String(error)}`);
        }
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    }

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const openFinancialModal = (registration) => {
    setSelectedId(registration.registration_id);
    setModalOpen(true);
  };

  const closeFinancialModal = () => {
    setModalOpen(false);
    setSelectedId(null);
    setBill(null);
    setPayments(null);
    setDetailsError("");
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      <style>{`
        @keyframes pageFade {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .page-fade { animation: pageFade 250ms ease-out; }
        .reg-row { transition: background-color 140ms ease, border-color 140ms ease; }
      `}</style>

      <div className="relative mx-auto max-w-7xl p-6">
        {/* MESSAGES */}
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

        {/* FINANCIAL DETAILS MODAL */}
        <FinancialDetailsModal
          isOpen={modalOpen}
          onClose={closeFinancialModal}
          registration={selected}
          loading={loadingDetails}
          error={detailsError}
          bill={bill}
          payments={payments}
        />

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <History className="h-6 w-6 text-blue-600" />
            Registration History
          </h1>
          <p className="text-sm text-gray-500">
            Click any registration to view its financial details
          </p>
        </div>

        {/* STATS DASHBOARD */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard
            label="Total Registrations"
            value={totalCount}
            subtitle="Matching records"
            icon={FileText}
            color="blue"
          />
          <SummaryCard
            label="Active"
            value={history.filter((i) => String(i.status).toLowerCase() === "active").length}
            subtitle="On this page"
            icon={CheckCircle}
            color="emerald"
          />
          <SummaryCard
            label="Completed"
            value={history.filter((i) => String(i.status).toLowerCase() === "completed").length}
            subtitle="On this page"
            icon={Receipt}
            color="indigo"
          />
          <SummaryCard
            label="Page"
            value={`${totalPages === 0 ? 0 : page}/${totalPages}`}
            subtitle={`${pageSize} per page`}
            icon={CalendarDays}
            color="amber"
          />
        </div>

        {/* LIST */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* SEARCH BAR */}
          <div className="border-b border-gray-200 bg-white px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, phone, ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {totalCount === 0
                  ? "No registrations"
                  : `Showing ${(page - 1) * pageSize + 1}–${Math.min(
                      page * pageSize,
                      totalCount
                    )} of ${totalCount}`}
              </div>
            </div>
          </div>

          {historyError && (
            <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">Could not load history</p>
              <p className="mt-1 break-words text-xs">{historyError}</p>
            </div>
          )}

          {/* LIST ROWS */}
          {loadingHistory && history.length === 0 ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
                <p className="mt-4 text-gray-600">Loading registrations...</p>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <FileText className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold text-gray-700">No bookings found</p>
              <p className="mt-1 text-xs text-gray-400">Try a different search term.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((item) => (
                <button
                  key={item.registration_id}
                  type="button"
                  onClick={() => openFinancialModal(item)}
                  className="reg-row flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-blue-50/40 focus:bg-blue-50/40 focus:outline-none"
                >
                  {/* Avatar */}
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                    <User className="h-5 w-5 text-white" />
                  </div>

                  {/* Main Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">
                        #{item.registration_id}
                      </span>
                      <h3 className="truncate text-sm font-semibold text-gray-800">
                        {item.customer_name || "Unknown customer"}
                      </h3>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {item.phone_number || "No phone"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Bed className="h-3 w-3" />
                        {Number(item.room_count) || 0} rooms
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3" />
                        {formatDateShort(item.check_in)}
                      </span>
                      {item.relation && (
                        <span className="flex items-center gap-1.5 capitalize">
                          <Fingerprint className="h-3 w-3" />
                          {item.relation}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex flex-shrink-0 items-center gap-2 text-xs font-semibold text-blue-600">
                    <span className="hidden sm:inline">View Financials</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* PAGINATION */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={page <= 1 || loadingHistory}
                onClick={() => {
                  setSelectedId(null);
                  setPage((c) => Math.max(1, c - 1));
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>
              <span className="text-sm font-semibold text-gray-500">
                Page {totalPages === 0 ? 0 : page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loadingHistory || totalPages === 0}
                onClick={() => {
                  setSelectedId(null);
                  setPage((c) => Math.min(totalPages, c + 1));
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}