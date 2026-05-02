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
      "#0369a1",
      "#10b981",
      "#06b6d4",
      "#f59e0b",
      "#f43f5e",
      "#0ea5b7",
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
      confirmed: "#0f766e",
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
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-black uppercase tracking-widest text-sm text-center">
              You don&apos;t have access to Analytics.
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
          <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6">
            <h2 className="text-2xl font-black uppercase tracking-widest text-foreground border-l-[6px] border-primary pl-4">Performance</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
                <TabsList className="bg-muted border-[3px] border-border rounded-none p-1 flex">
                  <TabsTrigger value="7d" className="rounded-none font-bold uppercase tracking-widest text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">7d</TabsTrigger>
                  <TabsTrigger value="14d" className="rounded-none font-bold uppercase tracking-widest text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">14d</TabsTrigger>
                  <TabsTrigger value="30d" className="rounded-none font-bold uppercase tracking-widest text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">30d</TabsTrigger>
                  <TabsTrigger value="90d" className="rounded-none font-bold uppercase tracking-widest text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">90d</TabsTrigger>
                  <TabsTrigger value="custom" className="rounded-none font-bold uppercase tracking-widest text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">Custom</TabsTrigger>
                </TabsList>
              </Tabs>
              {tab === "custom" && (
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={from}
                    onChange={(e) =>
                      setRange((r) => ({ ...r, from: e.target.value }))
                    }
                    className="w-full sm:w-auto bg-card border-[3px] border-border rounded-none px-4 py-2 text-foreground font-bold uppercase tracking-widest shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all text-xs"
                  />
                  <span className="font-black uppercase tracking-widest text-foreground">TO</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) =>
                      setRange((r) => ({ ...r, to: e.target.value }))
                    }
                    className="w-full sm:w-auto bg-card border-[3px] border-border rounded-none px-4 py-2 text-foreground font-bold uppercase tracking-widest shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Charts grid (top) */}
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Left: dual line + AOV */}
            <div className="xl:col-span-7 space-y-8 min-w-0">
              <Card className="min-w-0 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none">
                <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-4">
                  <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Revenue & Orders</CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={exportSalesCSV}
                    className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                  >
                    Export CSV
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
                          stroke="#0369a1"
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

              <Card className="min-w-0 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none">
                <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-4">
                  <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Average Order Value (AOV)</CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={exportAOVCSV}
                    className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                  >
                    Export CSV
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
                          stroke="#0f766e"
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
            <div className="xl:col-span-5 grid grid-cols-1 gap-8 min-w-0">
              <Card className="min-w-0 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none">
                <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-4">
                  <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Payment Methods</CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={exportPaymentCSV}
                    className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                  >
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[260px]">
                    {paymentSplit.length === 0 ? (
                      <div className="text-sm text-foreground font-bold uppercase tracking-widest p-3">No data.</div>
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
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      {paymentSplit.map((p) => (
                        <span
                          key={p.name}
                          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground border-[3px] border-border bg-card px-3 py-1.5 shadow-[2px_2px_0px_#111]"
                        >
                          <span
                            className="inline-block w-3 h-3 border-[2px] border-border"
                            style={{ background: p.color }}
                          />
                          {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="min-w-0 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none">
                <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-4">
                  <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Order Status</CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={exportStatusCSV}
                    className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                  >
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[260px]">
                    {statusPie.length === 0 ? (
                      <div className="text-sm text-foreground font-bold uppercase tracking-widest p-3">No data.</div>
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
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      {statusPie.map((s) => (
                        <span
                          key={s.name}
                          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground border-[3px] border-border bg-card px-3 py-1.5 shadow-[2px_2px_0px_#111]"
                        >
                          <span
                            className="inline-block w-3 h-3 border-[2px] border-border"
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
          <div className="mt-8">
            <Card className="min-w-0 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none">
              <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-4">
                <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Conversion Funnel</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={exportFunnelCSV}
                  className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Summary steps */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { key: "view", label: "Views", color: "#9ca3af" },
                    { key: "cart", label: "Add to Cart", color: "#0369a1" },
                    { key: "checkout", label: "Checkout", color: "#0f766e" },
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
                        className="border-[3px] border-border bg-card shadow-[4px_4px_0px_#111] p-4 transition-transform hover:-translate-y-1"
                      >
                        <div className="text-xs font-black uppercase tracking-widest text-foreground">{s.label}</div>
                        <div className="text-3xl font-black text-foreground mt-2">
                          {val}
                        </div>
                        <div className="mt-4 h-4 bg-muted border-[3px] border-border rounded-none overflow-hidden p-0.5">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${p}%`,
                              background: s.color,
                              transition: "width .3s ease",
                            }}
                          />
                        </div>
                        {idx > 0 && (
                          <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right border-t-[3px] border-border pt-2 border-dashed">
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
                        stroke="#0369a1"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="checkout"
                        name="Checkout"
                        stroke="#0f766e"
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
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
            <Card className="xl:col-span-7 min-w-0 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none">
              <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-4">
                <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Orders by Category</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={exportCategoriesCSV}
                  className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="w-full h-[300px]">
                  {categoryBars.length === 0 ? (
                    <div className="text-sm font-bold uppercase tracking-widest text-foreground p-3">
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
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {categoryBars.map((c) => (
                      <span
                        key={c.name}
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground border-[3px] border-border bg-card px-3 py-1.5 shadow-[2px_2px_0px_#111]"
                      >
                        <span
                          className="inline-block w-3 h-3 border-[2px] border-border"
                          style={{ background: categoryColor(c.name) }}
                        />
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-5 min-w-0 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none">
              <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-4">
                <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Weekday Performance</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={exportWeekdayCSV}
                  className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                >
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
                        fill="#0369a1"
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
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
            <Card className="xl:col-span-7 min-w-0 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none flex flex-col">
              <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-0">
                <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Recent Orders</CardTitle>
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
                  className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0 p-0 flex-1 overflow-auto">
                {orders.length === 0 ? (
                  <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground p-6">No orders found.</div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0 z-10 border-b-[3px] border-border">
                        <tr className="text-left font-black uppercase tracking-widest text-foreground text-xs">
                          <th className="py-3 px-4 border-r-[3px] border-border whitespace-nowrap">Customer</th>
                          <th className="py-3 px-4 border-r-[3px] border-border whitespace-nowrap">Date</th>
                          <th className="py-3 px-4 border-r-[3px] border-border whitespace-nowrap text-center">Status</th>
                          <th className="py-3 px-4 text-right whitespace-nowrap">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-[3px] divide-border font-bold uppercase tracking-widest text-[11px] text-foreground">
                        {orders.slice(0, 10).map((o) => (
                          <tr
                            key={o._id}
                            className="hover:bg-muted/50 transition-colors"
                          >
                            <td className="py-3 px-4 border-r-[3px] border-border max-w-[150px] truncate" title={o.user?.name || o.user?.email || "—"}>
                              {o.user?.name || o.user?.email || "—"}
                            </td>
                            <td className="py-3 px-4 border-r-[3px] border-border whitespace-nowrap">{csvDate(o.createdAt)}</td>
                            <td className="py-3 px-4 border-r-[3px] border-border text-center">
                              <span className={`px-2 py-0.5 border-[2px] inline-block w-full max-w-[100px] truncate
                                ${
                                  o.status === "delivered" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                                  o.status === "shipped" ? "bg-blue-100 text-blue-800 border-blue-300" :
                                  o.status === "confirmed" ? "bg-indigo-100 text-indigo-800 border-indigo-300" :
                                  o.status === "cancelled" ? "bg-rose-100 text-rose-800 border-rose-300" :
                                  "bg-amber-100 text-amber-800 border-amber-300"
                                }
                              `}>
                                {o.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap text-emerald-600 font-black">{currency(o.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-5 min-w-0 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none flex flex-col">
              <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-0">
                <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Top Products</CardTitle>
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
                  className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                >
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="pt-0 p-0 flex-1 overflow-auto">
                {top.length === 0 ? (
                  <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground p-6">No data</div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0 z-10 border-b-[3px] border-border">
                        <tr className="text-left font-black uppercase tracking-widest text-foreground text-xs">
                          <th className="py-3 px-4 border-r-[3px] border-border whitespace-nowrap">Product</th>
                          <th className="py-3 px-4 border-r-[3px] border-border whitespace-nowrap text-center">Sold</th>
                          <th className="py-3 px-4 border-r-[3px] border-border whitespace-nowrap text-right">Revenue</th>
                          <th className="py-3 px-4 whitespace-nowrap">Owner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-[3px] divide-border font-bold uppercase tracking-widest text-[11px] text-foreground">
                        {top.map((t, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-muted/50 transition-colors"
                          >
                            <td className="py-3 px-4 border-r-[3px] border-border max-w-[150px] truncate" title={t.product}>{t.product}</td>
                            <td className="py-3 px-4 border-r-[3px] border-border text-center">
                              <span className="bg-primary/10 text-primary border-[2px] border-primary px-2 py-0.5">{t.sold}</span>
                            </td>
                            <td className="py-3 px-4 border-r-[3px] border-border text-right text-emerald-600 font-black whitespace-nowrap">
                              {currency(t.revenue)}
                            </td>
                            <td className="py-3 px-4 max-w-[120px] truncate" title={t.ownerName || "—"}>{t.ownerName || "—"}</td>
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

