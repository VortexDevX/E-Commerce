import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/layout/PermissionGate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/shadcn/card";
import { Button } from "../../components/shadcn/button";
import { Tabs, TabsList, TabsTrigger } from "../../components/shadcn/tabs";
import OverviewCards, {
  OverviewStats,
} from "../../components/charts/OverviewCards";
import api from "../../utils/api";
import { downloadCSV, csvDate } from "../../utils/csv";
import { currency } from "../../utils/format";
import { fillSalesSeries, fillSalesSeriesRange } from "../../utils/analytics";
import { useAuth } from "../../hooks/useAuth";
import { hasPerm } from "../../utils/permissions";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Types
type SalesPoint = { date: string; orders: number; revenue: number };
type TopProduct = {
  product: string;
  sold: number;
  revenue: number;
  ownerName?: string;
  ownerEmail?: string;
};
type AdminOrder = {
  _id: string;
  user?: { _id: string; email?: string; name?: string };
  items: {
    qty: number;
    price: number;
    product?: { title?: string; category?: string };
  }[];
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  payment?: { method?: string };
  createdAt: string;
};
type FunnelDay = {
  date: string;
  view: number;
  cart: number;
  checkout: number;
  purchase: number;
};

// Utils
function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
function lastNDaysRange(n: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (n - 1));
  return { from: fmtDate(from), to: fmtDate(to) };
}
const isCanceled = (e: any) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  e?.message === "canceled";

// Deterministic unlimited color generator for categories
const categoryColor = (name: string) => {
  const s = String(name || "Other");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 70% 55%)`;
};

function AdminAnalyticsPage() {
  const { user } = useAuth();
  const canAnalytics = hasPerm(user as any, "analytics:read");

  // Range controls
  const [tab, setTab] = useState("30d");
  const [days, setDays] = useState(30);
  const [{ from, to }, setRange] = useState(lastNDaysRange(30));
  useEffect(() => {
    if (tab === "7d") setDays(7);
    else if (tab === "14d") setDays(14);
    else if (tab === "30d") setDays(30);
    else if (tab === "90d") setDays(90);
  }, [tab]);

  const params = useMemo(
    () => (tab === "custom" && from && to ? { from, to } : { days }),
    [tab, from, to, days]
  );
  const debounced = useDebounced(params, 350);

  // Data
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [salesRaw, setSalesRaw] = useState<SalesPoint[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [funnelDaily, setFunnelDaily] = useState<FunnelDay[]>([]);
  const [funnelTotals, setFunnelTotals] = useState<{
    view: number;
    cart: number;
    checkout: number;
    purchase: number;
  }>({
    view: 0,
    cart: 0,
    checkout: 0,
    purchase: 0,
  });

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const cRef = useRef<AbortController | null>(null);

  // Category dictionary (id/slug -> name)
  const [catDict, setCatDict] = useState<Record<string, string>>({});

  // Fetch categories once for display names
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/categories");
        if (!mounted) return;
        const map: Record<string, string> = {};
        (data || []).forEach((c: any) => {
          if (c?._id) map[String(c._id)] = c?.name || "";
          if (c?.slug) map[String(c.slug)] = c?.name || "";
        });
        setCatDict(map);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchAll = async (p: any) => {
    cRef.current?.abort();
    const c = new AbortController();
    cRef.current = c;
    setFetching(true);
    try {
      const [
        { data: s },
        { data: sal },
        { data: tp },
        { data: ord },
        { data: funnel },
      ] = await Promise.all([
        api.get("/admin/analytics/overview", {
          params: p,
          signal: c.signal,
          skipRedirectOn403: true as any,
        }),
        api.get("/admin/analytics/sales", {
          params: p,
          signal: c.signal,
          skipRedirectOn403: true as any,
        }),
        api.get("/admin/analytics/top-products", {
          params: p,
          signal: c.signal,
          skipRedirectOn403: true as any,
        }),
        api.get("/admin/orders", {
          params: p,
          signal: c.signal,
          skipRedirectOn403: true as any,
        }),
        api.get("/admin/analytics/funnel", {
          params: p,
          signal: c.signal,
          skipRedirectOn403: true as any,
        }),
      ]);
      setStats(s);
      setSalesRaw(sal || []);
      setTop(tp || []);
      setOrders(ord || []);
      setFunnelDaily(funnel?.daily || []);
      setFunnelTotals(
        funnel?.totals || { view: 0, cart: 0, checkout: 0, purchase: 0 }
      );
    } catch (e: any) {
      if (!isCanceled(e)) console.error(e);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!canAnalytics) return;
    if ("from" in debounced && "to" in debounced) {
      if (!debounced.from || !debounced.to) return;
    }
    fetchAll(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debounced), canAnalytics]);

  // Continuous series
  const sales = useMemo(() => {
    if (
      "from" in debounced &&
      "to" in debounced &&
      debounced.from &&
      debounced.to
    ) {
      return fillSalesSeriesRange(debounced.from, debounced.to, salesRaw);
    }
    return fillSalesSeries((debounced as any).days || days, salesRaw);
  }, [debounced, salesRaw, days]);

  // KPIs + Derived
  const ordersSeries = sales.map((d) => d.orders);
  const revenueSeries = sales.map((d) => d.revenue);
  const totalRevenue = revenueSeries.reduce((s, n) => s + n, 0);
  const aovData = useMemo(
    () =>
      sales.map((d) => ({
        date: d.date,
        aov: d.orders ? Math.round(d.revenue / d.orders) : 0,
      })),
    [sales]
  );

  // Status counts
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of orders) m[o.status] = (m[o.status] || 0) + 1;
    return m;
  }, [orders]);

  // Resolve raw category (ObjectId or slug or plain string) to a display name
  const resolveCategoryName = (raw: any): string => {
    if (!raw) return "Other";
    const str = String(raw);
    if (catDict[str]) return catDict[str]; // id or slug mapped
    const pretty = str.replace(/[-_]+/g, " ").trim();
    return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : "Other";
  };

  // Category bar data (qty)
  const categoryBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      for (const it of o.items || []) {
        const name = resolveCategoryName(it.product?.category);
        map.set(name, (map.get(name) || 0) + (it.qty || 0));
      }
    }
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 12);
  }, [orders, catDict]);

  // Payment split
  const paymentSplit = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const pm = o.paymentMethod || o.payment?.method || "Card";
      map.set(pm, (map.get(pm) || 0) + 1);
    }
    const palette = [
      "#7c3aed",
      "#10b981",
      "#06b6d4",
      "#f59e0b",
      "#f43f5e",
      "#8b5cf6",
      "#22c55e",
      "#0ea5e9",
    ];
    return Array.from(map.entries()).map(([name, value], i) => ({
      name,
      value,
      color: palette[i % palette.length],
    }));
  }, [orders]);

  // Weekday performance (dual axes)
  const weekdayData = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number }> = {
      Sun: { revenue: 0, orders: 0 },
      Mon: { revenue: 0, orders: 0 },
      Tue: { revenue: 0, orders: 0 },
      Wed: { revenue: 0, orders: 0 },
      Thu: { revenue: 0, orders: 0 },
      Fri: { revenue: 0, orders: 0 },
      Sat: { revenue: 0, orders: 0 },
    };
    for (const o of orders) {
      const d = new Date(o.createdAt);
      const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
      map[day].orders += 1;
      map[day].revenue += o.totalAmount || 0;
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v }));
  }, [orders]);

  const statusPie = useMemo(() => {
    const colors: Record<string, string> = {
      delivered: "#10b981",
      shipped: "#3b82f6",
      confirmed: "#6366f1",
      pending: "#f59e0b",
      cancelled: "#f43f5e",
    };
    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color: colors[name] || "#9ca3af",
    }));
  }, [statusCounts]);

  // Exports
  const exportSalesCSV = () =>
    downloadCSV(
      "admin-sales.csv",
      sales.map((d) => ({
        date: csvDate(d.date),
        orders: d.orders,
        revenue: d.revenue,
      })),
      {
        date: "Date",
        orders: "Orders",
        revenue: "Revenue",
      }
    );
  const exportAOVCSV = () =>
    downloadCSV(
      "admin-aov.csv",
      aovData.map((d) => ({ date: csvDate(d.date), aov: d.aov })),
      {
        date: "Date",
        aov: "AOV",
      }
    );
  const exportCategoriesCSV = () =>
    downloadCSV(
      "admin-categories.csv",
      categoryBars.map((d) => ({ category: d.name, qty: d.qty })),
      {
        category: "Category",
        qty: "Units",
      }
    );
  const exportPaymentCSV = () =>
    downloadCSV(
      "admin-payments.csv",
      paymentSplit.map((d) => ({ method: d.name, count: d.value })),
      {
        method: "Payment Method",
        count: "Count",
      }
    );
  const exportStatusCSV = () => {
    const rows = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));
    downloadCSV("admin-status.csv", rows, { status: "Status", count: "Count" });
  };
  const exportWeekdayCSV = () =>
    downloadCSV("admin-weekday.csv", weekdayData, {
      name: "Day",
      orders: "Orders",
      revenue: "Revenue",
    });

  const exportFunnelCSV = () =>
    downloadCSV(
      "admin-funnel.csv",
      funnelDaily.map((d) => ({
        date: csvDate(d.date),
        views: d.view,
        carts: d.cart,
        checkouts: d.checkout,
        purchases: d.purchase,
      })),
      {
        date: "Date",
        views: "Views",
        carts: "Add to cart",
        checkouts: "Checkout",
        purchases: "Purchases",
      }
    );

  const pct = (num: number, den: number) =>
    den > 0 ? Math.round((num / den) * 100) : 0;

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <PermissionGate
          perm="analytics:read"
          fallback={
            <div className="card p-6 text-gray-700">
              You don’t have access to Analytics.
            </div>
          }
        >
          {/* Top KPIs */}
          <div className="min-w-0">
            <OverviewCards
              stats={{
                totalUsers: stats?.totalUsers || 0,
                totalOrders: stats?.totalOrders || 0,
                totalProducts: stats?.totalProducts || 0,
                totalRevenue: totalRevenue || 0,
              }}
              trends={{ orders: ordersSeries, revenue: revenueSeries }}
            />
          </div>

          {/* Range controls */}
          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">Performance</h2>
            <div className="flex items-center gap-3">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="7d">7d</TabsTrigger>
                  <TabsTrigger value="14d">14d</TabsTrigger>
                  <TabsTrigger value="30d">30d</TabsTrigger>
                  <TabsTrigger value="90d">90d</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                </TabsList>
              </Tabs>
              {tab === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={from}
                    onChange={(e) =>
                      setRange((r) => ({ ...r, from: e.target.value }))
                    }
                    className="bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50"
                  />
                  <input
                    type="date"
                    value={to}
                    onChange={(e) =>
                      setRange((r) => ({ ...r, to: e.target.value }))
                    }
                    className="bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Charts grid (top) */}
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left: dual line + AOV */}
            <div className="xl:col-span-7 space-y-6 min-w-0">
              <Card className="min-w-0">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Revenue & Orders</CardTitle>
                  <Button variant="outline" onClick={exportSalesCSV}>
                    Export Sales CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={sales}
                        margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid stroke="#e5e7eb" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#6b7280", fontSize: 11 }}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fill: "#6b7280", fontSize: 11 }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fill: "#6b7280", fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(v: any, n: any) =>
                            n === "revenue"
                              ? `₹${Number(v).toLocaleString("en-IN")}`
                              : v
                          }
                        />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="orders"
                          stroke="#7c3aed"
                          strokeWidth={2}
                          dot={false}
                          name="Orders"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="revenue"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          name="Revenue"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-w-0">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Average Order Value (AOV)</CardTitle>
                  <Button variant="outline" onClick={exportAOVCSV}>
                    Export AOV CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={aovData}
                        margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid stroke="#e5e7eb" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#6b7280", fontSize: 11 }}
                        />
                        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                        <Tooltip
                          formatter={(v: any) =>
                            `₹${Number(v).toLocaleString("en-IN")}`
                          }
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="aov"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={false}
                          name="AOV"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: two donuts with legends */}
            <div className="xl:col-span-5 grid grid-cols-1 gap-6 min-w-0">
              <Card className="min-w-0">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Payment Methods</CardTitle>
                  <Button variant="outline" onClick={exportPaymentCSV}>
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[260px]">
                    {paymentSplit.length === 0 ? (
                      <div className="text-sm text-gray-600 p-3">No data.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentSplit}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={3}
                          >
                            {paymentSplit.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Legend chips */}
                  {paymentSplit.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {paymentSplit.map((p) => (
                        <span
                          key={p.name}
                          className="inline-flex items-center gap-2 text-xs text-gray-700 border border-gray-200 rounded-full px-2 py-1 bg-white"
                        >
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ background: p.color }}
                          />
                          {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="min-w-0">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Order Status</CardTitle>
                  <Button variant="outline" onClick={exportStatusCSV}>
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[260px]">
                    {statusPie.length === 0 ? (
                      <div className="text-sm text-gray-600 p-3">No data.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusPie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                          >
                            {statusPie.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Legend chips */}
                  {statusPie.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusPie.map((s) => (
                        <span
                          key={s.name}
                          className="inline-flex items-center gap-2 text-xs text-gray-700 border border-gray-200 rounded-full px-2 py-1 bg-white"
                        >
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ background: s.color }}
                          />
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Conversion Funnel */}
          <div className="mt-4">
            <Card className="min-w-0">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Conversion Funnel</CardTitle>
                <Button variant="outline" onClick={exportFunnelCSV}>
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Summary steps */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { key: "view", label: "Views", color: "#9ca3af" },
                    { key: "cart", label: "Add to Cart", color: "#7c3aed" },
                    { key: "checkout", label: "Checkout", color: "#6366f1" },
                    { key: "purchase", label: "Purchases", color: "#10b981" },
                  ].map((s, idx, arr) => {
                    const val = (funnelTotals as any)[s.key] || 0;
                    const prev =
                      idx === 0
                        ? val
                        : (funnelTotals as any)[arr[idx - 1].key] || 0;
                    const p = pct(val, prev);
                    return (
                      <div
                        key={s.key}
                        className="rounded-lg border border-gray-200 bg-white p-4"
                      >
                        <div className="text-sm text-gray-600">{s.label}</div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {val}
                        </div>
                        <div className="mt-2 h-2 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${p}%`,
                              background: s.color,
                              transition: "width .3s ease",
                            }}
                          />
                        </div>
                        {idx > 0 && (
                          <div className="mt-1 text-xs text-gray-600">
                            {p}% from {arr[idx - 1].label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Funnel over time */}
                <div className="w-full h-[320px] mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={funnelDaily}
                      margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#6b7280", fontSize: 11 }}
                      />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="view"
                        name="Views"
                        stroke="#9ca3af"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="cart"
                        name="Add to Cart"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="checkout"
                        name="Checkout"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="purchase"
                        name="Purchases"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* More charts */}
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-6">
            <Card className="xl:col-span-7 min-w-0">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Orders by Category</CardTitle>
                <Button variant="outline" onClick={exportCategoriesCSV}>
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="w-full h-[300px]">
                  {categoryBars.length === 0 ? (
                    <div className="text-sm text-gray-600 p-3">
                      No category data.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={categoryBars}
                        layout="vertical"
                        margin={{ left: 12, right: 24 }}
                      >
                        <XAxis
                          type="number"
                          tick={{ fill: "#6b7280", fontSize: 12 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: "#6b7280", fontSize: 12 }}
                          width={120}
                        />
                        <Tooltip
                          formatter={(value: any) => [`${value}`, "Units"]}
                          labelFormatter={(label: any) => `Category: ${label}`}
                          cursor={{ fill: "rgba(124, 58, 237, 0.06)" }}
                        />
                        <Bar dataKey="qty" radius={[4, 4, 4, 4]}>
                          {categoryBars.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={categoryColor(entry.name)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {/* Legend chips */}
                {categoryBars.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categoryBars.map((c) => (
                      <span
                        key={c.name}
                        className="inline-flex items-center gap-2 text-xs text-gray-700 border border-gray-200 rounded-full px-2 py-1 bg-white"
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ background: categoryColor(c.name) }}
                        />
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-5 min-w-0">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Weekday Performance</CardTitle>
                <Button variant="outline" onClick={exportWeekdayCSV}>
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekdayData} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(v: any, n: any) =>
                          n === "revenue"
                            ? `₹${Number(v).toLocaleString("en-IN")}`
                            : v
                        }
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="orders"
                        name="Orders"
                        fill="#7c3aed"
                        barSize={16}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="revenue"
                        name="Revenue"
                        fill="#10b981"
                        barSize={16}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tables */}
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-6">
            <Card className="xl:col-span-7 min-w-0">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Recent Orders</CardTitle>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      "admin-orders.csv",
                      orders.map((o: any) => ({
                        id: o._id,
                        date: csvDate(o.createdAt),
                        status: o.status,
                        total: o.totalAmount,
                        customer: o.user?.email || "",
                      })),
                      {
                        id: "Order ID",
                        date: "Date",
                        status: "Status",
                        total: "Total",
                        customer: "Customer",
                      }
                    )
                  }
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {orders.length === 0 ? (
                  <div className="text-sm text-gray-600">No orders found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="py-2">Customer</th>
                          <th className="py-2">Date</th>
                          <th className="py-2">Status</th>
                          <th className="py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 10).map((o) => (
                          <tr
                            key={o._id}
                            className="border-t border-gray-200 text-gray-900"
                          >
                            <td className="py-2">
                              {o.user?.name || o.user?.email || "—"}
                            </td>
                            <td className="py-2">{csvDate(o.createdAt)}</td>
                            <td className="py-2 capitalize">{o.status}</td>
                            <td className="py-2">{currency(o.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-5 min-w-0">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Top Products</CardTitle>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      "admin-top-products.csv",
                      top.map((t: any) => ({
                        product: t.product,
                        sold: t.sold,
                        revenue: t.revenue,
                        ownerName: t.ownerName || "",
                        ownerEmail: t.ownerEmail || "",
                      })),
                      {
                        product: "Product",
                        sold: "Sold",
                        revenue: "Revenue",
                        ownerName: "Owner Name",
                        ownerEmail: "Owner Email",
                      }
                    )
                  }
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {top.length === 0 ? (
                  <div className="text-sm text-gray-600">No data</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="py-2">Product</th>
                          <th className="py-2">Sold</th>
                          <th className="py-2">Revenue</th>
                          <th className="py-2">Owner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top.map((t, idx) => (
                          <tr
                            key={idx}
                            className="border-t border-gray-200 text-gray-900"
                          >
                            <td className="py-2">{t.product}</td>
                            <td className="py-2">{t.sold}</td>
                            <td className="py-2">
                              ₹{t.revenue.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2">{t.ownerName || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </PermissionGate>
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminAnalyticsPage), {
  ssr: false,
});
