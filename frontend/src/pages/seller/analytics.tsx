import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import SellerLayout from "../../components/layout/SellerLayout";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import PermissionGate from "../../components/layout/PermissionGate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/shadcn/card";
import { Button } from "../../components/shadcn/button";
import { Tabs, TabsList, TabsTrigger } from "../../components/shadcn/tabs";
import StarsBar from "../../components/charts/StarsBar";
import OverviewCards from "../../components/charts/OverviewCards";
import api from "../../utils/api";
import { currency } from "../../utils/format";
import { downloadCSV, csvDate } from "../../utils/csv";
import { fillSalesSeries, fillSalesSeriesRange } from "../../utils/analytics";
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
  Cell,
} from "recharts";

// Types
type Overview = {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
};
type SalesPoint = { date: string; orders: number; revenue: number };
type SellerOrder = {
  _id?: string;
  status: string;
  items: {
    qty: number;
    price: number;
    product?: { title?: string; category?: string };
  }[];
  user?: { _id: string; email?: string };
  createdAt?: string;
};
type TopProduct = {
  productId: string;
  product: string;
  sold: number;
  revenue: number;
};
type ReviewsAnalytics = {
  totalReviews: number;
  overallAvgRating: number;
  distribution: Record<string, number>;
  topReviewed: {
    productId: string;
    product: string;
    avgRating: number;
    reviews: number;
  }[];
};

// Helpers
function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
function lastNDaysRange(n: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (n - 1));
  return { from: fmt(from), to: fmt(to) };
}
const isCanceled = (e: any) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  e?.message === "canceled";

// Deterministic unlimited color generator (no manual mapping)
const categoryColor = (name: string) => {
  const s = String(name || "Other");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 70% 55%)`;
};

function UpdatingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-full border-2 border-gray-300 border-t-purple-500 h-6 w-6 animate-spin bg-white/60 backdrop-blur-[1px]" />
    </div>
  );
}

function SellerAnalyticsPage() {
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
  const debounced = useDebounced(params, 400);

  // Data + flags
  const [overview, setOverview] = useState<Overview | null>(null);
  const [salesRaw, setSalesRaw] = useState<SalesPoint[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [reviews, setReviews] = useState<ReviewsAnalytics | null>(null);

  // Category dictionary: id/slug -> name
  const [catDict, setCatDict] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const initialRef = useRef(true);

  // Fetch categories once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/categories");
        if (!mounted) return;
        // Build id and slug map
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
    controllerRef.current?.abort();
    const c = new AbortController();
    controllerRef.current = c;
    const current = c;

    if (initialRef.current) {
      setLoading(true);
      initialRef.current = false;
    } else {
      setFetching(true);
    }

    try {
      const [
        { data: ov },
        { data: sal },
        { data: ord },
        { data: top },
        { data: rev },
      ] = await Promise.all([
        api.get("/seller/analytics/overview", { params: p, signal: c.signal }),
        api.get("/seller/analytics/sales", { params: p, signal: c.signal }),
        api.get("/seller/orders", { params: p, signal: c.signal }),
        api.get("/seller/analytics/top-products", {
          params: p,
          signal: c.signal,
        }),
        api.get("/seller/analytics/reviews", { params: p, signal: c.signal }),
      ]);

      if (controllerRef.current !== current) return;
      setOverview(ov || null);
      setSalesRaw(sal || []);
      setOrders(ord || []);
      setTopProducts(top || []);
      setReviews(rev || null);
    } catch (e: any) {
      if (!isCanceled(e)) {
        // Optional toast
      }
    } finally {
      if (controllerRef.current === current) {
        setLoading(false);
        setFetching(false);
      }
    }
  };

  useEffect(() => {
    if ("from" in debounced && "to" in debounced) {
      if (!debounced.from || !debounced.to) return;
    }
    fetchAll(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debounced)]);

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

  // Derived
  const ordersSeries = sales.map((d) => d.orders);
  const revenueSeries = sales.map((d) => d.revenue);
  const aovData = useMemo(
    () =>
      sales.map((d) => ({
        date: d.date,
        aov: d.orders ? Math.round(d.revenue / d.orders) : 0,
      })),
    [sales]
  );

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) map.set(o.status, (map.get(o.status) || 0) + 1);
    return Array.from(map.entries()).reduce<Record<string, number>>(
      (acc, [k, v]) => {
        acc[k] = v;
        return acc;
      },
      {}
    );
  }, [orders]);

  // Resolve raw category (ObjectId or slug or plain string) to a name
  const resolveCategoryName = (raw: any): string => {
    if (!raw) return "Other";
    const str = String(raw);
    // If exact match in dict (id or slug), use it
    if (catDict[str]) return catDict[str];
    // fallback: prettify slug-ish strings
    const pretty = str.replace(/[-_]+/g, " ").trim();
    return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : "Other";
  };

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
      .slice(0, 12); // show more if you want
  }, [orders, catDict]);

  // Exports
  const exportSalesCSV = () =>
    downloadCSV(
      "seller-sales.csv",
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
  const exportOrdersCSV = () =>
    downloadCSV(
      "seller-orders.csv",
      orders.map((o: any) => ({
        id: o._id,
        date: csvDate(o.createdAt || ""),
        status: o.status,
        total: (o.items || []).reduce(
          (s: number, it: any) => s + it.qty * it.price,
          0
        ),
        customer: o.user?.email || "",
      })),
      {
        id: "Order ID",
        date: "Date",
        status: "Status",
        total: "Total",
        customer: "Customer",
      }
    );
  const exportTopProductsCSV = () =>
    downloadCSV(
      "seller-top-products.csv",
      (topProducts || []).map((t) => ({
        product: t.product,
        sold: t.sold,
        revenue: t.revenue,
      })),
      { product: "Product", sold: "Sold", revenue: "Revenue" }
    );
  const exportCategoriesCSV = () =>
    downloadCSV("seller-categories.csv", categoryBars, {
      name: "Category",
      qty: "Units",
    });
  const exportAOVCSV = () =>
    downloadCSV(
      "seller-aov.csv",
      aovData.map((d) => ({ date: csvDate(d.date), aov: d.aov })),
      { date: "Date", aov: "AOV" }
    );

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:analytics:read"
          fallback={
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-black uppercase tracking-widest text-sm text-center">
              You don&apos;t have access to Analytics.
            </div>
          }
        >
          {!loading && (
            <OverviewCards
              stats={{
                totalUsers: 0,
                totalOrders: overview?.totalOrders || 0,
                totalProducts: overview?.totalProducts || 0,
                totalRevenue: overview?.totalRevenue || 0,
              }}
              trends={{ orders: ordersSeries, revenue: revenueSeries }}
            />
          )}
          {loading && <div className="card p-6 text-gray-600">Loading…</div>}

          {!loading && (
            <div className="mt-6 flex items-center justify-between gap-4 flex-wrap bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-4 font-bold mb-6">
              <h2 className="text-xl font-black uppercase tracking-widest text-foreground">Performance</h2>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2">
                  <button
                    onClick={() => setTab("7d")}
                    className={`px-4 py-2 border-[3px] border-border text-xs uppercase tracking-widest font-black transition-all hover:translate-x-[2px] hover:translate-y-[2px] ${
                      tab === "7d"
                        ? "bg-primary text-primary-foreground shadow-[2px_2px_0px_#111] hover:shadow-none"
                        : "bg-card text-foreground shadow-[2px_2px_0px_transparent] hover:shadow-[2px_2px_0px_#111]"
                    }`}
                  >
                    7d
                  </button>
                  <button
                    onClick={() => setTab("14d")}
                    className={`px-4 py-2 border-[3px] border-border text-xs uppercase tracking-widest font-black transition-all hover:translate-x-[2px] hover:translate-y-[2px] ${
                      tab === "14d"
                        ? "bg-primary text-primary-foreground shadow-[2px_2px_0px_#111] hover:shadow-none"
                        : "bg-card text-foreground shadow-[2px_2px_0px_transparent] hover:shadow-[2px_2px_0px_#111]"
                    }`}
                  >
                    14d
                  </button>
                  <button
                    onClick={() => setTab("30d")}
                    className={`px-4 py-2 border-[3px] border-border text-xs uppercase tracking-widest font-black transition-all hover:translate-x-[2px] hover:translate-y-[2px] ${
                      tab === "30d"
                        ? "bg-primary text-primary-foreground shadow-[2px_2px_0px_#111] hover:shadow-none"
                        : "bg-card text-foreground shadow-[2px_2px_0px_transparent] hover:shadow-[2px_2px_0px_#111]"
                    }`}
                  >
                    30d
                  </button>
                  <button
                    onClick={() => setTab("90d")}
                    className={`px-4 py-2 border-[3px] border-border text-xs uppercase tracking-widest font-black transition-all hover:translate-x-[2px] hover:translate-y-[2px] ${
                      tab === "90d"
                        ? "bg-primary text-primary-foreground shadow-[2px_2px_0px_#111] hover:shadow-none"
                        : "bg-card text-foreground shadow-[2px_2px_0px_transparent] hover:shadow-[2px_2px_0px_#111]"
                    }`}
                  >
                    90d
                  </button>
                  <button
                    onClick={() => setTab("custom")}
                    className={`px-4 py-2 border-[3px] border-border text-xs uppercase tracking-widest font-black transition-all hover:translate-x-[2px] hover:translate-y-[2px] ${
                      tab === "custom"
                        ? "bg-primary text-primary-foreground shadow-[2px_2px_0px_#111] hover:shadow-none"
                        : "bg-card text-foreground shadow-[2px_2px_0px_transparent] hover:shadow-[2px_2px_0px_#111]"
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {tab === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={from}
                      onChange={(e) =>
                        setRange((r) => ({ ...r, from: e.target.value }))
                      }
                      className="bg-card border-[3px] border-border rounded-none px-3 py-1.5 text-foreground font-black uppercase tracking-widest shadow-[2px_2px_0px_#111] focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] hover:shadow-none transition-all text-[10px]"
                    />
                    <input
                      type="date"
                      value={to}
                      onChange={(e) =>
                        setRange((r) => ({ ...r, to: e.target.value }))
                      }
                      className="bg-card border-[3px] border-border rounded-none px-3 py-1.5 text-foreground font-black uppercase tracking-widest shadow-[2px_2px_0px_#111] focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] hover:shadow-none transition-all text-[10px]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && (
            <div className="relative">
              <UpdatingOverlay show={fetching} />

              <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 space-y-6">
                  {/* Revenue & Orders */}
                  <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] flex flex-col">
                    <div className="flex flex-row items-center justify-between p-6 border-b-[3px] border-border bg-muted">
                      <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Revenue & Orders {tab !== "custom" && `(last ${days} days)`}</h3>
                      <button onClick={exportSalesCSV} className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all">
                        Export Sales CSV
                      </button>
                    </div>
                    <div className="p-6 pt-6">
                      <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={sales}
                            margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                          >
                            <CartesianGrid stroke="#e5e7eb" vertical={false} strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "#6b7280", fontSize: 10, fontWeight: "bold" }}
                              axisLine={{ stroke: "#000", strokeWidth: 3 }}
                              tickLine={{ stroke: "#000", strokeWidth: 3 }}
                            />
                            <YAxis
                              yAxisId="left"
                              tick={{ fill: "#6b7280", fontSize: 10, fontWeight: "bold" }}
                              axisLine={{ stroke: "#000", strokeWidth: 3 }}
                              tickLine={{ stroke: "#000", strokeWidth: 3 }}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: "#6b7280", fontSize: 10, fontWeight: "bold" }}
                              axisLine={{ stroke: "#000", strokeWidth: 3 }}
                              tickLine={{ stroke: "#000", strokeWidth: 3 }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "3px solid hsl(var(--border))",
                                boxShadow: "4px 4px 0px #111",
                                borderRadius: "0",
                                fontWeight: "bold",
                                fontFamily: "Inter",
                                fontSize: "12px",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                              itemStyle={{ color: "hsl(var(--foreground))" }}
                              formatter={(v: any, n: any) =>
                                n === "revenue"
                                  ? `₹${Number(v).toLocaleString("en-IN")}`
                                  : v
                              }
                            />
                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                            <Line
                              isAnimationActive
                              animationDuration={350}
                              animationEasing="ease-out"
                              yAxisId="left"
                              type="monotone"
                              dataKey="orders"
                              stroke="#9333ea"
                              strokeWidth={4}
                              dot={{ stroke: '#000', strokeWidth: 2, fill: '#fff', r: 4 }}
                              activeDot={{ stroke: '#000', strokeWidth: 3, r: 6, fill: '#9333ea' }}
                              name="Orders"
                            />
                            <Line
                              isAnimationActive
                              animationDuration={350}
                              animationEasing="ease-out"
                              yAxisId="right"
                              type="monotone"
                              dataKey="revenue"
                              stroke="#d97706"
                              strokeWidth={4}
                              dot={{ stroke: '#000', strokeWidth: 2, fill: '#fff', r: 4 }}
                              activeDot={{ stroke: '#000', strokeWidth: 3, r: 6, fill: '#d97706' }}
                              name="Revenue"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* AOV */}
                  <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] flex flex-col">
                    <div className="flex flex-row items-center justify-between p-6 border-b-[3px] border-border bg-muted">
                      <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Average Order Value (AOV)</h3>
                      <button onClick={exportAOVCSV} className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all">
                        Export AOV CSV
                      </button>
                    </div>
                    <div className="p-6 pt-6">
                      <div className="w-full h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={sales.map((d) => ({
                              date: d.date,
                              aov: d.orders
                                ? Math.round(d.revenue / d.orders)
                                : 0,
                            }))}
                            margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                          >
                            <CartesianGrid stroke="#e5e7eb" vertical={false} strokeDasharray="3 3"/>
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "#6b7280", fontSize: 10, fontWeight: "bold" }}
                              axisLine={{ stroke: "#000", strokeWidth: 3 }}
                              tickLine={{ stroke: "#000", strokeWidth: 3 }}
                            />
                            <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontWeight: "bold" }} axisLine={{ stroke: "#000", strokeWidth: 3 }} tickLine={{ stroke: "#000", strokeWidth: 3 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "3px solid hsl(var(--border))",
                                boxShadow: "4px 4px 0px #111",
                                borderRadius: "0",
                                fontWeight: "bold",
                                fontFamily: "Inter",
                                fontSize: "12px",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                              itemStyle={{ color: "hsl(var(--foreground))" }}
                              formatter={(v: any) =>
                                `₹${Number(v).toLocaleString("en-IN")}`
                              }
                            />
                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                            <Line
                              isAnimationActive
                              animationDuration={350}
                              animationEasing="ease-out"
                              type="monotone"
                              dataKey="aov"
                              stroke="#9333ea"
                              strokeWidth={4}
                              dot={{ stroke: '#000', strokeWidth: 2, fill: '#fff', r: 4 }}
                              activeDot={{ stroke: '#000', strokeWidth: 3, r: 6, fill: '#9333ea' }}
                              name="AOV"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Orders by Category + Ratings */}
                <div className="xl:col-span-5 space-y-6">
                  <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] flex flex-col">
                    <div className="flex flex-row items-center justify-between p-6 border-b-[3px] border-border bg-muted">
                      <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Orders by Category</h3>
                      <button onClick={exportCategoriesCSV} className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all">
                        Export CSV
                      </button>
                    </div>
                    <div className="p-6">
                      <div className="w-full h-[260px]">
                        {categoryBars.length === 0 ? (
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground p-4 text-center">
                            No category data.
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={categoryBars}
                              layout="vertical"
                              margin={{ left: 12, right: 12 }}
                            >
                              <XAxis type="number" hide />
                              <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fill: "#6b7280", fontSize: 10, fontWeight: "bold" }}
                                axisLine={{ stroke: "#000", strokeWidth: 3 }}
                                tickLine={{ stroke: "#000", strokeWidth: 3 }}
                                width={120}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "3px solid hsl(var(--border))",
                                  boxShadow: "4px 4px 0px #111",
                                  borderRadius: "0",
                                  fontWeight: "bold",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                                itemStyle={{ color: "hsl(var(--foreground))", fontWeight: "black" }}
                                formatter={(value: any) => [
                                  `${value}`,
                                  "Units",
                                ]}
                                labelFormatter={(label: any) =>
                                  `Category: ${label}`
                                }
                                cursor={{ fill: "rgba(124, 58, 237, 0.06)" }}
                              />
                              <Bar
                                dataKey="qty"
                                isAnimationActive
                                animationDuration={350}
                                stroke="#000"
                                strokeWidth={2}
                              >
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
                      {categoryBars.length > 0 && (
                        <div className="mt-6 flex flex-wrap gap-2">
                          {categoryBars.map((c) => (
                            <span
                              key={c.name}
                              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground border-[3px] border-border shadow-[2px_2px_0px_#111] px-2 py-1 bg-card hover:translate-x-[2px] hover:translate-y-[2px] transition-all hover:shadow-none"
                            >
                              <span
                                className="inline-block w-2.5 h-2.5 shadow-[2px_2px_0px_#111] border-[2px] border-border"
                                style={{ background: categoryColor(c.name) }}
                              />
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] flex flex-col">
                    <div className="flex flex-row items-center justify-between p-6 border-b-[3px] border-border bg-muted">
                      <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Ratings Overview</h3>
                      <button
                        onClick={() =>
                          downloadCSV(
                            "seller-reviews.csv",
                            (reviews?.topReviewed || []).map((r) => ({
                              product: r.product,
                              avgRating: r.avgRating,
                              reviews: r.reviews,
                            })),
                            {
                              product: "Product",
                              avgRating: "Avg Rating",
                              reviews: "Reviews",
                            }
                          )
                        }
                        className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all"
                      >
                        Export CSV
                      </button>
                    </div>
                    <div className="p-6">
                      <StarsBar
                        distribution={reviews?.distribution || {}}
                        avg={reviews?.overallAvgRating || 0}
                      />
                      <div className="mt-6 font-black uppercase tracking-widest text-xs text-foreground p-3 border-[3px] border-border bg-muted text-center shadow-[4px_4px_0px_#111]">
                        Total reviews:{" "}
                        <span className="text-primary text-xl">
                          {reviews?.totalReviews || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders + Top Products */}
              <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] flex flex-col">
                  <div className="flex flex-row items-center justify-between p-6 border-b-[3px] border-border bg-muted">
                    <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Recent Orders</h3>
                    <button onClick={exportOrdersCSV} className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all">
                      Export CSV
                    </button>
                  </div>
                  <div className="p-0">
                    {orders.length === 0 ? (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground p-8 text-center">
                        No orders found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-muted border-b-[3px] border-border">
                            <tr className="text-left font-black uppercase tracking-widest text-foreground text-[10px]">
                              <th className="px-6 py-4 border-r-[3px] border-border">Order</th>
                              <th className="px-6 py-4 border-r-[3px] border-border">Date</th>
                              <th className="px-6 py-4 border-r-[3px] border-border">Status</th>
                              <th className="px-6 py-4 border-r-[3px] border-border">Total</th>
                              <th className="px-6 py-4">Customer</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-[3px] divide-border">
                            {orders.slice(0, 10).map((o) => {
                              const total = (o.items || []).reduce(
                                (s, it) => s + it.qty * it.price,
                                0
                              );
                              return (
                                <tr
                                  key={o._id}
                                  className="hover:bg-muted/50 transition-colors"
                                >
                                  <td className="px-6 py-4 border-r-[3px] border-border font-black text-xs text-foreground uppercase tracking-widest">
                                    #{(o._id || "").slice(-6)}
                                  </td>
                                  <td className="px-6 py-4 border-r-[3px] border-border font-bold text-[10px] tracking-widest text-foreground">
                                    {o.createdAt ? csvDate(o.createdAt) : "—"}
                                  </td>
                                  <td className="px-6 py-4 border-r-[3px] border-border">
                                     <span className={`px-2 py-1 border-[2px] font-bold uppercase tracking-widest text-[10px]
                                      ${
                                        o.status === "delivered"
                                          ? "bg-emerald-400 text-emerald-950 border-emerald-950"
                                          : o.status === "cancelled"
                                          ? "bg-rose-400 text-rose-950 border-rose-950"
                                          : o.status === "processing"
                                          ? "bg-blue-400 text-blue-950 border-blue-950"
                                          : "bg-amber-400 text-amber-950 border-amber-950"
                                      }
                                    `}>
                                      {o.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 border-r-[3px] border-border font-black text-xs text-foreground">{currency(total)}</td>
                                  <td className="px-6 py-4 font-bold text-[10px] tracking-widest text-muted-foreground truncate max-w-[200px]">{o.user?.email || "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="xl:col-span-5 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] flex flex-col">
                  <div className="flex flex-row items-center justify-between p-6 border-b-[3px] border-border bg-muted">
                    <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Top Products</h3>
                    <button
                      onClick={() =>
                        downloadCSV(
                          "seller-top-products.csv",
                          (topProducts || []).map((t) => ({
                            product: t.product,
                            sold: t.sold,
                            revenue: t.revenue,
                          })),
                          {
                            product: "Product",
                            sold: "Sold",
                            revenue: "Revenue",
                          }
                        )
                      }
                      className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="p-6">
                    {topProducts.length === 0 ? (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground p-4 text-center">No data</div>
                    ) : (
                      <div className="overflow-x-auto border-[3px] border-border">
                        <table className="min-w-full text-sm">
                          <thead className="bg-muted border-b-[3px] border-border">
                            <tr className="text-left font-black uppercase tracking-widest text-foreground text-[10px]">
                              <th className="px-4 py-3 border-r-[3px] border-border">Product</th>
                              <th className="px-4 py-3 border-r-[3px] border-border">Sold</th>
                              <th className="px-4 py-3">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-[3px] divide-border">
                            {topProducts.map((t, idx) => (
                              <tr
                                key={idx}
                                className="hover:bg-muted/50 transition-colors"
                              >
                                <td className="px-4 py-3 border-r-[3px] border-border font-bold text-[10px] tracking-widest text-foreground truncate max-w-[200px]" title={t.product}>{t.product}</td>
                                <td className="px-4 py-3 border-r-[3px] border-border font-black text-xs text-foreground">{t.sold}</td>
                                <td className="px-4 py-3 font-black text-xs text-primary">
                                  ₹{t.revenue.toLocaleString("en-IN")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerAnalyticsPage), {
  ssr: false,
});

