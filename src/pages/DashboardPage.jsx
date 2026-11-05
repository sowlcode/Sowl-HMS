// DashboardPage.jsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Banknote,
  CreditCard,
  Receipt,
  CalendarDays,
  Users,
  UserRound,
  BedDouble,
  CircleDollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  BriefcaseBusiness,
  UserCheck,
  Activity,
  AlertCircle,
  ChartNoAxesCombined,
} from "lucide-react";

// ============================================================
// CONSTANTS
// ============================================================

const PERIODS = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "3 Months", value: "3months" },
  { label: "6 Months", value: "6months" },
  { label: "Yearly", value: "yearly" },
];

const COLORS = ["#3B82F6", "#6366F1", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"];

const ROOM_COLORS = {
  Occupied: "#6366F1",
  Available: "#10B981",
  Reserved: "#F59E0B",
  Booked: "#0EA5E9",
  Maintenance: "#EF4444",
};

const emptyDashboard = {
  overview: {
    total_revenue: 0,
    total_collected: 0,
    outstanding_balance: 0,
    total_bookings: 0,
    active_bookings: 0,
    completed_bookings: 0,
    cancelled_bookings: 0,
    total_customers: 0,
    new_customers: 0,
    total_rooms: 0,
    occupied_rooms: 0,
    available_rooms: 0,
    occupancy_rate: 0,
  },
  revenue_chart: [],
  collection_chart: [],
  booking_chart: [],
  revenue_breakdown: [],
  payment_breakdown: [],
  room_statistics: {
    total_rooms: 0,
    available: 0,
    reserved: 0,
    booked: 0,
    maintenance: 0,
    occupied: 0,
    occupancy_rate: 0,
  },
  customer_statistics: {
    total_customers: 0,
    new_customers: 0,
    returning_customers: 0,
    total_registrations: 0,
    average_registrations_per_customer: 0,
  },
  staff_statistics: {
    total_staff: 0,
    monthly_salary_obligation: 0,
    salary_paid: 0,
    bonus_paid: 0,
    total_salary_expenditure: 0,
    total_absences: 0,
  },
};

const TONES = {
  blue: { box: "bg-blue-50", icon: "text-blue-600" },
  green: { box: "bg-green-50", icon: "text-green-600" },
  amber: { box: "bg-amber-50", icon: "text-amber-600" },
  purple: { box: "bg-purple-50", icon: "text-purple-600" },
  red: { box: "bg-red-50", icon: "text-red-600" },
  gray: { box: "bg-gray-100", icon: "text-gray-600" },
};

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

const compactMoney = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 10000000) return `Rs. ${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `Rs. ${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `Rs. ${(amount / 1000).toFixed(1)}K`;
  return `Rs. ${amount.toFixed(0)}`;
};

const number = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);

const percentage = (value) => `${(Number(value) || 0).toFixed(1)}%`;

const formatChartDate = (value, period) => {
  if (!value) return "";

  if (period === "weekly" || period === "monthly") {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  }

  const [year, month] = String(value).split("-");
  if (year && month) {
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  }

  return value;
};

const formatLabel = (value) =>
  String(value || "Other")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50";

const axisTick = { fill: "#9CA3AF", fontSize: 10 };

// ============================================================
// REUSABLE COMPONENTS
// ============================================================

function SectionTitle({ children }) {
  return <h2 className="mb-3 text-sm font-semibold text-gray-700">{children}</h2>;
}

function StatCard({ icon: Icon, label, value, hint, tone = "blue", loading }) {
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
            {loading ? (
              <span className="inline-block h-5 w-24 animate-pulse rounded bg-gray-100" />
            ) : (
              value
            )}
          </div>
          {hint ? <div className="mt-0.5 text-[11px] leading-snug text-gray-400">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

// Section card with a consistent header
function Card({ icon: Icon, iconClass = "text-blue-600", title, description, actions, children, className = "" }) {
  return (
    <div className={`min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
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
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function EmptyChart({ message = "No data available for this period" }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 text-center">
      <ChartNoAxesCombined className="mb-3 h-12 w-12 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">{message}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label, isMoney = false }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-gray-700">{label}</p>
      {payload.map((item, index) => (
        <div key={index} className="flex items-center gap-2 py-0.5 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-gray-500">{item.name}:</span>
          <strong className="text-gray-800">
            {isMoney ? money(item.value) : number(item.value)}
          </strong>
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, value, icon: Icon, tone = "blue" }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <div className={`rounded-lg p-1.5 ${t.box}`}>
            <Icon className={`h-3.5 w-3.5 ${t.icon}`} />
          </div>
        )}
        <span className="truncate text-sm text-gray-500">{label}</span>
      </div>
      <strong className="shrink-0 text-sm font-semibold text-gray-800">{value}</strong>
    </div>
  );
}

const BADGE_STYLES = {
  green: { cls: "border-green-200 bg-green-50 text-green-700", dot: "bg-green-500" },
  blue: { cls: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  amber: { cls: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  red: { cls: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
};

function StatusBadge({ label, value, color }) {
  const s = BADGE_STYLES[color] || BADGE_STYLES.blue;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white p-3">
      <span className="flex min-w-0 items-center gap-2 text-sm text-gray-500">
        <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
        <span className="truncate">{label}</span>
      </span>
      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
        {number(value)}
      </span>
    </div>
  );
}

function PieBreakdown({ data, nameKey, colorFor, formatValue, formatName }) {
  return (
    <>
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey={nameKey}
              cx="50%"
              cy="48%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
            >
              {data.map((item, index) => (
                <Cell key={`${item[nameKey]}-${index}`} fill={colorFor(item, index)} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatValue(value)} />
            <Legend
              verticalAlign="bottom"
              height={30}
              formatter={(value) => (
                <span className="text-xs text-gray-500">{formatName(value)}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
        {data.map((item, index) => (
          <div
            key={`${item[nameKey]}-${index}`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2 text-gray-500">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorFor(item, index) }}
              />
              {formatName(item[nameKey])}
            </span>
            <strong className="text-gray-700">{formatValue(item.value)}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

// ============================================================
// MAIN DASHBOARD PAGE
// ============================================================

export default function DashboardPage() {
  const [period, setPeriod] = useState("weekly");
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ----------------------------------------------------------
  // FETCH DASHBOARD
  // ----------------------------------------------------------

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await invoke("get_dashboard_data", { period });

      setDashboard({
        ...emptyDashboard,
        ...result,
        overview: { ...emptyDashboard.overview, ...(result?.overview || {}) },
        room_statistics: {
          ...emptyDashboard.room_statistics,
          ...(result?.room_statistics || {}),
        },
        customer_statistics: {
          ...emptyDashboard.customer_statistics,
          ...(result?.customer_statistics || {}),
        },
        staff_statistics: {
          ...emptyDashboard.staff_statistics,
          ...(result?.staff_statistics || {}),
        },
      });
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ----------------------------------------------------------
  // DATA
  // ----------------------------------------------------------

  const overview = dashboard.overview;
  const rooms = dashboard.room_statistics;
  const customers = dashboard.customer_statistics;
  const staff = dashboard.staff_statistics;

  const withLabels = (rows) =>
    (rows || []).map((item) => ({ ...item, label: formatChartDate(item.label, period) }));

  const revenueData = useMemo(
    () => withLabels(dashboard.revenue_chart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboard.revenue_chart, period]
  );
  const collectionData = useMemo(
    () => withLabels(dashboard.collection_chart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboard.collection_chart, period]
  );
  const bookingData = useMemo(
    () => withLabels(dashboard.booking_chart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboard.booking_chart, period]
  );

  const roomData = useMemo(
    () =>
      [
        { name: "Occupied", value: Number(rooms.occupied || 0) },
        { name: "Available", value: Number(rooms.available || 0) },
        { name: "Reserved", value: Number(rooms.reserved || 0) },
        { name: "Booked", value: Number(rooms.booked || 0) },
        { name: "Maintenance", value: Number(rooms.maintenance || 0) },
      ].filter((item) => item.value > 0),
    [rooms]
  );

  const bookingStatusData = useMemo(
    () =>
      [
        { name: "Active", value: Number(overview.active_bookings || 0) },
        { name: "Completed", value: Number(overview.completed_bookings || 0) },
        { name: "Cancelled", value: Number(overview.cancelled_bookings || 0) },
      ].filter((item) => item.value > 0),
    [overview]
  );

  const occupancy = Math.min(100, Math.max(0, Number(rooms.occupancy_rate || 0)));

  const selectedPeriodLabel = PERIODS.find((item) => item.value === period)?.label || "Weekly";

  const periodTabs = (
    <div className="flex flex-wrap rounded-lg bg-gray-100 p-1">
      {PERIODS.map((item) => (
        <button
          key={item.value}
          onClick={() => setPeriod(item.value)}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-all md:px-4 ${
            period === item.value
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

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
      `}</style>

      <div className="relative mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        {/* HEADER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
              <LayoutDashboard className="h-6 w-6 text-blue-600" />
              Dashboard Overview
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Monitor your hotel's performance and daily operations
            </p>
          </div>
          {periodTabs}
        </div>

        {/* ERROR */}
        {error && (
          <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-700">Unable to load dashboard data</p>
                <p className="mt-1 break-words text-xs text-red-600">{error}</p>
              </div>
            </div>
            <button onClick={fetchDashboard} className={`${secondaryBtn} shrink-0`}>
              Try Again
            </button>
          </div>
        )}

        {/* FINANCIAL SUMMARY */}
        <section>
          <SectionTitle>Financial summary — {selectedPeriodLabel.toLowerCase()}</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              tone="purple"
              label="Total Revenue"
              value={money(overview.total_revenue)}
              hint="Bills generated in selected period"
              loading={loading}
            />
            <StatCard
              icon={Banknote}
              tone="green"
              label="Total Collected"
              value={money(overview.total_collected)}
              hint="Payments received in selected period"
              loading={loading}
            />
            <StatCard
              icon={Clock}
              tone="amber"
              label="Outstanding Balance"
              value={money(overview.outstanding_balance)}
              hint="Unpaid registration balances"
              loading={loading}
            />
            <StatCard
              icon={BriefcaseBusiness}
              tone="blue"
              label="Monthly Salary Obligation"
              value={money(staff.monthly_salary_obligation)}
              hint="Current monthly salary obligation"
              loading={loading}
            />
          </div>
        </section>

        {/* BOOKING SUMMARY */}
        <section>
          <SectionTitle>Booking summary</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Receipt}
              tone="blue"
              label="Total Bookings"
              value={number(overview.total_bookings)}
              hint="Registrations created"
              loading={loading}
            />
            <StatCard
              icon={Activity}
              tone="green"
              label="Active Bookings"
              value={number(overview.active_bookings)}
              hint="Currently active registrations"
              loading={loading}
            />
            <StatCard
              icon={CheckCircle2}
              tone="purple"
              label="Completed Bookings"
              value={number(overview.completed_bookings)}
              hint="Completed registrations"
              loading={loading}
            />
            <StatCard
              icon={XCircle}
              tone="red"
              label="Cancelled Bookings"
              value={number(overview.cancelled_bookings)}
              hint="Cancelled registrations"
              loading={loading}
            />
          </div>
        </section>

        {/* REVENUE + COLLECTION */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card
            icon={TrendingUp}
            iconClass="text-indigo-600"
            title="Revenue Trend"
            description="Total bill value generated over time"
          >
            {revenueData.length > 0 ? (
              <div className="page-fade h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashboardRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#F1F3F7" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={15} />
                    <YAxis
                      tickFormatter={compactMoney}
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      width={75}
                    />
                    <Tooltip content={<ChartTooltip isMoney />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="Revenue"
                      stroke="#6366F1"
                      strokeWidth={2.5}
                      fill="url(#dashboardRevenueGradient)"
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart />
            )}
          </Card>

          <Card
            icon={Banknote}
            iconClass="text-green-600"
            title="Payment Collection"
            description="Payments received over time"
          >
            {collectionData.length > 0 ? (
              <div className="page-fade h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={collectionData} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
                    <CartesianGrid stroke="#F1F3F7" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={15} />
                    <YAxis
                      tickFormatter={compactMoney}
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      width={75}
                    />
                    <Tooltip content={<ChartTooltip isMoney />} />
                    <Bar
                      dataKey="value"
                      name="Collected"
                      fill="#10B981"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={35}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart />
            )}
          </Card>
        </div>

        {/* BOOKING TREND */}
        <Card
          icon={CalendarDays}
          iconClass="text-sky-600"
          title="Booking Trend"
          description="Number of registrations created over time"
        >
          {bookingData.length > 0 ? (
            <div className="page-fade h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bookingData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardBookingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#F1F3F7" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={15} />
                  <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Bookings"
                    stroke="#0EA5E9"
                    strokeWidth={2.5}
                    fill="url(#dashboardBookingGradient)"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </Card>

        {/* BREAKDOWNS */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Card
            icon={Receipt}
            iconClass="text-blue-600"
            title="Revenue Breakdown"
            description="Revenue by bill item category"
          >
            {dashboard.revenue_breakdown?.length > 0 ? (
              <PieBreakdown
                data={dashboard.revenue_breakdown}
                nameKey="label"
                colorFor={(_, i) => COLORS[i % COLORS.length]}
                formatValue={money}
                formatName={formatLabel}
              />
            ) : (
              <EmptyChart />
            )}
          </Card>

          <Card
            icon={CreditCard}
            iconClass="text-indigo-600"
            title="Payment Methods"
            description="Cash and online payment distribution"
          >
            {dashboard.payment_breakdown?.length > 0 ? (
              <PieBreakdown
                data={dashboard.payment_breakdown}
                nameKey="label"
                colorFor={(_, i) => COLORS[i % COLORS.length]}
                formatValue={money}
                formatName={formatLabel}
              />
            ) : (
              <EmptyChart />
            )}
          </Card>

          <Card
            icon={BedDouble}
            iconClass="text-purple-600"
            title="Room Distribution"
            description="Current room status"
          >
            {roomData.length > 0 ? (
              <PieBreakdown
                data={roomData}
                nameKey="name"
                colorFor={(item) => ROOM_COLORS[item.name]}
                formatValue={number}
                formatName={(v) => v}
              />
            ) : (
              <EmptyChart message="No room information available" />
            )}
          </Card>
        </div>

        {/* BOOKING STATUS */}
        <Card
          icon={Activity}
          iconClass="text-green-600"
          title="Booking Status Distribution"
          description="Current booking status for the selected period"
        >
          {bookingStatusData.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-center">
              <div className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bookingStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {bookingStatusData.map((item) => (
                        <Cell
                          key={item.name}
                          fill={
                            item.name === "Active"
                              ? "#10B981"
                              : item.name === "Completed"
                                ? "#3B82F6"
                                : "#F43F5E"
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => number(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                <StatusBadge label="Active Bookings" value={overview.active_bookings} color="green" />
                <StatusBadge label="Completed Bookings" value={overview.completed_bookings} color="blue" />
                <StatusBadge label="Cancelled Bookings" value={overview.cancelled_bookings} color="red" />
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Total Registrations</p>
                  <p className="mt-1 text-xl font-bold text-gray-800">
                    {number(overview.total_bookings)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyChart />
          )}
        </Card>

        {/* OPERATIONAL OVERVIEW */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* ROOMS */}
          <Card
            icon={BedDouble}
            iconClass="text-blue-600"
            title="Room Overview"
            description="Current room availability"
          >
            <div className="mb-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-100">Occupancy Rate</p>
                  <h3 className="mt-1 text-3xl font-bold">{percentage(rooms.occupancy_rate)}</h3>
                </div>
                <div className="rounded-xl bg-white/15 p-3">
                  <BedDouble className="h-7 w-7" />
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${occupancy}%` }}
                />
              </div>

              <div className="mt-2 flex justify-between text-[11px] text-blue-100">
                <span>{number(rooms.occupied)} occupied</span>
                <span>{number(rooms.total_rooms)} total rooms</span>
              </div>
            </div>

            <div className="space-y-2">
              <StatusBadge label="Occupied" value={rooms.occupied} color="blue" />
              <StatusBadge label="Available" value={rooms.available} color="green" />
              <StatusBadge label="Reserved" value={rooms.reserved} color="amber" />
              <StatusBadge label="Booked" value={rooms.booked} color="blue" />
              <StatusBadge label="Maintenance" value={rooms.maintenance} color="red" />
            </div>
          </Card>

          {/* CUSTOMERS */}
          <Card
            icon={Users}
            iconClass="text-green-600"
            title="Customer Overview"
            description="Customer activity and retention"
          >
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <div className="flex items-center gap-2 text-blue-600">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-medium">Total Customers</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-800">
                  {number(customers.total_customers)}
                </p>
              </div>

              <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                <div className="flex items-center gap-2 text-green-600">
                  <UserCheck className="h-4 w-4" />
                  <span className="text-xs font-medium">Returning</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-800">
                  {number(customers.returning_customers)}
                </p>
              </div>
            </div>

            <DetailRow label="New Customers" value={number(customers.new_customers)} icon={UserRound} tone="blue" />
            <DetailRow
              label="Returning Customers"
              value={number(customers.returning_customers)}
              icon={UserCheck}
              tone="green"
            />
            <DetailRow
              label="Registrations in Period"
              value={number(customers.total_registrations)}
              icon={Receipt}
              tone="purple"
            />
            <DetailRow
              label="Avg. Registrations / Customer"
              value={Number(customers.average_registrations_per_customer || 0).toFixed(2)}
              icon={TrendingUp}
              tone="amber"
            />
          </Card>

          {/* STAFF */}
          <Card
            icon={BriefcaseBusiness}
            iconClass="text-purple-600"
            title="Staff & Payroll"
            description="Staff and salary information"
          >
            <div className="mb-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-100">Total Staff</p>
                  <h3 className="mt-1 text-3xl font-bold">{number(staff.total_staff)}</h3>
                </div>
                <div className="rounded-xl bg-white/15 p-3">
                  <Users className="h-7 w-7" />
                </div>
              </div>
            </div>

            <DetailRow
              label="Monthly Salary Obligation"
              value={money(staff.monthly_salary_obligation)}
              icon={Wallet}
              tone="blue"
            />
            <DetailRow label="Salary Paid" value={money(staff.salary_paid)} icon={Banknote} tone="green" />
            <DetailRow label="Bonus Paid" value={money(staff.bonus_paid)} icon={TrendingUp} tone="purple" />
            <DetailRow
              label="Total Salary Expenditure"
              value={money(staff.total_salary_expenditure)}
              icon={CircleDollarSign}
              tone="amber"
            />
            <DetailRow
              label="Total Absences"
              value={number(staff.total_absences)}
              icon={CalendarDays}
              tone="red"
            />
          </Card>
        </div>
      </div>
    </>
  );
}