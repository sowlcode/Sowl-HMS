// StaffPage.jsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";

import {
  AlertCircle,
  Banknote,
  Briefcase,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  FileText,
  Gift,
  History,
  Info,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  UserX,
  Wallet,
  X,
} from "lucide-react";

// ============================================================
// CONSTANTS & HELPERS
// ============================================================

const MAX_DOC_MB = 5;
const MAX_DOC_BYTES = MAX_DOC_MB * 1024 * 1024;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

const today = () => {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
};

// Parses "YYYY-MM-DD" without timezone shifts
const parseISO = (iso) => {
  if (!iso || typeof iso !== "string") return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
};

const addDaysISO = (iso, n) => {
  const p = parseISO(iso);
  if (!p) return iso;
  const d = new Date(p.year, p.month, p.day + n);
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));

const dateLabel = (iso) => {
  const p = parseISO(iso);
  if (!p) return iso || "—";
  return new Date(p.year, p.month, p.day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

// Monday-first grid cells: nulls for leading blanks, then 1..N
const buildMonthCells = (year, month) => {
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
};

const emptyStaffForm = () => ({
  name: "",
  phoneNumber: "",
  address: "",
  position: "",
  documentPicture: "",
  salary: "",
  startDate: today(),
});

const formFromStaff = (s) => ({
  name: s.name || "",
  phoneNumber: s.phone_number || "",
  address: s.address || "",
  position: s.position || "",
  documentPicture: s.document_picture || "",
  salary: String(s.salary ?? ""),
  startDate: s.start_date || today(),
});

// Salary is only sent when creating staff. The backend's update_staff does not accept it
// (salary changes go through change_staff_salary).
const buildStaffArgs = (f, { includeSalary }) => {
  const args = {
    name: f.name.trim(),
    phoneNumber: f.phoneNumber.trim(),
    address: f.address.trim() || null,
    position: f.position.trim(),
    // Stored exactly as read from the file (full base64 data URL) — never trimmed or re-encoded
    documentPicture: f.documentPicture || null,
    startDate: f.startDate,
  };
  if (includeSalary) args.salary = Number(f.salary);
  return args;
};

const ABSENCE_TYPES = [
  {
    id: "full_day",
    label: "Full day",
    hint: "Deducts one full day's pay",
    icon: UserX,
    active: "border-red-400 bg-red-50 ring-2 ring-red-100",
    iconActive: "text-red-600",
  },
  {
    id: "half_day",
    label: "Half day",
    hint: "Deducts half a day's pay",
    icon: Clock,
    active: "border-orange-400 bg-orange-50 ring-2 ring-orange-100",
    iconActive: "text-orange-600",
  },
];

const absenceLabel = (type) => (type === "half_day" ? "Half day" : "Full day");

const absenceBadgeClass = (type) =>
  type === "half_day"
    ? "border-orange-200 bg-orange-50 text-orange-700"
    : "border-red-200 bg-red-50 text-red-700";

const salaryStatus = (record) => {
  const t = today();
  if (record.effective_from > t) return "scheduled";
  if (!record.effective_to || t < record.effective_to) return "current";
  return "past";
};

const SALARY_STATUS_STYLES = {
  current: { label: "Current", cls: "border-green-200 bg-green-50 text-green-700" },
  scheduled: { label: "Scheduled", cls: "border-blue-200 bg-blue-50 text-blue-700" },
  past: { label: "Past", cls: "border-gray-200 bg-gray-100 text-gray-600" },
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50";

// Shared modal footer layout: stacked (primary on top) on phones, one row from sm up
const footerClass =
  "flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:gap-3";
const cancelBtnClass =
  "rounded-lg px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 sm:flex-1";
const submitBtnBase =
  "flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1";

const TONES = {
  blue: { box: "bg-blue-50", icon: "text-blue-600" },
  green: { box: "bg-green-50", icon: "text-green-600" },
  amber: { box: "bg-amber-50", icon: "text-amber-600" },
  orange: { box: "bg-orange-50", icon: "text-orange-600" },
  purple: { box: "bg-purple-50", icon: "text-purple-600" },
  red: { box: "bg-red-50", icon: "text-red-600" },
  gray: { box: "bg-gray-100", icon: "text-gray-600" },
};

// ============================================================
// STAT CARD
// ============================================================

function StatCard({ icon: Icon, label, value, hint, tone = "blue" }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded-lg p-2 ${t.box}`}>
          <Icon className={`h-5 w-5 ${t.icon}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-gray-500">{label}</div>
          <div className="mt-0.5 break-words text-[15px] font-semibold tabular-nums leading-snug text-gray-900">
            {value}
          </div>
          {hint ? <div className="mt-0.5 text-[11px] leading-snug text-gray-400">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

// Section card with a consistent header
function Card({ icon: Icon, iconClass = "text-blue-600", title, description, actions, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
            {Icon ? <Icon className={`h-5 w-5 ${iconClass}`} /> : null}
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

// ============================================================
// CONFIRMATION DIALOG (custom — replaces window.confirm)
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
        NoteIcon: Check,
        noteText: "Please review the details above before confirming.",
        sub: "Please confirm to proceed",
      }
      : {
        header: "bg-gradient-to-r from-red-600 to-red-700",
        headerSub: "text-red-100",
        button:
          "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800",
        note: "bg-red-50 text-red-600",
        NoteIcon: AlertCircle,
        noteText: "This action cannot be undone.",
        sub: "This action cannot be undone",
      };
  const NoteIcon = theme.NoteIcon;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className={`rounded-t-xl px-5 py-4 sm:px-6 ${theme.header}`}>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/20 p-1.5">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className={`text-sm ${theme.headerSub}`}>{theme.sub}</p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <p className="mb-3 text-sm text-gray-600">{message}</p>
          <p className={`flex items-center gap-2 rounded-lg p-2.5 text-sm ${theme.note}`}>
            <NoteIcon className="h-4 w-4 shrink-0" />
            {theme.noteText}
          </p>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-50 ${theme.button}`}
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

const CLOSED_CONFIRM = {
  isOpen: false,
  title: "",
  message: "",
  confirmText: "Confirm",
  onConfirm: null,
  loading: false,
  icon: Trash2,
  variant: "danger",
};

// ============================================================
// MODAL SHELL
// ============================================================

function Modal({
  title,
  subtitle,
  icon: Icon,
  gradient = "from-blue-600 to-indigo-600",
  subColor = "text-blue-100",
  onClose,
  children,
  size = "md",
  busy = false,
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-xl ${size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
          }`}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`flex shrink-0 items-center justify-between bg-gradient-to-r px-5 py-4 sm:px-6 ${gradient}`}
        >
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
              <span className="truncate">{title}</span>
            </h2>
            {subtitle ? <p className={`truncate text-sm ${subColor}`}>{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-white transition-colors hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

function FormError({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function FormNote({ tone = "gray", children }) {
  const cls = {
    gray: "border-gray-200 bg-gray-50 text-gray-600",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone];
  return (
    <p className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${cls}`}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function SavingContent({ label = "Saving..." }) {
  return (
    <>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      <span>{label}</span>
    </>
  );
}

// ============================================================
// CUSTOM DATE PICKER (replaces <input type="date">)
// ============================================================

function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  clearable = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: 2000, month: 0 });
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const POP_W = 288;
  const POP_H = 372;

  const openPicker = () => {
    if (disabled) return;
    const base = parseISO(value) || parseISO(today());
    setView({ year: base.year, month: base.month });

    const rect = btnRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - POP_W - 8));
    let top = rect.bottom + 6;
    if (top + POP_H > window.innerHeight) {
      top = Math.max(8, rect.top - POP_H - 6);
    }
    setPos({ top, left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;

    const onMouseDown = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = (e) => {
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const shift = (months) => {
    const d = new Date(view.year, view.month + months, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const isDisabledDay = (iso) => (min && iso < min) || (max && iso > max);
  const todayIso = today();
  const cells = buildMonthCells(view.year, view.month);

  const navBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 ${open ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-300"
          }`}
      >
        <span className={value ? "text-gray-800" : "text-gray-400"}>
          {value ? dateLabel(value) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open
        ? createPortal(
          <div
            ref={popRef}
            style={{ top: pos.top, left: pos.left, width: POP_W }}
            className="fixed z-[300] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex">
                <button type="button" className={navBtn} onClick={() => shift(-12)} aria-label="Previous year">
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button type="button" className={navBtn} onClick={() => shift(-1)} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {monthLabel(view.year, view.month)}
              </span>
              <div className="flex">
                <button type="button" className={navBtn} onClick={() => shift(1)} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button type="button" className={navBtn} onClick={() => shift(12)} aria-label="Next year">
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-gray-400">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} className="h-9" />;
                const iso = toISO(view.year, view.month, day);
                const off = isDisabledDay(iso);
                const selected = iso === value;
                const isToday = iso === todayIso;

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={off}
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    className={`h-9 rounded-lg text-sm transition ${selected
                      ? "bg-blue-600 font-semibold text-white shadow-sm"
                      : off
                        ? "cursor-not-allowed text-gray-300"
                        : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      } ${isToday && !selected ? "font-semibold text-blue-600 ring-1 ring-blue-300" : ""}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
              <button
                type="button"
                disabled={isDisabledDay(todayIso)}
                onClick={() => {
                  onChange(todayIso);
                  setOpen(false);
                }}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
              >
                Today
              </button>
              {clearable && value ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>,
          document.body
        )
        : null}
    </>
  );
}

// ============================================================
// DOCUMENT UPLOAD (browse or drag & drop → base64 data URL)
// ============================================================

function DocumentUpload({ value, onChange, onRemove, onView, onError, disabled = false }) {
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);

  const processFile = (file) => {
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      onError("Please choose an image file (PNG, JPG, WEBP, etc.)");
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      onError(`Image is too large. Maximum size is ${MAX_DOC_MB} MB.`);
      return;
    }

    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setReading(false);
      onChange(String(reader.result)); // data:image/...;base64,XXXX
    };
    reader.onerror = () => {
      setReading(false);
      onError("Could not read the selected file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    processFile(e.dataTransfer?.files?.[0]);
  };

  const browse = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          processFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {value ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onView}
            disabled={!onView}
            className={`flex w-full items-center justify-center bg-gray-100 p-2 ${onView ? "cursor-zoom-in" : "cursor-default"
              }`}
          >
            <img
              src={value}
              alt="Staff document"
              className="max-h-56 w-auto rounded-lg object-contain"
            />
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white px-3 py-2">
            <span className="text-xs text-gray-500">Drop a new image here to replace</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={browse}
                disabled={disabled || reading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Replace
              </button>
              <button
                type="button"
                onClick={() => (onRemove ? onRemove() : onChange(""))}
                disabled={disabled || reading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={browse}
          disabled={disabled || reading}
          className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"
            }`}
        >
          {reading ? (
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          ) : (
            <Upload className={`h-8 w-8 ${dragging ? "text-blue-500" : "text-gray-400"}`} />
          )}
          <p className="mt-2 text-sm font-medium text-gray-700">
            {reading
              ? "Reading image..."
              : dragging
                ? "Drop the image to upload"
                : "Drag & drop an image here, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-gray-400">PNG, JPG or WEBP — up to {MAX_DOC_MB} MB</p>
        </button>
      )}

      {dragging && value ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-500 bg-blue-50/90 text-sm font-semibold text-blue-700">
          Drop to replace the image
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// READ-ONLY DOCUMENT PREVIEW (bottom staff details section)
// ============================================================

function DocumentPreview({ value, onView }) {
  return value ? (
    <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={onView}
        className="flex min-h-[220px] w-full cursor-zoom-in items-center justify-center bg-gray-50 p-4"
      >
        <img
          src={value}
          alt="Staff identity document"
          className="max-h-80 max-w-full rounded-lg object-contain"
        />
      </button>
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-green-700">
          <Check className="h-4 w-4" />
          Identity document available
        </div>
        <p className="mt-1 text-xs text-gray-400">Click the image to view it in full size.</p>
      </div>
    </div>
  ) : (
    <div className="mx-auto flex min-h-[220px] max-w-xl flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
      <FileText className="h-12 w-12 text-gray-300" />
      <p className="mt-3 text-sm font-medium text-gray-500">No document uploaded</p>
    </div>
  );
}

// ============================================================
// ATTENDANCE CALENDAR (custom month grid)
// ============================================================

function AttendanceCalendar({
  staff,
  absences,
  payments,
  monthCursor,
  onPrevMonth,
  onNextMonth,
  onPickDay,
}) {
  const { year, month } = monthCursor;

  // date -> "full_day" | "half_day"
  const absenceMap = useMemo(() => {
    const m = new Map();
    absences.forEach((a) => m.set(a.absent_date, a.absence_type));
    return m;
  }, [absences]);

  const paidSet = useMemo(() => {
    const s = new Set();
    payments.forEach((p) => {
      if (p.pay_date) s.add(p.pay_date);
    });
    return s;
  }, [payments]);

  const cells = buildMonthCells(year, month);
  const todayIso = today();

  const isEmployed = (iso) =>
    iso >= staff.start_date && (!staff.end_date || iso <= staff.end_date);

  const navBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800";

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <button type="button" className={navBtn} onClick={onPrevMonth} aria-label="Previous month">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="min-w-[140px] text-center text-sm font-semibold text-gray-800">
            {monthLabel(year, month)}
          </h3>
          <button type="button" className={navBtn} onClick={onNextMonth} aria-label="Next month">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-green-200" /> Present
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Full day
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Half day
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Payment
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} className="h-10 md:h-11" />;

          const iso = toISO(year, month, day);
          const employed = isEmployed(iso);
          const absenceType = absenceMap.get(iso) || null;
          const absent = Boolean(absenceType);
          const half = absenceType === "half_day";
          const paid = paidSet.has(iso);
          const isToday = iso === todayIso;

          // Fixed height (not aspect-square) so cells never balloon on tablet widths
          let cls =
            "relative flex h-10 flex-col items-center justify-center rounded-lg border text-sm font-medium transition md:h-11 ";
          if (!employed) cls += "cursor-default border-transparent text-gray-300";
          else if (half) cls += "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100";
          else if (absent) cls += "border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
          else if (paid) cls += "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100";
          else cls += "border-green-100 bg-green-50 text-green-700 hover:bg-green-100";
          if (isToday) cls += " ring-2 ring-blue-400 ring-offset-1";

          const title = absent ? `${dateLabel(iso)} — ${absenceLabel(absenceType)} absence` : dateLabel(iso);

          return (
            <button
              key={iso}
              type="button"
              disabled={!employed}
              onClick={() => onPickDay(iso, { absent, paid })}
              className={cls}
              title={title}
            >
              <span>{day}</span>
              {employed && (absent || paid) ? (
                <span className="mt-0.5 flex items-center gap-0.5">
                  {half ? (
                    <span className="text-[9px] font-bold leading-none text-orange-600">½</span>
                  ) : absent ? (
                    <span className="h-1 w-1 rounded-full bg-red-500" />
                  ) : null}
                  {paid ? <span className="h-1 w-1 rounded-full bg-yellow-500" /> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MAIN STAFF PAGE
// ============================================================

export default function StaffPage() {
  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------
  const [staffList, setStaffList] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [search, setSearch] = useState("");
  const [showFormer, setShowFormer] = useState(false); // former staff hidden by default
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState("attendance");
  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);

  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [paymentForm, setPaymentForm] = useState({ paidAmount: "", bonus: "0", payDate: today() });
  const [absenceForm, setAbsenceForm] = useState({ date: today(), type: "full_day" });
  const [salaryForm, setSalaryForm] = useState({ monthlySalary: "", effectiveFrom: today() });
  const [endDate, setEndDate] = useState(today());
  const [editingPayment, setEditingPayment] = useState(null);
  const [editingAbsence, setEditingAbsence] = useState(null);

  // Edit existing salary-history record (hooks must live INSIDE the component)
  const [editingSalary, setEditingSalary] = useState(null);
  const [editSalaryForm, setEditSalaryForm] = useState({ monthlySalary: "", effectiveFrom: "" });

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [messages, setMessages] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(CLOSED_CONFIRM);

  const detailsRequest = useRef(0);

  const selectedStaff = details?.staff ?? null;
  const summary = details?.salary_summary ?? null;

  // ----------------------------------------------------------
  // TOASTS (custom — no alert())
  // ----------------------------------------------------------
  const addMessage = useCallback((text, type = "info", duration = 5000) => {
    const id = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id, text, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, duration);
    }
  }, []);

  const removeMessage = (id) => setMessages((prev) => prev.filter((m) => m.id !== id));
  const showSuccess = useCallback((text) => addMessage(text, "success"), [addMessage]);
  const showError = useCallback((text) => addMessage(text, "error", 7000), [addMessage]);

  // ----------------------------------------------------------
  // LOADING
  // ----------------------------------------------------------
  const loadStaff = useCallback(
    async (preferredId) => {
      setLoading(true);
      try {
        const list = await invoke("get_all_staff", { includeFormerStaff: true });
        const safe = Array.isArray(list) ? list : [];
        setStaffList(safe);

        if (preferredId && safe.some((s) => s.staff_id === preferredId)) {
          setSelectedId(preferredId);
        } else if (safe.length > 0) {
          // Backend sorts current staff first, so this picks a current member when there is one
          setSelectedId(safe[0].staff_id);
        } else {
          setSelectedId(null);
          setDetails(null);
        }
      } catch (err) {
        console.error("Error loading staff:", err);
        showError(`Failed to load staff: ${String(err)}`);
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  const loadDetails = useCallback(
    async (staffId) => {
      if (!staffId) {
        setDetails(null);
        return;
      }
      const requestId = ++detailsRequest.current;
      try {
        const result = await invoke("get_staff_details", { staffId });
        if (requestId !== detailsRequest.current) return; // a newer request superseded this one
        setDetails(result);
        setEndDate(result?.staff?.end_date || today());
      } catch (err) {
        console.error("Error loading staff details:", err);
        showError(String(err));
      }
    },
    [showError]
  );

  useEffect(() => {
    loadStaff(null);
  }, [loadStaff]);

  useEffect(() => {
    if (selectedId) loadDetails(selectedId);
    else setDetails(null);
  }, [selectedId, loadDetails]);

  // Only jump the calendar back to "this month" when a different staff member is selected
  useEffect(() => {
    const d = new Date();
    setMonthCursor({ year: d.getFullYear(), month: d.getMonth() });
  }, [selectedId]);

  // ----------------------------------------------------------
  // DERIVED
  // ----------------------------------------------------------
  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staffList.filter((staff) => {
      const matches =
        !query ||
        (staff.name || "").toLowerCase().includes(query) ||
        (staff.position || "").toLowerCase().includes(query) ||
        String(staff.staff_id).includes(query);
      // The selected member always stays visible so the list never drops what you are editing
      return matches && (showFormer || !staff.end_date || staff.staff_id === selectedId);
    });
  }, [staffList, search, showFormer, selectedId]);

  const activeStaff = staffList.filter((s) => !s.end_date);
  const activeCount = activeStaff.length;
  const totalMonthlySalary = activeStaff.reduce((t, s) => t + Number(s.salary || 0), 0);

  const sortedAbsences = useMemo(
    () => [...(details?.absences || [])].sort((a, b) => (a.absent_date < b.absent_date ? 1 : -1)),
    [details]
  );

  const maxStaffDate = selectedStaff?.end_date || today();

  // Salary history is returned newest-first by effective date
  const salaryHistory = details?.salary_history || [];
  const latestSalaryDate = salaryHistory[0]?.effective_from || selectedStaff?.start_date || today();
  const salaryMinDate = addDaysISO(latestSalaryDate, 1);
  const salaryMaxDate = selectedStaff?.end_date || undefined;

  // ----------------------------------------------------------
  // ACTION RUNNER
  // The modal closes as soon as the backend call succeeds; the data refresh
  // runs in the background so the UI never waits on it.
  // ----------------------------------------------------------
  const runAction = async (action, successMessage, preferredId = selectedId) => {
    setSaving(true);
    try {
      await action();
      showSuccess(successMessage);
      setModal(null);
      setSaving(false);
      void Promise.all([
        loadStaff(preferredId),
        preferredId ? loadDetails(preferredId) : Promise.resolve(),
      ]);
      return true;
    } catch (err) {
      console.error("Action failed:", err);
      showError(String(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------
  // CONFIRMATION (custom — no window.confirm)
  // ----------------------------------------------------------
  const closeConfirm = () => setConfirmDialog(CLOSED_CONFIRM);

  const askConfirm = ({
    title,
    message,
    confirmText = "Confirm",
    icon = Trash2,
    variant = "danger",
    action,
    successMessage,
  }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      icon,
      variant,
      loading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        await runAction(action, successMessage);
        closeConfirm();
      },
    });
  };

  // ----------------------------------------------------------
  // STAFF ADD / EDIT
  // ----------------------------------------------------------
  const openAddStaff = () => {
    setStaffForm(emptyStaffForm());
    setFormError("");
    setModal({ type: "addStaff" });
  };

  const openEditStaff = () => {
    if (!selectedStaff) return;
    setStaffForm(formFromStaff(selectedStaff));
    setFormError("");
    setModal({ type: "editStaff" });
  };

  const validateStaff = (isEditing) => {
    if (!staffForm.name.trim()) return "Please enter the full name";
    if (!staffForm.phoneNumber.trim()) return "Please enter a phone number";
    if (!staffForm.position.trim()) return "Please enter a position";
    if (!isEditing) {
      const salary = Number(staffForm.salary);
      if (!staffForm.salary || Number.isNaN(salary) || salary <= 0) {
        return "Monthly salary must be greater than 0";
      }
      if (!staffForm.startDate) return "Please select an employment start date";
      if (staffForm.startDate > today()) return "Start date cannot be in the future";
    }
    return "";
  };

  const submitStaff = async (event) => {
    event.preventDefault();
    const isEditing = modal?.type === "editStaff";
    const err = validateStaff(isEditing);
    setFormError(err);
    if (err) return;

    const args = buildStaffArgs(staffForm, { includeSalary: !isEditing });

    await runAction(
      () =>
        isEditing
          ? invoke("update_staff", { staffId: selectedStaff.staff_id, ...args })
          : invoke("add_staff", args),
      isEditing ? "Staff details updated" : "Staff member added",
      isEditing ? selectedStaff.staff_id : null
    );
  };

  // ----------------------------------------------------------
  // SALARY CHANGES
  // ----------------------------------------------------------
  const openChangeSalary = () => {
    if (!selectedStaff) return;
    let initial = today() >= salaryMinDate ? today() : salaryMinDate;
    if (selectedStaff.end_date && initial > selectedStaff.end_date) initial = selectedStaff.end_date;
    setSalaryForm({ monthlySalary: "", effectiveFrom: initial });
    setFormError("");
    setModal({ type: "salary" });
  };

  const submitSalary = async (event) => {
    event.preventDefault();

    const amount = Number(salaryForm.monthlySalary);
    const d = salaryForm.effectiveFrom;

    let err = "";
    if (!salaryForm.monthlySalary || Number.isNaN(amount) || amount <= 0) {
      err = "Monthly salary must be greater than 0";
    } else if (!d) {
      err = "Please select the effective date";
    } else if (d < salaryMinDate) {
      err = `Effective date must be after the latest salary record (${dateLabel(latestSalaryDate)})`;
    } else if (salaryMaxDate && d > salaryMaxDate) {
      err = "Effective date cannot be after employment ends";
    }
    setFormError(err);
    if (err) return;

    await runAction(
      () =>
        invoke("change_staff_salary", {
          staffId: selectedStaff.staff_id,
          monthlySalary: amount,
          effectiveFrom: d,
        }),
      `Salary change recorded, effective ${dateLabel(d)}`
    );
  };

  // ----------------------------------------------------------
  // EDIT EXISTING SALARY HISTORY RECORD
  // ----------------------------------------------------------
  const openEditSalary = (record) => {
    setEditingSalary(record);
    setEditSalaryForm({
      monthlySalary: String(record.monthly_salary),
      effectiveFrom: record.effective_from,
    });
    setFormError("");
    setModal({ type: "editSalary" });
  };

  const closeEditSalary = () => {
    setModal(null);
    setEditingSalary(null);
    setFormError("");
  };

  const submitEditSalary = async (event) => {
    event.preventDefault();
    if (!selectedStaff || !editingSalary) return;

    const amount = Number(editSalaryForm.monthlySalary);
    const effectiveFrom = editSalaryForm.effectiveFrom;

    let err = "";
    if (!editSalaryForm.monthlySalary || Number.isNaN(amount) || amount <= 0) {
      err = "Monthly salary must be greater than 0";
    } else if (!effectiveFrom) {
      err = "Please select an effective date";
    } else if (effectiveFrom < selectedStaff.start_date) {
      err = "Effective date cannot be before employment start date";
    } else if (selectedStaff.end_date && effectiveFrom > selectedStaff.end_date) {
      err = "Effective date cannot be after employment ends";
    }

    setFormError(err);
    if (err) return;

    const ok = await runAction(
      () =>
        invoke("update_staff_salary_history", {
          salaryId: editingSalary.salary_id,
          monthlySalary: amount,
          effectiveFrom,
        }),
      "Salary history updated and salary recalculated"
    );

    if (ok) setEditingSalary(null);
  };

  // ----------------------------------------------------------
  // ABSENCES (full day / half day)
  // ----------------------------------------------------------
  const openAddAbsence = (date) => {
    if (!selectedStaff) return;
    let d = date || today();
    if (d < selectedStaff.start_date) d = selectedStaff.start_date;
    if (selectedStaff.end_date && d > selectedStaff.end_date) d = selectedStaff.end_date;

    setEditingAbsence(null);
    setAbsenceForm({ date: d, type: "full_day" });
    setFormError("");
    setModal({ type: "absence" });
  };

  const startEditAbsence = (absence) => {
    setEditingAbsence(absence);
    setAbsenceForm({ date: absence.absent_date, type: absence.absence_type || "full_day" });
    setFormError("");
    setModal({ type: "absence" });
  };

  const closeAbsenceModal = () => {
    setModal(null);
    setEditingAbsence(null);
    setFormError("");
  };

  const submitAbsence = async (event) => {
    event.preventDefault();

    const { date: d, type } = absenceForm;
    const duplicate = (details?.absences || []).some(
      (a) => a.absent_date === d && a.absence_id !== editingAbsence?.absence_id
    );

    let err = "";
    if (!d) err = "Please select the absence date";
    else if (d < selectedStaff.start_date) err = "Date is before the employment start date";
    else if (selectedStaff.end_date && d > selectedStaff.end_date) err = "Date is outside the employment period";
    else if (duplicate) err = "Attendance is already recorded for this date";
    setFormError(err);
    if (err) return;

    const typeText = type === "half_day" ? "Half-day absence" : "Absence";

    const ok = editingAbsence
      ? await runAction(
        () =>
          invoke("update_staff_absence", {
            absenceId: editingAbsence.absence_id,
            absentDate: d,
            absenceType: type,
          }),
        "Absence updated and salary recalculated"
      )
      : await runAction(
        () =>
          invoke("add_staff_absence", {
            staffId: selectedStaff.staff_id,
            absentDate: d,
            absenceType: type,
          }),
        `${typeText} recorded for ${dateLabel(d)}`
      );

    if (ok) setEditingAbsence(null);
  };

  const askDeleteAbsence = (absence) => {
    askConfirm({
      title: "Delete Absence",
      message: `Remove the ${absenceLabel(absence.absence_type).toLowerCase()} absence on ${dateLabel(
        absence.absent_date
      )}? Salary will be recalculated.`,
      confirmText: "Delete",
      icon: Trash2,
      action: () => invoke("delete_staff_absence", { absenceId: absence.absence_id }),
      successMessage: "Absence deleted and salary recalculated",
    });
  };

  // ----------------------------------------------------------
  // PAYMENTS
  // ----------------------------------------------------------
  const openAddPayment = () => {
    setEditingPayment(null);
    setPaymentForm({ paidAmount: "", bonus: "0", payDate: today() });
    setFormError("");
    setModal({ type: "payment" });
  };

  const startEditPayment = (payment) => {
    setEditingPayment(payment);
    setPaymentForm({
      paidAmount: String(payment.paid_amount),
      bonus: String(payment.bonus),
      payDate: payment.pay_date,
    });
    setFormError("");
    setModal({ type: "payment" });
  };

  const closePaymentModal = () => {
    setModal(null);
    setEditingPayment(null);
    setFormError("");
  };

  const submitPayment = async (event) => {
    event.preventDefault();

    const paid = Number(paymentForm.paidAmount || 0);
    const bonus = Number(paymentForm.bonus || 0);
    const d = paymentForm.payDate;

    let err = "";
    if (Number.isNaN(paid) || Number.isNaN(bonus)) err = "Amounts must be valid numbers";
    else if (paid < 0 || bonus < 0) err = "Amounts cannot be negative";
    else if (paid <= 0 && bonus <= 0) err = "Enter a salary amount or a bonus greater than 0";
    else if (!d) err = "Please select the payment date";
    else if (d < selectedStaff.start_date) err = "Date is before the employment start date";
    else if (d > maxStaffDate) err = "Date is outside the employment period";
    setFormError(err);
    if (err) return;

    const payload = { paidAmount: paid, bonus, payDate: d };

    const ok = editingPayment
      ? await runAction(
        () => invoke("update_staff_salary_payment", { paymentId: editingPayment.payment_id, ...payload }),
        "Salary payment corrected"
      )
      : await runAction(
        () => invoke("add_staff_salary_payment", { staffId: selectedStaff.staff_id, ...payload }),
        "Salary payment recorded"
      );

    if (ok) {
      setEditingPayment(null);
      setPaymentForm({ paidAmount: "", bonus: "0", payDate: today() });
    }
  };

  const askDeletePayment = (payment) => {
    askConfirm({
      title: "Delete Payment",
      message: `Delete the payment of ${formatCurrency(payment.paid_amount)} on ${dateLabel(
        payment.pay_date
      )}? The salary balance will be recalculated.`,
      confirmText: "Delete",
      icon: Trash2,
      action: () => invoke("delete_staff_salary_payment", { paymentId: payment.payment_id }),
      successMessage: "Payment deleted and balance recalculated",
    });
  };

  // ----------------------------------------------------------
  // END DATE
  // ----------------------------------------------------------
  const askSaveEndDate = () => {
    if (!endDate) {
      showError("Please select a final working date");
      return;
    }
    if (endDate < selectedStaff.start_date) {
      showError("Final working date cannot be before the start date");
      return;
    }
    askConfirm({
      title: "Set Final Working Date",
      message: `Mark ${selectedStaff.name}'s last working day as ${dateLabel(endDate)}?`,
      confirmText: "Save Date",
      icon: Check,
      variant: "success",
      action: () => invoke("set_staff_end_date", { staffId: selectedStaff.staff_id, endDate }),
      successMessage: "Final working date saved",
    });
  };

  // ----------------------------------------------------------
  // CALENDAR
  // ----------------------------------------------------------
  const handlePickCalendarDay = (iso) => {
    const absenceOnDay = details?.absences?.find((a) => a.absent_date === iso);
    if (absenceOnDay) startEditAbsence(absenceOnDay);
    else openAddAbsence(iso);
  };

  const prevMonth = () =>
    setMonthCursor((c) => {
      const d = new Date(c.year, c.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const nextMonth = () =>
    setMonthCursor((c) => {
      const d = new Date(c.year, c.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  // ----------------------------------------------------------
  // BALANCE STATE
  // ----------------------------------------------------------
  const balance = Number(summary?.salary_balance || 0);
  const balanceTone = balance > 0.01 ? "red" : balance < -0.01 ? "blue" : "green";

  const tabBtn = (id, label, Icon, activeColor = "text-blue-600") => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all md:flex-initial md:px-4 ${activeTab === id ? `bg-white ${activeColor} shadow-sm` : "text-gray-500 hover:text-gray-800"
        }`}
    >
      <span className="flex items-center justify-center gap-2">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </span>
    </button>
  );

  const tabMeta = {
    attendance: {
      icon: CalendarDays,
      iconClass: "text-blue-600",
      title: "Attendance",
      desc: "Click a day to record or edit a full-day or half-day absence",
    },
    payments: {
      icon: History,
      iconClass: "text-green-600",
      title: "Salary Payments",
      desc: `${details?.payments?.length || 0} payment${details?.payments?.length === 1 ? "" : "s"
        } recorded — bonuses are stored separately`,
    },
    salary: {
      icon: TrendingUp,
      iconClass: "text-purple-600",
      title: "Salary History",
      desc: `${salaryHistory.length} salary record${salaryHistory.length === 1 ? "" : "s"
        } — each day uses the salary in effect on that date`,
    },
  }[activeTab];

  const paymentOnAbsenceDate =
    modal?.type === "absence" && !editingAbsence
      ? details?.payments?.find((p) => p.pay_date === absenceForm.date)
      : null;

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------
  return (
    <>
      <style>{`
        @keyframes pageFade {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .page-fade { animation: pageFade 250ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .page-fade { animation: none; } }
        .thin-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .thin-scroll::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .thin-scroll::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 10px; }
        .thin-scroll::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
      `}</style>

      <div className="relative mx-auto max-w-7xl p-4 sm:p-6">
        {/* TOASTS */}
        {messages.length > 0 && (
          <div className="fixed right-4 top-4 z-[200] w-[calc(100%-2rem)] max-w-md space-y-2">
            {messages.map(({ id, text, type }) => (
              <div
                key={id}
                className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg ${type === "success"
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
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* CONFIRMATION DIALOG */}
        <ConfirmationDialog
          isOpen={confirmDialog.isOpen}
          onClose={closeConfirm}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          loading={confirmDialog.loading}
          icon={confirmDialog.icon}
          variant={confirmDialog.variant}
        />

        {/* HEADER */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
              <Users className="h-6 w-6 text-blue-600" />
              Staff & Salary
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage employment dates, attendance, salary payments and documents
            </p>
          </div>

          <button
            onClick={openAddStaff}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg"
          >
            <UserPlus className="h-4 w-4" />
            Add Staff Member
          </button>
        </div>

        {/* TOP STATS */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} tone="blue" label="Current Staff" value={activeCount} hint="Staff without an end date" />
          <StatCard
            icon={Banknote}
            tone="purple"
            label="Monthly Commitment"
            value={formatCurrency(totalMonthlySalary)}
            hint="Active staff combined"
          />
          <StatCard
            icon={Check}
            tone="green"
            label="Selected Staff Earned"
            value={formatCurrency(summary?.earned_salary)}
            hint="After absence deductions"
          />
          <StatCard
            icon={AlertCircle}
            tone="amber"
            label="Outstanding Salary"
            value={formatCurrency(summary?.salary_balance)}
            hint="Earned + bonuses − paid"
          />
        </div>

        {/* On tablet and below the directory becomes a compact strip above the details;
            from lg up it is a sticky sidebar. */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[304px_minmax(0,1fr)]">
          {/* DIRECTORY */}
          <aside className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-4">
            <div className="border-b border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold text-gray-800">
                  <Users className="h-5 w-5 text-blue-600" />
                  Staff Directory
                </h2>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {filteredStaff.length}
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search name, position or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={showFormer}
                    onChange={(e) => setShowFormer(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Include former staff
                </label>
              </div>
            </div>

            <div className="thin-scroll flex gap-2 overflow-x-auto p-2 lg:block lg:max-h-[calc(100vh-24rem)] lg:min-h-[260px] lg:space-y-1 lg:overflow-y-auto lg:overflow-x-hidden">
              {loading && staffList.length === 0 ? (
                <p className="w-full p-5 text-center text-sm text-gray-500">Loading staff…</p>
              ) : filteredStaff.length === 0 ? (
                <div className="w-full p-6 text-center">
                  <Users className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                  <p className="font-medium text-gray-600">No staff found</p>
                  <p className="mt-1 text-xs text-gray-400">Add a staff member to get started.</p>
                </div>
              ) : (
                filteredStaff.map((staff) => {
                  const active = staff.staff_id === selectedId;
                  return (
                    <button
                      key={staff.staff_id}
                      onClick={() => setSelectedId(staff.staff_id)}
                      className={`w-60 shrink-0 rounded-xl border p-3 text-left transition lg:w-full ${active ? "border-blue-200 bg-blue-50" : "border-gray-100 hover:bg-gray-50 lg:border-transparent"
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                            }`}
                        >
                          {(staff.name || "?").trim().slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-gray-800">{staff.name}</p>
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${staff.end_date ? "bg-gray-400" : "bg-green-500"
                                }`}
                              title={staff.end_date ? "Former staff" : "Currently employed"}
                            />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            ID #{staff.staff_id} • {formatCurrency(staff.salary)}/mo
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-400">
                            <Briefcase className="h-3 w-3 shrink-0" />
                            <span className="truncate">{staff.position || "Position not specified"}</span>
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* DETAILS */}
          <section className="min-w-0 space-y-5">
            {!selectedStaff || !summary ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 text-center lg:min-h-[420px]">
                <Users className="mb-4 h-16 w-16 text-gray-300" />
                <p className="font-medium text-gray-600">Select a staff member</p>
                <p className="mt-1 text-sm text-gray-400">
                  Choose someone from the directory or add a new staff member.
                </p>
              </div>
            ) : (
              <>
                {/* PROFILE CARD */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  {/* Identity + contact info */}
                  <div className="p-4 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white shadow-sm">
                        {selectedStaff.name.trim().slice(0, 1).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h2 className="min-w-0 break-words text-xl font-bold text-gray-800">
                            {selectedStaff.name}
                          </h2>
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${selectedStaff.end_date
                              ? "border-gray-200 bg-gray-100 text-gray-600"
                              : "border-green-200 bg-green-50 text-green-700"
                              }`}
                          >
                            {selectedStaff.end_date ? "Former staff" : "Currently employed"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-gray-500">Staff ID #{selectedStaff.staff_id}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2.5 text-sm text-gray-600 sm:grid-cols-2">
                      <p className="flex min-w-0 items-center gap-2">
                        <Briefcase className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="min-w-0 break-words">
                          {selectedStaff.position || "Position not specified"}
                        </span>
                      </p>
                      <p className="flex min-w-0 items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="min-w-0 break-words">
                          {dateLabel(selectedStaff.start_date)} —{" "}
                          {selectedStaff.end_date ? dateLabel(selectedStaff.end_date) : "Present"}
                        </span>
                      </p>
                      {selectedStaff.phone_number ? (
                        <p className="flex min-w-0 items-center gap-2">
                          <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                          <span className="min-w-0 break-words">{selectedStaff.phone_number}</span>
                        </p>
                      ) : null}
                      {selectedStaff.address ? (
                        <p className="flex min-w-0 items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                          <span className="min-w-0 break-words">{selectedStaff.address}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions: equal-width row from sm up, stacked on phones */}
                  <div className="grid grid-cols-1 gap-2 border-t border-gray-200 bg-gray-50/60 px-4 py-3 sm:grid-cols-3 sm:px-6">
                    <button onClick={openEditStaff} className={`${secondaryBtn} w-full`}>
                      <Pencil className="h-4 w-4" />
                      Edit Details
                    </button>
                    <button onClick={openChangeSalary} className={`${secondaryBtn} w-full`}>
                      <TrendingUp className="h-4 w-4" />
                      Change Salary
                    </button>
                    <button
                      onClick={openAddPayment}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-lg"
                    >
                      <Wallet className="h-4 w-4" />
                      Record Payment
                    </button>
                  </div>

                  {/* SALARY SUMMARY */}
                  <div className="border-t border-gray-200 p-4 sm:p-6">
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">Salary summary</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <StatCard
                        icon={Banknote}
                        tone="blue"
                        label="Monthly Salary"
                        value={formatCurrency(summary.monthly_salary)}
                        hint={`As of ${dateLabel(summary.calculated_through)}`}
                      />
                      <StatCard
                        icon={TrendingUp}
                        tone="gray"
                        label="Gross Salary Earned"
                        value={formatCurrency(summary.gross_salary)}
                        hint={`Through ${dateLabel(summary.calculated_through)}`}
                      />
                      <StatCard
                        icon={UserX}
                        tone="amber"
                        label="Absence Deduction"
                        value={formatCurrency(summary.absence_deduction)}
                        hint="Full days 100%, half days 50%"
                      />
                      <StatCard
                        icon={Clock}
                        tone="orange"
                        label="Absent Days"
                        value={Number(summary.absent_days || 0)}
                        hint={`${summary.full_day_absences} full · ${summary.half_day_absences} half`}
                      />
                      <StatCard
                        icon={Check}
                        tone="green"
                        label="Net Salary Earned"
                        value={formatCurrency(summary.earned_salary)}
                        hint="Gross salary less absences"
                      />
                      <StatCard
                        icon={Gift}
                        tone="purple"
                        label="Bonuses"
                        value={formatCurrency(summary.total_bonus)}
                        hint="Additional compensation"
                      />
                      <StatCard
                        icon={Wallet}
                        tone="green"
                        label="Salary Paid"
                        value={formatCurrency(summary.total_paid)}
                        hint="Excludes bonuses"
                      />
                      <StatCard
                        icon={AlertCircle}
                        tone={balanceTone}
                        label={balance < -0.01 ? "Overpaid" : "Salary Balance"}
                        value={formatCurrency(Math.abs(balance))}
                        hint={balance < -0.01 ? "Overpayment on current calculation" : "Earned + bonuses − paid"}
                      />
                    </div>
                  </div>

                  {/* END DATE */}
                  <div className="border-t border-gray-200 bg-gray-50/60 p-4 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1 sm:max-w-xs">
                        <label className={labelClass}>Final working date (inclusive)</label>
                        <DatePicker
                          value={endDate}
                          onChange={setEndDate}
                          min={latestSalaryDate}
                          max={today()}
                          placeholder="Select final working date"
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button onClick={askSaveEndDate} disabled={saving} className={secondaryBtn}>
                          <Check className="h-4 w-4" />
                          Save End Date
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ATTENDANCE / PAYMENTS / SALARY HISTORY */}
                <Card
                  icon={tabMeta.icon}
                  iconClass={tabMeta.iconClass}
                  title={tabMeta.title}
                  description={tabMeta.desc}
                  actions={
                    <div className="flex rounded-lg bg-gray-100 p-1 md:min-w-[380px]">
                      {tabBtn("attendance", "Attendance", CalendarDays)}
                      {tabBtn("payments", "Payments", History, "text-green-600")}
                      {tabBtn("salary", "Salary", TrendingUp, "text-purple-600")}
                    </div>
                  }
                >
                  {/* ---------- ATTENDANCE ---------- */}
                  {activeTab === "attendance" && (
                    <div
                      key="attendance"
                      className="page-fade grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_260px]"
                    >
                      <AttendanceCalendar
                        staff={selectedStaff}
                        absences={details.absences || []}
                        payments={details.payments || []}
                        monthCursor={monthCursor}
                        onPrevMonth={prevMonth}
                        onNextMonth={nextMonth}
                        onPickDay={handlePickCalendarDay}
                      />

                      <div className="flex min-h-0 flex-col rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
                          <h3 className="text-sm font-semibold text-gray-700">
                            Absences ({sortedAbsences.length})
                          </h3>
                          <button
                            onClick={() => openAddAbsence()}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add
                          </button>
                        </div>

                        <div className="thin-scroll max-h-56 overflow-y-auto md:max-h-[380px]">
                          {sortedAbsences.length === 0 ? (
                            <p className="p-6 text-center text-sm text-gray-400">No absences recorded.</p>
                          ) : (
                            <ul className="divide-y divide-gray-100">
                              {sortedAbsences.map((a) => (
                                <li key={a.absence_id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                                  <div className="min-w-0">
                                    <span className="block truncate text-sm text-gray-700">
                                      {dateLabel(a.absent_date)}
                                    </span>
                                    <span
                                      className={`mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${absenceBadgeClass(
                                        a.absence_type
                                      )}`}
                                    >
                                      {absenceLabel(a.absence_type)}
                                    </span>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      onClick={() => startEditAbsence(a)}
                                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600"
                                      aria-label="Edit absence"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => askDeleteAbsence(a)}
                                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                                      aria-label="Delete absence"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---------- PAYMENTS ---------- */}
                  {activeTab === "payments" && (
                    <div key="payments" className="page-fade p-4 sm:p-6">
                      {details.payments?.length ? (
                        <div className="thin-scroll overflow-x-auto rounded-xl border border-gray-200">
                          <table className="w-full min-w-[380px]">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">#</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Salary</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Bonus</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {details.payments.map((payment, index) => (
                                <tr key={payment.payment_id} className="transition-colors hover:bg-gray-50">
                                  <td className="hidden px-4 py-3 text-sm font-medium text-gray-500 sm:table-cell">{index + 1}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                                    {dateLabel(payment.pay_date)}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-green-600">
                                    {formatCurrency(payment.paid_amount)}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                                    {Number(payment.bonus) > 0 ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                        <Gift className="h-3 w-3" />
                                        {formatCurrency(payment.bonus)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1">
                                      <button
                                        onClick={() => startEditPayment(payment)}
                                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600"
                                        aria-label="Edit payment"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => askDeletePayment(payment)}
                                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                                        aria-label="Delete payment"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-gray-200 bg-green-50/50">
                                <td className="hidden sm:table-cell" />
                                <td className="px-4 py-3 text-right font-bold text-gray-800 sm:text-left">Total</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-green-600">
                                  {formatCurrency(summary.total_paid)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-amber-600">
                                  {formatCurrency(summary.total_bonus)}
                                </td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 text-center">
                          <History className="mb-4 h-14 w-14 text-gray-300" />
                          <p className="font-medium text-gray-600">No payments recorded yet</p>
                          <p className="mt-1 text-sm text-gray-400">Record a payment to start tracking.</p>
                          <button
                            onClick={openAddPayment}
                            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition hover:from-green-700 hover:to-emerald-700"
                          >
                            <Wallet className="h-4 w-4" />
                            Record Payment
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---------- SALARY HISTORY ---------- */}
                  {activeTab === "salary" && (
                    <div key="salary" className="page-fade p-4 sm:p-6">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-gray-500">
                          Daily rate = monthly salary ÷ days in that month. Earlier periods keep the salary they had.
                        </p>
                        <button onClick={openChangeSalary} className={`${secondaryBtn} shrink-0`}>
                          <TrendingUp className="h-4 w-4" />
                          Change Salary
                        </button>
                      </div>

                      {salaryHistory.length ? (
                        <div className="thin-scroll overflow-x-auto rounded-xl border border-gray-200">
                          <table className="w-full min-w-[460px]">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Monthly Salary</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">From</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">To</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                  Status
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {salaryHistory.map((h) => {
                                const status = SALARY_STATUS_STYLES[salaryStatus(h)];
                                return (
                                  <tr key={h.salary_id} className="transition-colors hover:bg-gray-50">
                                    <td className="whitespace-nowrap px-4 py-3 text-sm font-bold tabular-nums text-gray-800">
                                      {formatCurrency(h.monthly_salary)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                                      {dateLabel(h.effective_from)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                                      {h.effective_to
                                        ? dateLabel(addDaysISO(h.effective_to, -1))
                                        : selectedStaff.end_date
                                          ? dateLabel(selectedStaff.end_date)
                                          : "Present"}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <span
                                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}
                                      >
                                        {status.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <button
                                        onClick={() => openEditSalary(h)}
                                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600"
                                        aria-label="Edit salary record"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 text-center">
                          <TrendingUp className="mb-3 h-12 w-12 text-gray-300" />
                          <p className="font-medium text-gray-600">No salary records</p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* DOCUMENT (read-only preview; upload/change is available in Add/Edit Staff) */}
                <Card
                  icon={FileText}
                  iconClass="text-purple-600"
                  title="Identity Document"
                  description="View the identity document saved for this staff member."
                >
                  <div className="p-4 sm:p-6">
                    <DocumentPreview
                      value={selectedStaff.document_picture}
                      onView={() => setViewerOpen(true)}
                    />
                  </div>
                </Card>
              </>
            )}
          </section>
        </div>
      </div>

      {/* STAFF MODAL */}
      {(modal?.type === "addStaff" || modal?.type === "editStaff") && (
        <Modal
          title={modal.type === "editStaff" ? "Edit Staff Details" : "Add Staff Member"}
          subtitle={modal.type === "editStaff" ? "Update employment information" : "Create a new staff record"}
          icon={modal.type === "editStaff" ? Pencil : UserPlus}
          onClose={() => setModal(null)}
          busy={saving}
          size="lg"
        >
          <form onSubmit={submitStaff} noValidate className="space-y-4 p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  placeholder="Enter staff name"
                  disabled={saving}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  type="tel"
                  value={staffForm.phoneNumber}
                  onChange={(e) => setStaffForm({ ...staffForm, phoneNumber: e.target.value })}
                  placeholder="Enter phone number"
                  disabled={saving}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Position <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={staffForm.position}
                  onChange={(e) => setStaffForm({ ...staffForm, position: e.target.value })}
                  placeholder="e.g. Receptionist"
                  disabled={saving}
                />
              </div>
              <div>
                <label className={labelClass}>Address (optional)</label>
                <input
                  className={inputClass}
                  value={staffForm.address}
                  onChange={(e) => setStaffForm({ ...staffForm, address: e.target.value })}
                  placeholder="Enter address"
                  disabled={saving}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {modal.type === "editStaff" ? "Current Monthly Salary (NPR)" : "Monthly Salary (NPR)"}{" "}
                  {modal.type === "editStaff" ? null : <span className="text-red-500">*</span>}
                </label>
                <input
                  className={inputClass}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={staffForm.salary}
                  onChange={(e) => setStaffForm({ ...staffForm, salary: e.target.value })}
                  placeholder="e.g. 25000"
                  disabled={saving || modal.type === "editStaff"}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Employment Start Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={staffForm.startDate}
                  onChange={(v) => setStaffForm({ ...staffForm, startDate: v })}
                  max={today()}
                  disabled={saving || modal.type === "editStaff"}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Document Picture (optional)</label>
              <DocumentUpload
                value={staffForm.documentPicture}
                onChange={(v) => setStaffForm({ ...staffForm, documentPicture: v })}
                onError={showError}
                disabled={saving}
              />
            </div>

            {modal.type === "editStaff" && (
              <FormNote tone="amber">
                Salary and start date can't be edited here. Use <strong>Change Salary</strong> to record a raise or
                cut — earlier periods keep the salary they had.
              </FormNote>
            )}

            <FormError message={formError} />

            <div className={footerClass}>
              <button type="button" onClick={() => setModal(null)} disabled={saving} className={cancelBtnClass}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${submitBtnBase} bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700`}
              >
                {saving ? (
                  <SavingContent />
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Save Staff</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ABSENCE MODAL (full day / half day) */}
      {modal?.type === "absence" && selectedStaff && (
        <Modal
          title={editingAbsence ? "Edit Absence" : "Record Absence"}
          subtitle={`For ${selectedStaff.name}`}
          icon={UserX}
          gradient="from-red-600 to-orange-600"
          subColor="text-red-100"
          onClose={closeAbsenceModal}
          busy={saving}
        >
          <form onSubmit={submitAbsence} noValidate className="space-y-4 p-5 sm:p-6">
            <div>
              <label className={labelClass}>
                Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={absenceForm.date}
                onChange={(v) => setAbsenceForm({ ...absenceForm, date: v })}
                min={selectedStaff.start_date}
                max={selectedStaff.end_date || undefined}
                disabled={saving}
              />
            </div>

            <div>
              <label className={labelClass}>Absence type</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                {ABSENCE_TYPES.map((t) => {
                  const selected = absenceForm.type === t.id;
                  const TypeIcon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={saving}
                      onClick={() => setAbsenceForm({ ...absenceForm, type: t.id })}
                      className={`rounded-xl border p-3 text-left transition disabled:opacity-50 ${selected ? t.active : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <TypeIcon className={`h-4 w-4 ${selected ? t.iconActive : "text-gray-400"}`} />
                        <span className="text-sm font-semibold text-gray-800">{t.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{t.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentOnAbsenceDate ? (
              <FormNote>
                A payment is recorded on this date.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setEditingAbsence(null);
                    startEditPayment(paymentOnAbsenceDate);
                  }}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Edit that payment instead
                </button>
              </FormNote>
            ) : null}

            <FormNote>Salary is recalculated automatically using the daily rate for that date's month.</FormNote>

            <FormError message={formError} />

            <div className={footerClass}>
              {editingAbsence ? (
                <button
                  type="button"
                  onClick={() => askDeleteAbsence(editingAbsence)}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 sm:mr-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              ) : null}
              <button type="button" onClick={closeAbsenceModal} disabled={saving} className={cancelBtnClass}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${submitBtnBase} bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700`}
              >
                {saving ? (
                  <SavingContent />
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{editingAbsence ? "Save Changes" : "Mark Absent"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CHANGE SALARY MODAL */}
      {modal?.type === "salary" && selectedStaff && (
        <Modal
          title="Change Monthly Salary"
          subtitle={`For ${selectedStaff.name}`}
          icon={TrendingUp}
          gradient="from-purple-600 to-indigo-600"
          subColor="text-purple-100"
          onClose={() => setModal(null)}
          busy={saving}
        >
          <form onSubmit={submitSalary} noValidate className="space-y-4 p-5 sm:p-6">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <span className="text-gray-500">Latest record: </span>
              <span className="font-semibold text-gray-800">
                {formatCurrency(salaryHistory[0]?.monthly_salary ?? selectedStaff.salary)}
              </span>
              <span className="text-gray-500"> from {dateLabel(latestSalaryDate)}</span>
            </div>

            <div>
              <label className={labelClass}>
                New Monthly Salary (NPR) <span className="text-red-500">*</span>
              </label>
              <input
                className={`${inputClass} text-lg font-semibold`}
                type="number"
                min="0.01"
                step="0.01"
                value={salaryForm.monthlySalary}
                onChange={(e) => setSalaryForm({ ...salaryForm, monthlySalary: e.target.value })}
                placeholder="e.g. 30000"
                disabled={saving}
                autoFocus
              />
            </div>

            <div>
              <label className={labelClass}>
                Effective From <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={salaryForm.effectiveFrom}
                onChange={(v) => setSalaryForm({ ...salaryForm, effectiveFrom: v })}
                min={salaryMinDate}
                max={salaryMaxDate}
                disabled={saving}
              />
            </div>

            <FormNote>
              The new salary applies from this date onward. Days before it keep the previous salary. The date must be
              after {dateLabel(latestSalaryDate)}.
            </FormNote>

            <FormError message={formError} />

            <div className={footerClass}>
              <button type="button" onClick={() => setModal(null)} disabled={saving} className={cancelBtnClass}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${submitBtnBase} bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700`}
              >
                {saving ? (
                  <SavingContent />
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Save Salary</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT EXISTING SALARY HISTORY MODAL
          Rendered here (not inside the <table>) so the DOM nesting stays valid. */}
      {modal?.type === "editSalary" && editingSalary && selectedStaff && (
        <Modal
          title="Edit Salary Record"
          subtitle={`For ${selectedStaff.name}`}
          icon={Pencil}
          gradient="from-blue-600 to-indigo-600"
          onClose={closeEditSalary}
          busy={saving}
        >
          <form onSubmit={submitEditSalary} noValidate className="space-y-4 p-5 sm:p-6">
            <div>
              <label className={labelClass}>
                Monthly Salary (NPR) <span className="text-red-500">*</span>
              </label>
              <input
                className={`${inputClass} text-lg font-semibold`}
                type="number"
                min="0.01"
                step="0.01"
                value={editSalaryForm.monthlySalary}
                onChange={(e) =>
                  setEditSalaryForm({ ...editSalaryForm, monthlySalary: e.target.value })
                }
                disabled={saving}
                autoFocus
              />
            </div>

            <div>
              <label className={labelClass}>
                Effective From <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={editSalaryForm.effectiveFrom}
                onChange={(v) => setEditSalaryForm({ ...editSalaryForm, effectiveFrom: v })}
                min={selectedStaff.start_date}
                max={selectedStaff.end_date || today()}
                disabled={saving}
              />
            </div>

            <FormNote tone="amber">
              Editing this record will rebuild the salary periods. Other salary records keep their own
              amounts, but their effective dates may change. Total salary earned and the outstanding
              balance will be recalculated.
            </FormNote>

            <FormError message={formError} />

            <div className={footerClass}>
              <button type="button" onClick={closeEditSalary} disabled={saving} className={cancelBtnClass}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${submitBtnBase} bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700`}
              >
                {saving ? (
                  <SavingContent />
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* PAYMENT MODAL */}
      {modal?.type === "payment" && (
        <Modal
          title={editingPayment ? "Correct Salary Payment" : "Record Salary Payment"}
          subtitle={selectedStaff ? `For ${selectedStaff.name}` : ""}
          icon={Wallet}
          gradient="from-green-600 to-emerald-600"
          subColor="text-green-100"
          onClose={closePaymentModal}
          busy={saving}
        >
          <form onSubmit={submitPayment} noValidate className="space-y-4 p-5 sm:p-6">
            <div>
              <label className={labelClass}>Salary Amount Paid (NPR)</label>
              <input
                className={`${inputClass} text-lg font-semibold`}
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.paidAmount}
                onChange={(e) => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
                placeholder="0.00"
                disabled={saving}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Bonus (NPR)</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.bonus}
                onChange={(e) => setPaymentForm({ ...paymentForm, bonus: e.target.value })}
                placeholder="0.00"
                disabled={saving}
              />
            </div>
            <div>
              <label className={labelClass}>
                Payment Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={paymentForm.payDate}
                onChange={(v) => setPaymentForm({ ...paymentForm, payDate: v })}
                min={selectedStaff?.start_date}
                max={maxStaffDate}
                disabled={saving}
              />
            </div>

            <FormNote>
              Enter a salary amount, a bonus, or both. Bonuses are tracked separately from salary paid and are
              counted as additional compensation in the balance.
            </FormNote>

            <FormError message={formError} />

            <div className={footerClass}>
              <button type="button" onClick={closePaymentModal} disabled={saving} className={cancelBtnClass}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${submitBtnBase} bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700`}
              >
                {saving ? (
                  <SavingContent />
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Save Payment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* IMAGE VIEWER */}
      {viewerOpen && selectedStaff?.document_picture && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setViewerOpen(false)}
        >
          <button
            onClick={() => setViewerOpen(false)}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Close preview"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={selectedStaff.document_picture}
            alt="Staff document"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full rounded-lg bg-white object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}