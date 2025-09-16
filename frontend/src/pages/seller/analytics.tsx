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
            <div className="card p-6 text-gray-700">
              You don’t have access to Analytics.
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
            <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900">
                Performance
              </h2>
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
          )}

          {!loading && (
            <div className="relative">
              <UpdatingOverlay show={fetching} />

              <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 space-y-6">
                  {/* Revenue & Orders */}
                  <Card>
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle>Revenue & Orders</CardTitle>
                      <Button variant="outline" onClick={exportSalesCSV}>
                        Export Sales CSV
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="w-full h-[300px]">
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

                  {/* AOV */}
                  <Card>
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle>Average Order Value (AOV)</CardTitle>
                      <Button variant="outline" onClick={exportAOVCSV}>
                        Export AOV CSV
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-0">
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

                {/* Orders by Category + Ratings */}
                <div className="xl:col-span-5 space-y-6">
                  <Card>
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle>Orders by Category</CardTitle>
                      <Button variant="outline" onClick={exportCategoriesCSV}>
                        Export CSV
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="w-full h-[260px]">
                        {categoryBars.length === 0 ? (
                          <div className="text-sm text-gray-600 p-3">
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
                                tick={{ fill: "#6b7280", fontSize: 12 }}
                                width={120}
                              />
                              <Tooltip
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
                                radius={[4, 4, 4, 4]}
                                isAnimationActive
                                animationDuration={350}
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

                  <Card>
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle>Ratings Overview</CardTitle>
                      <Button
                        variant="outline"
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
                      >
                        Export CSV
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <StarsBar
                        distribution={reviews?.distribution || {}}
                        avg={reviews?.overallAvgRating || 0}
                      />
                      <div className="text-sm text-gray-600 mt-2">
                        Total reviews:{" "}
                        <span className="text-gray-900 font-medium">
                          {reviews?.totalReviews || 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Recent Orders + Top Products */}
              <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-6">
                <Card className="xl:col-span-7">
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>Recent Orders</CardTitle>
                    <Button variant="outline" onClick={exportOrdersCSV}>
                      Export CSV
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {orders.length === 0 ? (
                      <div className="text-sm text-gray-600">
                        No orders found.
                      </div>
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
                                  <td className="py-2 capitalize">
                                    {o.status}
                                  </td>
                                  <td className="py-2">{currency(total)}</td>
                                  <td className="py-2">
                                    {o.user?.email || "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="xl:col-span-5">
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>Top Products</CardTitle>
                    <Button
                      variant="outline"
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
                    >
                      Export CSV
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {topProducts.length === 0 ? (
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
                            {topProducts.map((t, idx) => (
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
                  </CardContent>
                </Card>
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
