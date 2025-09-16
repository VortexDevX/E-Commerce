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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Seller Dashboard
            </h1>
            {!canAnalytics && (
              <p className="text-gray-600 text-sm">
                Analytics restricted for your role. You can still access the
                tools below.
              </p>
            )}
          </div>
        </div>

        {/* KPIs / Loading */}
        {loading ? (
          <div className="card p-6 text-gray-600">Loading…</div>
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
        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900">Performance</h2>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-md border bg-background p-1">
              <button
                onClick={() => setTab("7d")}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  tab === "7d"
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                7d
              </button>
              <button
                onClick={() => setTab("14d")}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  tab === "14d"
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                14d
              </button>
              <button
                onClick={() => setTab("30d")}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  tab === "30d"
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
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
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Revenue & Orders (last {days} days)</CardTitle>
                  <Button variant="outline" onClick={exportSalesCSV}>
                    Export Sales CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[280px]">
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
                          isAnimationActive
                          animationDuration={350}
                          animationEasing="ease-out"
                          yAxisId="left"
                          type="monotone"
                          dataKey="orders"
                          stroke="#7c3aed"
                          strokeWidth={2}
                          dot={false}
                          name="Orders"
                        />
                        <Line
                          isAnimationActive
                          animationDuration={350}
                          animationEasing="ease-out"
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

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Average Order Value (AOV)</CardTitle>
                  <Button
                    variant="outline"
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
                  >
                    Export AOV CSV
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full h-[220px]">
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
                          isAnimationActive
                          animationDuration={350}
                          animationEasing="ease-out"
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

            {/* Right: Top products + Quick links */}
            <Card className="xl:col-span-5">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Top Products</CardTitle>
                <Button variant="outline" onClick={exportTopProductsCSV}>
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
                        </tr>
                      </thead>
                      <tbody>
                        {top.slice(0, 8).map((t, idx) => (
                          <tr
                            key={idx}
                            className="border-t border-gray-200 text-gray-900"
                          >
                            <td className="py-2">{t.product}</td>
                            <td className="py-2">{t.sold}</td>
                            <td className="py-2">
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
                      className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition"
                    >
                      <s.icon className="w-5 h-5 text-gray-500" />
                      <span className="text-gray-900">{s.label}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Orders */}
          <div className="mt-4 card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Recent Orders
              </h3>
              <Button variant="outline" onClick={exportOrdersCSV}>
                Export CSV
              </Button>
            </div>
            {orders.length === 0 ? (
              <div className="text-sm text-gray-600">No orders found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="py-2">Order</th>
                      <th className="py-2">Date</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Total</th>
                      <th className="py-2">Customer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 10).map((o) => {
                      const total = (o.items || []).reduce(
                        (s, it) => s + it.qty * it.price,
                        0
                      );
                      return (
                        <tr
                          key={o._id}
                          className="border-t border-gray-200 text-gray-900"
                        >
                          <td className="py-2">
                            #{(o._id || "").slice(-6).toUpperCase()}
                          </td>
                          <td className="py-2">
                            {o.createdAt ? csvDate(o.createdAt) : "—"}
                          </td>
                          <td className="py-2 capitalize">{o.status}</td>
                          <td className="py-2">{currency(total)}</td>
                          <td className="py-2">{o.user?.email || "—"}</td>
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
function hsl($: any, arg1: { hue: number }, arg2: number) {
  throw new Error("Function not implemented.");
}
