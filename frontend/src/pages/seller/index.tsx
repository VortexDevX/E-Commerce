import dynamic from "next/dynamic";
import Link from "next/link";
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
import OverviewCards from "../../components/charts/OverviewCards";
import api from "../../utils/api";
import { downloadCSV, csvDate } from "../../utils/csv";
import { currency } from "../../utils/format";
import { fillSalesSeries } from "../../utils/analytics";
import { useAuth } from "../../hooks/useAuth";
import { hasSellerPerm } from "../../utils/permissions";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ChartBarIcon,
  ShoppingCartIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";

// Types aligned with seller analytics
type Overview = {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
};
type SalesPoint = { date: string; orders: number; revenue: number };
type SellerOrder = {
  _id?: string;
  status: string;
  items: { qty: number; price: number }[];
  user?: { _id: string; email?: string };
  createdAt?: string;
};
type TopProduct = { product: string; sold: number; revenue: number };

// Helpers
function useDebounced<T>(value: T, delay = 350) {
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

function UpdatingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-full border-2 border-gray-300 border-t-purple-500 h-6 w-6 animate-spin bg-white/60 backdrop-blur-[1px]" />
    </div>
  );
}

function SellerHomePage() {
  const { user } = useAuth();
  const canAnalytics = hasSellerPerm(user as any, "seller:analytics:read");
  const canWriteProducts = hasSellerPerm(user as any, "seller:products:write");

  const [days, setDays] = useState(7);
  const [tab, setTab] = useState<"7d" | "14d" | "30d">("7d");
  useEffect(() => {
    setDays(tab === "7d" ? 7 : tab === "14d" ? 14 : 30);
  }, [tab]);

  const debouncedDays = useDebounced(days, 350);

  // Data
  const [overview, setOverview] = useState<Overview | null>(null);
  const [salesRaw, setSalesRaw] = useState<SalesPoint[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);

  const [loading, setLoading] = useState(true); // first render
  const [fetching, setFetching] = useState(false); // subsequent filter changes
  const controllerRef = useRef<AbortController | null>(null);
  const initialRef = useRef(true);

  const fetchAll = async (d: number) => {
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
      const calls: Promise<any>[] = [];

      // Only fetch analytics if allowed
      if (canAnalytics) {
        calls.push(api.get("/seller/analytics/overview", { signal: c.signal }));
        calls.push(
          api.get("/seller/analytics/sales", {
            params: { days: d },
            signal: c.signal,
          })
        );
      } else {
        calls.push(Promise.resolve({ data: null }));
        calls.push(Promise.resolve({ data: [] }));
      }

      // Common data
      calls.push(
        api.get("/seller/orders", { params: { days: d }, signal: c.signal })
      );
      calls.push(
        api.get("/seller/analytics/top-products", {
          params: { days: d },
          signal: c.signal,
        })
      );

      const [ovRes, salRes, ordRes, topRes] = await Promise.all(calls);

      if (controllerRef.current !== current) return; // canceled

      setOverview(ovRes.data || null);
      setSalesRaw(salRes.data || []);
      setOrders(ordRes.data || []);
      setTop(topRes.data || []);
    } catch (e: any) {
      if (!isCanceled(e)) {
        // optional: show toast
      }
    } finally {
      if (controllerRef.current === current) {
        setLoading(false);
        setFetching(false);
      }
    }
  };

  useEffect(() => {
    fetchAll(debouncedDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDays, canAnalytics]);

  const sales = useMemo(
    () => fillSalesSeries(days, salesRaw),
    [salesRaw, days]
  );
  const trends = useMemo(
    () => ({
      orders: sales.map((d) => d.orders),
      revenue: sales.map((d) => d.revenue),
    }),
    [sales]
  );

  const aovData = useMemo(
    () =>
      sales.map((d) => ({
        date: d.date,
        aov: d.orders ? Math.round(d.revenue / d.orders) : 0,
      })),
    [sales]
  );

  // Exports
  const exportSalesCSV = () =>
    downloadCSV(
      "seller-dashboard-sales.csv",
      sales.map((d) => ({
        date: csvDate(d.date),
        orders: d.orders,
        revenue: d.revenue,
      })),
      { date: "Date", orders: "Orders", revenue: "Revenue" }
    );

  const exportOrdersCSV = () =>
    downloadCSV(
      "seller-dashboard-orders.csv",
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
      "seller-dashboard-top-products.csv",
      (top || []).map((t) => ({
        product: t.product,
        sold: t.sold,
        revenue: t.revenue,
      })),
      { product: "Product", sold: "Sold", revenue: "Revenue" }
    );

  // Shortcuts
  const shortcuts = [
    {
      href: "/seller/analytics",
      label: "Analytics",
      icon: ChartBarIcon,
      perm: "seller:analytics:read",
    },
    {
      href: "/seller/orders",
      label: "Orders",
      icon: ShoppingCartIcon,
      perm: "seller:orders:read",
    },
    {
      href: "/seller/products",
      label: "Products",
      icon: CubeIcon,
      perm: "seller:products:read",
    },
  ].filter((s) => hasSellerPerm(user as any, s.perm));

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 font-black uppercase tracking-widest border-b-[3px] border-border pb-4 mb-6">
          <div>
            <h1 className="text-3xl text-foreground">
              Seller Dashboard
            </h1>
            {!canAnalytics && (
              <p className="text-muted-foreground font-bold tracking-widest text-[10px] mt-1">
                Analytics restricted for your role. You can still access the
                tools below.
              </p>
            )}
          </div>
        </div>

        {/* KPIs / Loading */}
        {loading ? (
          <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-bold uppercase tracking-widest text-sm">Loading…</div>
        ) : canAnalytics ? (
          <OverviewCards
            stats={{
              totalUsers: 0,
              totalOrders: overview?.totalOrders || 0,
              totalProducts: overview?.totalProducts || 0,
              totalRevenue: overview?.totalRevenue || 0,
            }}
            trends={trends}
          />
        ) : null}

        {/* Filters */}
        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-4 font-bold">
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
            </div>
          </div>
        </div>

        {/* Charts + Lists with overlay for smooth updates */}
        <div className="relative">
          <UpdatingOverlay show={fetching} />

          <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left: small dual series + AOV */}
            <div className="xl:col-span-7 space-y-6">
              <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] flex flex-col">
                <div className="flex flex-row items-center justify-between p-6 border-b-[3px] border-border bg-muted">
                  <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Revenue & Orders (last {days} days)</h3>
                  <button onClick={exportSalesCSV} className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all">
                    Export Sales CSV
                  </button>
                </div>
                <div className="p-6 pt-6">
                  <div className="w-full h-[280px]">
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

              <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] flex flex-col">
                <div className="flex flex-row items-center justify-between p-6 border-b-[3px] border-border bg-muted">
                  <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Average Order Value (AOV)</h3>
                  <button
                    onClick={() =>
                      downloadCSV(
                        "seller-dashboard-aov.csv",
                        aovData.map((d) => ({
                          date: csvDate(d.date),
                          aov: d.aov,
                        })),
                        { date: "Date", aov: "AOV" }
                      )
                    }
                    className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all"
                  >
                    Export AOV CSV
                  </button>
                </div>
                <div className="p-6 pt-6">
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={aovData}
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

            {/* Right: Top products + Quick links */}
            <div className="xl:col-span-5 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] flex flex-col">
              <div className="flex flex-row items-center justify-between p-6 border-b-[3px] border-border bg-muted">
                <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Top Products</h3>
                <button onClick={exportTopProductsCSV} className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all">
                  Export CSV
                </button>
              </div>
              <div className="p-6">
                {top.length === 0 ? (
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
                        {top.slice(0, 8).map((t, idx) => (
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

                {/* Quick links */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {shortcuts.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      className="flex items-center gap-3 p-4 border-[3px] border-border bg-card shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none bg-muted/30 hover:bg-muted"
                    >
                      <s.icon className="w-5 h-5 text-primary" strokeWidth={3} />
                      <span className="text-foreground font-black uppercase tracking-widest text-[10px]">{s.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="mt-6 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-0 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b-[3px] border-border bg-muted">
              <h3 className="text-xl font-black uppercase tracking-widest text-foreground">
                Recent Orders
              </h3>
              <button onClick={exportOrdersCSV} className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all">
                Export CSV
              </button>
            </div>
            {orders.length === 0 ? (
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground p-8 text-center">No orders found.</div>
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
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerHomePage), { ssr: false });

